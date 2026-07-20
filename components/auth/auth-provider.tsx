"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ArgusPermission,
  AuthPrincipal,
  AuthPublicConfiguration,
  AuthSessionEstablished,
} from "@/packages/shared/auth";

const SESSION_KEY = "argus-auth-session";
const LOGIN_ATTEMPT_KEY = "argus-auth-login-attempt";
const LOGIN_ATTEMPT_TTL_MS = 10 * 60 * 1_000;

type AuthStatus = "loading" | "anonymous" | "authenticated" | "unavailable";

interface LoginAttempt {
  state: string;
  codeVerifier: string;
  createdAt: number;
}

interface StoredSession {
  credential: string;
  expiresAt: string;
}

interface AuthContextValue {
  principal: AuthPrincipal | null;
  status: AuthStatus;
  error: string | null;
  can(permission: ArgusPermission): boolean;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  authenticatedFetch(path: string, init?: RequestInit): Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomBase64Url(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function loadConfiguration(apiBaseUrl: string): Promise<AuthPublicConfiguration> {
  const response = await fetch(`${apiBaseUrl}/api/auth/config`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Identity configuration is unavailable."));
  const payload = (await response.json()) as { data: AuthPublicConfiguration };
  return payload.data;
}

function storedSession(): StoredSession | null {
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.credential || Date.parse(parsed.expiresAt) <= Date.now()) throw new Error();
    return parsed;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(session: AuthSessionEstablished): void {
  if (!session.principal.sessionExpiresAt) {
    throw new Error("ARGUS returned a session without an expiration time.");
  }
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      credential: session.credential,
      expiresAt: session.principal.sessionExpiresAt,
    } satisfies StoredSession),
  );
}

function cleanOAuthQuery(): void {
  const url = new URL(window.location.href);
  for (const key of ["code", "state", "error", "error_description"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

async function initializeAuth(
  apiBaseUrl: string,
): Promise<{ principal: AuthPrincipal | null; status: AuthStatus; error: string | null }> {
  if (!apiBaseUrl) return { principal: null, status: "unavailable", error: null };
  const query = new URLSearchParams(window.location.search);
  const oauthError = query.get("error");
  if (oauthError) {
    const description = query.get("error_description") ?? "GitHub sign-in was cancelled.";
    cleanOAuthQuery();
    window.sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
    return { principal: null, status: "anonymous", error: description };
  }

  const code = query.get("code");
  const returnedState = query.get("state");
  if (code || returnedState) {
    try {
      const rawAttempt = window.sessionStorage.getItem(LOGIN_ATTEMPT_KEY);
      if (!code || !returnedState || !rawAttempt) throw new Error("The sign-in response is incomplete.");
      const attempt = JSON.parse(rawAttempt) as LoginAttempt;
      if (
        attempt.state !== returnedState ||
        !attempt.codeVerifier ||
        Date.now() - attempt.createdAt > LOGIN_ATTEMPT_TTL_MS
      ) {
        throw new Error("The sign-in response could not be matched to this browser session.");
      }
      const response = await fetch(`${apiBaseUrl}/api/auth/exchange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, codeVerifier: attempt.codeVerifier }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "ARGUS sign-in failed."));
      const payload = (await response.json()) as { data: AuthSessionEstablished };
      saveSession(payload.data);
      return { principal: payload.data.principal, status: "authenticated", error: null };
    } catch (error) {
      return {
        principal: null,
        status: "anonymous",
        error: error instanceof Error ? error.message : "ARGUS sign-in failed.",
      };
    } finally {
      cleanOAuthQuery();
      window.sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
    }
  }

  const session = storedSession();
  if (!session) return { principal: null, status: "anonymous", error: null };
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/session`, {
      headers: { authorization: `Bearer ${session.credential}` },
    });
    if (!response.ok) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return { principal: null, status: "anonymous", error: null };
    }
    const payload = (await response.json()) as { data: { principal: AuthPrincipal } };
    return { principal: payload.data.principal, status: "authenticated", error: null };
  } catch {
    return {
      principal: null,
      status: "anonymous",
      error: "The identity service is temporarily unavailable; public demonstration views still work.",
    };
  }
}

let initialization: Promise<Awaited<ReturnType<typeof initializeAuth>>> | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const apiBaseUrl = import.meta.env.VITE_ARGUS_API_URL?.replace(/\/+$/, "") ?? "";
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    initialization ??= initializeAuth(apiBaseUrl);
    void initialization.then((result) => {
      if (!active) return;
      setPrincipal(result.principal);
      setStatus(result.status);
      setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const signIn = useCallback(async () => {
    setError(null);
    if (!apiBaseUrl) {
      setStatus("unavailable");
      setError("The deployed ARGUS Worker is not configured for this site.");
      return;
    }
    try {
      const configuration = await loadConfiguration(apiBaseUrl);
      if (!configuration.enabled || !configuration.clientId || !configuration.callbackUrl) {
        throw new Error("GitHub identity has not been enabled on the ARGUS Worker.");
      }
      const codeVerifier = randomBase64Url();
      const state = randomBase64Url();
      window.sessionStorage.setItem(
        LOGIN_ATTEMPT_KEY,
        JSON.stringify({ state, codeVerifier, createdAt: Date.now() } satisfies LoginAttempt),
      );
      const authorize = new URL(configuration.authorizeUrl);
      authorize.searchParams.set("client_id", configuration.clientId);
      authorize.searchParams.set("redirect_uri", configuration.callbackUrl);
      authorize.searchParams.set("state", state);
      authorize.searchParams.set("code_challenge", await pkceChallenge(codeVerifier));
      authorize.searchParams.set("code_challenge_method", configuration.pkceMethod);
      authorize.searchParams.set("allow_signup", "false");
      authorize.searchParams.set("prompt", "select_account");
      window.location.assign(authorize);
    } catch (caught) {
      setStatus("anonymous");
      setError(caught instanceof Error ? caught.message : "GitHub sign-in could not start.");
    }
  }, [apiBaseUrl]);

  const authenticatedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const session = storedSession();
      if (!apiBaseUrl || !session) throw new Error("Sign in to perform this action.");
      const headers = new Headers(init.headers);
      headers.set("authorization", `Bearer ${session.credential}`);
      headers.set("x-request-id", crypto.randomUUID());
      return fetch(`${apiBaseUrl}${path}`, { ...init, headers });
    },
    [apiBaseUrl],
  );

  const signOut = useCallback(async () => {
    try {
      const session = storedSession();
      if (apiBaseUrl && session) {
        await fetch(`${apiBaseUrl}/api/auth/logout`, {
          method: "POST",
          headers: { authorization: `Bearer ${session.credential}` },
        });
      }
    } catch {
      // Local sign-out still clears the browser credential if the Worker is unavailable.
    } finally {
      window.sessionStorage.removeItem(SESSION_KEY);
      initialization = null;
      setPrincipal(null);
      setStatus(apiBaseUrl ? "anonymous" : "unavailable");
      setError(null);
    }
  }, [apiBaseUrl]);

  const value = useMemo<AuthContextValue>(
    () => ({
      principal,
      status,
      error,
      can: (permission) => principal?.permissions.includes(permission) ?? false,
      signIn,
      signOut,
      authenticatedFetch,
    }),
    [authenticatedFetch, error, principal, signIn, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
