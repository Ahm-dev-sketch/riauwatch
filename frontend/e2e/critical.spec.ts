// Critical-journey E2E (mock mode, deterministic). MapLibre GL gets an empty
// local style stub so no external tile network is needed; headless Chromium
// renders WebGL via SwiftShader (see playwright.config.ts launch args).

import { test, expect, type Page, type Browser } from "@playwright/test";

declare global {
  interface Window {
    __rwMap?: {
      project: (lngLat: [number, number]) => { x: number; y: number };
      setZoom: (z: number) => void;
      setCenter: (c: [number, number]) => void;
      getSource: (id: string) => unknown;
      getLayer: (id: string) => unknown;
    };
    __rwHotspots?: Array<{ geometry: { coordinates: number[] } }>;
    __rwShowHotspotPopup?: (index: number) => boolean;
  }
}

const EMPTY_STYLE = { version: 8, sources: {}, layers: [] };

async function stubMapStyle(page: Page): Promise<void> {
  await page.route("https://tiles.openfreemap.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(EMPTY_STYLE),
    });
  });
}

async function waitForMap(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__rwMap, { timeout: 30_000 });
  await expect(page.getByTestId("hotspot-map").locator("canvas").first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await stubMapStyle(page);
});

// (1) Homepage loads with no login.
test("journey 1: homepage loads without login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bagaimana kondisi Riau sekarang?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sumber Data" }).first()).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

// (2) Map canvas renders.
test("journey 2: map canvas renders", async ({ page }) => {
  await page.goto("/");
  await waitForMap(page);
  const canvas = page.getByTestId("hotspot-map").locator("canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
});

// (3) Hotspot layer loads with features: source + layers registered, 14
// features plumbed into the layer, sidebar list renders them.
test("journey 3: hotspot layer loads with features", async ({ page }) => {
  await page.goto("/");
  await waitForMap(page);
  await page.waitForFunction(() => (window.__rwHotspots?.length ?? 0) > 0, {
    timeout: 30_000,
  });
  const wired = await page.evaluate(() => ({
    hasSource: !!window.__rwMap?.getSource("hotspots"),
    layers: ["hotspot-clusters", "hotspot-clusters-count", "hotspot-points"].map(
      (id) => !!window.__rwMap?.getLayer(id),
    ),
    featureCount: window.__rwHotspots?.length ?? 0,
  }));
  expect(wired.hasSource).toBe(true);
  expect(wired.layers).toEqual([true, true, true]);
  expect(wired.featureCount).toBe(14);
  await expect(page.getByText("Ringkasan Titik Panas")).toBeVisible();
  await expect(page.getByText("titik panas terdeteksi")).toContainText("14");
});

// (4) Hotspot popup opens with the disclaimer. The popup is produced by the
// exact production popup code path; only GL hit-testing (a browser capability,
// not app logic) is bypassed via the mock-mode hook, because MapLibre worker
// tile generation stalls in headless CI environments.
test("journey 4: hotspot popup shows disclaimer", async ({ page }) => {
  await page.goto("/");
  await waitForMap(page);
  await page.waitForFunction(() => typeof window.__rwShowHotspotPopup === "function", {
    timeout: 30_000,
  });
  // Pelalawan feature (index 5) — high confidence, known coordinates.
  const opened = await page.evaluate(() => window.__rwShowHotspotPopup!(5));
  expect(opened).toBe(true);
  const popup = page.locator(".maplibregl-popup");
  await expect(popup).toBeVisible({ timeout: 10_000 });
  await expect(popup).toContainText("BUKAN kebakaran terkonfirmasi");
  await expect(popup).toContainText("Kab. Pelalawan");
  await expect(popup).toContainText("101.8700");
});

// (5) Date/kabupaten/confidence filters change the list.
test("journey 5: filters change the hotspot list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("titik panas terdeteksi")).toContainText("14");

  // Confidence filter narrows to high-confidence features only.
  await page.locator("select#confidence").selectOption("h");
  await expect(page.getByText("titik panas terdeteksi")).toContainText("4");

  // Reset restores the full list.
  await page.getByRole("button", { name: "Hapus Semua Filter" }).click();
  await expect(page.getByText("titik panas terdeteksi")).toContainText("14");

  // Kabupaten filter narrows to Kampar (2 features).
  await page.locator("select#kabupaten").selectOption("3");
  await expect(page.getByText("titik panas terdeteksi")).toContainText("2");
  await expect(page.getByText("Kab. Kampar").first()).toBeVisible();
});

// (6) Risk panel shows level + factors.
test("journey 6: risk panel shows level and factors", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Risiko", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Risiko Kebakaran" }).first()).toBeVisible();
  await expect(page.getByText("Risiko Tinggi").first()).toBeVisible();
  await expect(page.getByText("Skor Risiko").first()).toBeVisible();
  await expect(page.getByText("Faktor Penilaian").first()).toBeVisible();
  await expect(page.getByText("hotspot_count_7d").first()).toBeVisible();
});

// (7) AQ panel shows PM2.5 + ISPU category + timestamp.
test("journey 7: air quality panel shows PM2.5, ISPU, timestamp", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Kualitas Udara" }).click();
  await expect(page.getByRole("button", { name: "PM2.5" }).first()).toBeVisible();
  await expect(page.getByText("38.5").first()).toBeVisible();
  await expect(page.getByText("Sedang").first()).toBeVisible();
  await expect(page.getByText(/Diperbarui .* lalu/).first()).toBeVisible();
  await expect(page.getByText("Tren PM2.5").first()).toBeVisible();
});

// (8) Geolocation granted shows location panel; denial is graceful.
test.describe("journey 8: geolocation", () => {
  test("granted shows location panel", async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation"],
      geolocation: { latitude: 0.5, longitude: 101.5 },
    });
    const page = await context.newPage();
    await stubMapStyle(page);
    try {
      await page.goto("/");
      await page.getByRole("tab", { name: "Lokasi Saya" }).click();
      await page.getByRole("button", { name: "Gunakan Lokasi Saya" }).click();
      await expect(page.getByText("Kab. Kampar").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Stasiun Kualitas Udara Terdekat")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("denial shows graceful message", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Lokasi Saya" }).click();
    await page.getByRole("button", { name: "Gunakan Lokasi Saya" }).click();
    await expect(page.getByText("Akses lokasi ditolak")).toBeVisible({ timeout: 15_000 });
  });
});

// (9) Mobile viewport: no horizontal overflow, tabs reachable, map usable.
test.describe("journey 9: mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no overflow, tabs and map work", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Bagaimana kondisi Riau sekarang?" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - 390);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const tab of ["Ringkasan", "Kualitas Udara", "Cuaca", "Risiko", "Lokasi Saya"]) {
      await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
    }
    // Map is on the overview tab — verify it works before switching tabs
    await waitForMap(page);
    await page.getByRole("tab", { name: "Risiko", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Risiko Kebakaran" }).first()).toBeVisible();
  });
});

// (10) Keyboard-accessible hotspot list: focus items, Enter selects, "Tampilkan di peta" works.
test("journey 10: keyboard-accessible hotspot list", async ({ page }) => {
  await page.goto("/");
  await waitForMap(page);
  await page.waitForFunction(() => (window.__rwHotspots?.length ?? 0) > 0, {
    timeout: 30_000,
  });

  // The list should be visible
  const list = page.getByTestId("hotspot-list");
  await expect(list).toBeVisible();
  await expect(page.getByTestId("hotspot-list-items")).toBeVisible();

  // First item should be focusable via Tab
  const firstItem = page.getByTestId("hotspot-item-0");
  await firstItem.focus();
  await expect(firstItem).toBeFocused();

  // Enter key should select the item (triggers highlight + popup)
  await firstItem.press("Enter");
  // The item should now be highlighted (aria-selected=true)
  await expect(firstItem).toHaveAttribute("aria-selected", "true");

  // Arrow Down should move focus to next item
  await firstItem.press("ArrowDown");
  const secondItem = page.getByTestId("hotspot-item-1");
  await expect(secondItem).toBeFocused();

  // "Tampilkan di peta" button should be present on hover
  const showOnMapBtn = page.getByTestId("show-on-map-1");
  // Hover to reveal the button
  await secondItem.hover();
  await expect(showOnMapBtn).toBeVisible();
  await expect(showOnMapBtn).toContainText("Tampilkan di peta");
});

// (11) Tile-failure fallback: when tiles fail, notice appears + list keeps working.
test("journey 11: tile failure shows fallback notice with retry", async ({ page }) => {
  // Override the tile route to return 500 errors instead of the empty style
  await page.route("https://tiles.openfreemap.org/**", async (route) => {
    await route.abort("failed");
  });

  await page.goto("/");
  // When tiles fail, MapLibre's "load" event may never fire (so __rwMap/
  // __rwHotspots are never set). The hotspot list renders from the API data
  // independently of tiles, so wait for it via DOM instead.
  const list = page.getByTestId("hotspot-list");
  await expect(list).toBeVisible({ timeout: 30_000 });

  // The tile error notice should appear in the list panel
  const notice = page.getByTestId("tile-error-notice");
  await expect(notice).toBeVisible({ timeout: 20_000 });
  await expect(notice).toContainText("Peta dasar tidak dapat dimuat");
  await expect(notice).toContainText("Data tetap tersedia di daftar");

  // Retry button should be visible
  const retryBtn = page.getByTestId("retry-tiles-btn");
  await expect(retryBtn).toBeVisible();

  // The hotspot list should still be fully functional
  const listItems = page.getByTestId("hotspot-list-items");
  await expect(listItems).toBeVisible();
  const firstItem = page.getByTestId("hotspot-item-0");
  await expect(firstItem).toBeVisible();
  await firstItem.focus();
  await firstItem.press("Enter");
  await expect(firstItem).toHaveAttribute("aria-selected", "true");
});

// (12) Tab keyboard navigation works via Arrow keys.
test("journey 12: tab keyboard navigation", async ({ page }) => {
  await page.goto("/");
  const firstTab = page.locator("#tab-overview");
  await firstTab.focus();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");

  // ArrowRight moves to next tab
  await firstTab.press("ArrowRight");
  const airTab = page.locator("#tab-air");
  await expect(airTab).toBeFocused();
  await expect(airTab).toHaveAttribute("aria-selected", "true");

  // ArrowRight again moves to weather
  await airTab.press("ArrowRight");
  const weatherTab = page.locator("#tab-weather");
  await expect(weatherTab).toBeFocused();
  await expect(weatherTab).toHaveAttribute("aria-selected", "true");

  // Home key wraps to first tab
  await weatherTab.press("Home");
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveAttribute("aria-selected", "true");

  // End key jumps to last tab
  await firstTab.press("End");
  const locationTab = page.locator("#tab-location");
  await expect(locationTab).toBeFocused();
  await expect(locationTab).toHaveAttribute("aria-selected", "true");
});

// (13) Stale/unavailable rendering + data-sources page.
test("journey 13: freshness, disclaimer, data sources", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Status data:")).toBeVisible();
  await expect(page.getByText("Observasi terakhir").first()).toBeVisible();
  await expect(page.getByText("BUKAN").first()).toBeVisible();

  await page.goto("/data-sources");
  await expect(page.getByRole("heading", { name: "Sumber Data & Transparansi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sumber Data Aktif" })).toBeVisible();
  await expect(page.getByText("NASA FIRMS VIIRS").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pernyataan Penting" })).toBeVisible();
});
