import { defineConfig, devices } from "@playwright/test";

// E2E runs against `next dev` with mock data forced ON for deterministic journeys.
// MapLibre GL gets an empty local style (see spec stub) so no external tile
// network is needed; headless Chromium uses SwiftShader for WebGL.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_USE_MOCKS: "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
        },
      },
    },
  ],
});
