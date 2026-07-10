#!/usr/bin/env node

import { chromium } from "playwright";

const FRONTEND_URL = process.env.NS_FRONTEND_URL || "https://noble-savage-frontend-production.up.railway.app";
const BACKEND_URL = process.env.NS_BACKEND_URL || "https://noble-savage-backend-production.up.railway.app";
const RUN_ID = Math.random().toString(36).slice(2, 10);
const EMAIL = `browser.smoke.${Date.now()}.${RUN_ID}@noblesavage.local`;
const PASSWORD = `BrowserSmoke!${RUN_ID}a1`;

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function registerUser() {
  const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      name: "Browser Smoke",
    }),
  });

  const text = await response.text();
  assertCondition(response.ok, `Auth register failed (${response.status}): ${text}`);

  const body = JSON.parse(text);
  assertCondition(Boolean(body.access_token), "Auth register succeeded but no access token returned");
  return body.access_token;
}

async function ensureRailOpen(page) {
  const collapsedTrigger = page.locator(".workspace-trigger");
  if (await collapsedTrigger.first().isVisible().catch(() => false)) {
    await collapsedTrigger.first().click();
  }
}

async function main() {
  const token = await registerUser();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript((accessToken) => {
    window.localStorage.setItem("ns_access_token", accessToken);
  }, token);

  try {
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator(".app-shell").waitFor({ state: "visible", timeout: 60000 });

    await ensureRailOpen(page);

    await page.locator('button[aria-label="Toggle sidebar"]').click({ timeout: 15000 });
    await page.waitForTimeout(200);
    let shellClass = await page.locator(".app-shell").getAttribute("class");
    assertCondition(shellClass?.includes("sidebar-collapsed"), "Sidebar did not collapse after toggle");

    await page.locator('button[aria-label="Toggle sidebar"]').click({ timeout: 15000 });
    await page.waitForTimeout(200);
    shellClass = await page.locator(".app-shell").getAttribute("class");
    assertCondition(!shellClass?.includes("sidebar-collapsed"), "Sidebar did not expand after second toggle");

    const hideRailButton = page.getByRole("button", { name: "Hide" });
    if (await hideRailButton.isVisible().catch(() => false)) {
      await hideRailButton.click({ timeout: 10000 });
      await page.locator(".workspace-trigger").waitFor({ state: "visible", timeout: 10000 });
      await page.locator(".workspace-trigger").click({ timeout: 10000 });
      await page.locator(".rail-content").waitFor({ state: "visible", timeout: 10000 });
    }

    const scrollResult = await page.evaluate(() => {
      const selectors = [".library-scroll", ".messages-frame", ".rail-content"];
      const result = [];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) {
          result.push({ selector, found: false, scrollable: false, moved: false });
          continue;
        }
        const canScroll = el.scrollHeight > el.clientHeight + 6;
        const before = el.scrollTop;
        if (canScroll) {
          el.scrollTop = Math.min(160, el.scrollHeight);
        }
        const after = el.scrollTop;
        result.push({ selector, found: true, scrollable: canScroll, moved: after > before });
      }
      return result;
    });

    const messageFrame = scrollResult.find((item) => item.selector === ".messages-frame");
    assertCondition(Boolean(messageFrame?.found), "Missing .messages-frame container in app shell");

    const atLeastOneMoved = scrollResult.some((item) => item.found && item.scrollable && item.moved);
    assertCondition(atLeastOneMoved, `No pane accepted scroll movement: ${JSON.stringify(scrollResult)}`);

    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "smoke-drag");
      const dragEvent = new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true });
      window.dispatchEvent(dragEvent);
    });
    await page.waitForTimeout(120);
    const overlayVisibleForText = await page.locator(".global-drop-overlay").count();
    assertCondition(overlayVisibleForText === 0, "Drop overlay appeared for non-file drag payload");

    await page.evaluate(() => {
      const dt = new DataTransfer();
      const file = new File(["smoke"], "smoke.txt", { type: "text/plain" });
      dt.items.add(file);
      const dragEvent = new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true });
      window.dispatchEvent(dragEvent);
    });
    await page.locator(".global-drop-overlay").waitFor({ state: "visible", timeout: 5000 });

    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
    });
    await page.locator(".global-drop-overlay").waitFor({ state: "hidden", timeout: 5000 });

    const stillInteractive = await page.locator(".composer textarea").isVisible().catch(() => false);
    assertCondition(stillInteractive, "Composer textarea is not visible after drag overlay cycle");

    console.log(`browser_lock_smoke_ok frontend=${FRONTEND_URL} backend=${BACKEND_URL}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("browser_lock_smoke_failed", error);
  process.exit(1);
});
