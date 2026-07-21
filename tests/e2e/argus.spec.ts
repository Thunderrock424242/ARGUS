import { expect, test, type Page } from "@playwright/test";

async function gotoArgus(page: Page, path: string) {
  const response = await page.goto(path);
  await page.locator("html[data-argus-hydrated='true']").waitFor();
  return response;
}

test("global operations exposes the live operating picture and demonstration warning", async ({ page }) => {
  await gotoArgus(page, "/");
  await expect(page.getByRole("heading", { name: "Global Operations View" })).toBeVisible();
  await expect(page.getByText("Demonstration data — not real-world intelligence.").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operational layers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alert queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Report stream" })).toBeVisible();
});

test("the original command center remains available", async ({ page }) => {
  await gotoArgus(page, "/dashboard");
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Global situation overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Priority intelligence" })).toBeVisible();
});

test("events can be searched and opened as a dossier", async ({ page }) => {
  await gotoArgus(page, "/events");
  const search = page.getByPlaceholder("Search events, locations, tags…");
  await search.fill("Helios municipal");
  const eventLink = page.getByRole("link", { name: "[DEMO] Helios municipal network isolates affected services", exact: true });
  await expect(eventLink).toBeVisible();
  await eventLink.press("Enter");
  await expect(page).toHaveURL(/\/events\/demo-helios-municipal-ransomware$/);
  await expect(page.getByRole("heading", { name: "[DEMO] Helios municipal network isolates affected services" })).toBeVisible();
  await page.getByRole("button", { name: "claims", exact: true }).click();
  await expect(page.getByText("Claim-level verification")).toBeVisible();
});

test("global search opens a matching intelligence record", async ({ page }) => {
  await gotoArgus(page, "/");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("textbox", { name: "Search ARGUS" });
  await expect(search).toBeVisible();
  await search.fill("Northstar Island");
  const palette = page.getByRole("dialog", { name: "Global search" });
  const result = palette.getByRole("link", { name: /Strong earthquake detected near Northstar Island/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/demo-northstar-island-earthquake/);
});

test("review decisions require an authenticated ARGUS identity", async ({ page }) => {
  await gotoArgus(page, "/review");
  await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "C Confirm" });
  await expect(confirm).toBeVisible();
  await confirm.press("Enter");
  await expect(page.getByRole("status")).toContainText("Sign in with GitHub before recording a durable analyst decision");
});

test("ingestion exposes a protected intake boundary", async ({ page }) => {
  await gotoArgus(page, "/ingestion");
  await expect(page.getByRole("heading", { name: "Ingestion queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to use ingestion" })).toBeVisible();
  await expect(page.getByText(/contains protected provenance and reviewer actions/)).toBeVisible();
});

test("all primary analyst routes remain reachable", async ({ page }) => {
  for (const route of ["/map", "/sources", "/ingestion", "/watchlists", "/briefs", "/aether", "/system", "/settings", "/relationships", "/consequences", "/conflicts", "/timeline", "/alerts", "/live-feeds", "/wall"]) {
    const response = await gotoArgus(page, route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByText(/Demonstration data — not real-world intelligence/).first()).toBeVisible();
  }
});

test("impact graph exposes evidence and separate causal confidence", async ({ page }) => {
  await gotoArgus(page, "/relationships");
  await expect(page.getByRole("heading", { name: "Relationships & impact" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Impact graph with/ })).toBeVisible();
  await expect(page.getByText(/Every edge retains independent confidence/)).toBeVisible();
  await expect(page.getByText(/direct causation has not been confirmed/i).first()).toBeVisible();
});

test("alert center provides visual equivalents without automatic audio", async ({ page }) => {
  await gotoArgus(page, "/alerts");
  await expect(page.getByRole("heading", { name: "Alerts & Aether voice" })).toBeVisible();
  await expect(page.getByText(/Voice alerts are disabled until the analyst enables ARGUS audio/)).toBeVisible();
  await page.getByRole("button", { name: "Test visual" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Test visual alert" })).toBeVisible();
});
