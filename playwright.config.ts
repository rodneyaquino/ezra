/**
 * =============================================================================
 * playwright.config.ts | Playwright configuration for the Ezra booking test suite
 * =============================================================================
 *
 * This file is the main control panel for Playwright.
 *
 * WHAT IT DECIDES
 * - where the tests live
 * - how many workers run at once
 * - whether retries are enabled
 * - what browser project is used
 * - where output and reports go
 * - which base URL is used for the Member Facing Portal
 *
 * WHY THE SETTINGS ARE KEPT SIMPLE
 * Clear and stable is better than over-engineered.
 * One worker and a conservative setup keep the flow easier to reason about
 * and less likely to collide with itself.
 * =============================================================================
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// Load values from .env before Playwright reads the rest of the config.
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  // The folder that holds the test specs.
  testDir: './tests',

  // Run tests one at a time.
  // This is slower, but safer for an environment that may have shared state.
  fullyParallel: false,
  workers: 1,

  // Prevent accidental committed `.only` calls in CI.
  forbidOnly: !!process.env.CI,

  // Keep retries modest.
  // Local runs stay strict. CI gets one retry for transient noise.
  retries: process.env.CI ? 1 : 0,

  // Overall test timeout.
  timeout: 60_000,

  // Assertion timeout.
  expect: {
    timeout: 10_000,
  },

  // Folder where Playwright stores traces, videos, and screenshots.
  outputDir: 'test-results',

  // Keep reporting simple and readable.
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    // Member Facing Portal base URL.
    baseURL: process.env.BASE_URL || 'https://myezra-staging.ezra.com',

    // Action timeout for clicks and fills.
    actionTimeout: 10_000,

    // Helpful debugging artifacts.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Keep the browser target focused.
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use bundled Chromium instead of system Chrome (unavailable on arm64).
        channel: undefined,
        launchOptions: { slowMo: 800 },
      },
    },
  ],
});
