import { githubOAuthConfiguration, type IdentityEnvironment } from "@/lib/auth/configuration";
import { jsonData, requestIdFrom } from "@/lib/api/responses";
import type { AuthPublicConfiguration } from "@/packages/shared/auth";

export async function GET(
  request: Request,
  context: IdentityEnvironment = {},
): Promise<Response> {
  const requestId = requestIdFrom(request);
  const configuration = githubOAuthConfiguration(context);
  const data: AuthPublicConfiguration = {
    enabled: Boolean(configuration),
    provider: "github",
    ...(configuration
      ? { clientId: configuration.clientId, callbackUrl: configuration.callbackUrl }
      : {}),
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    pkceMethod: "S256",
  };
  return jsonData(data, { meta: { requestId } });
}
