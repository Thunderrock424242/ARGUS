import { expect, test } from "@playwright/test";

test("command center exposes the operating picture and demonstration warning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  await expect(page.getByText("Demonstration data — not real-world intelligence.").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Global situation overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Priority intelligence" })).toBeVisible();
  await expect(page.getByText("Automated confidence indicates rule satisfaction")).toBeVisible();
});

test("events can be searched and opened as a dossier", async ({ page }) => {
  await page.goto("/events");
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
  await page.goto("/");
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

test("review decisions update the local demonstration queue", async ({ page }) => {
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "C Confirm" });
  await expect(confirm).toBeVisible();
  await confirm.press("Enter");
  await expect(page.getByRole("status")).toContainText("marked confirmed in this demonstration session");
});

test("all primary analyst routes remain reachable", async ({ page }) => {
  for (const route of ["/map", "/sources", "/watchlists", "/briefs", "/aether", "/system", "/settings"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByText(/Demonstration data — not real-world intelligence/).first()).toBeVisible();
  }
});
