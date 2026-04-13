/**
 * =============================================================================
 * utils/freshBrowser.ts | Clean browser context factory
 * =============================================================================
 *
 * WHY THIS HELPER EXISTS
 * The end-to-end booking test needs to verify the member record in a second
 * portal (the User Facing Portal / Hub). That portal requires its own login
 * session and must not inherit cookies, storage, or cache from the Member
 * Facing Portal booking flow.
 *
 * Playwright's `browser.newContext()` creates a completely isolated browsing
 * context. A new context has:
 * - no cookies
 * - no localStorage
 * - no sessionStorage
 * - no service worker registrations
 * - a fresh HTTP cache
 *
 * This helper wraps that into a single function so it can be called anywhere
 * in the suite without repeating the two-step context+page creation.
 *
 * USAGE IN A TEST
 * ```ts
 * import { openFreshBrowser } from '../utils/freshBrowser';
 *
 * const { context, page } = await openFreshBrowser(browser);
 * try {
 *   await page.goto('https://example.com');
 *   // … use the isolated page …
 * } finally {
 *   await context.close();
 * }
 * ```
 *
 * CLEANUP
 * The caller is responsible for closing the context when done.
 * Use a try/finally block to guarantee cleanup even on test failure.
 * =============================================================================
 */

import { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Shape of the result returned by openFreshBrowser.
 *
 * `context` is the isolated BrowserContext — close it to release resources.
 * `page` is the first tab inside that context, ready for navigation.
 */
export interface FreshBrowserResult {
  context: BrowserContext;
  page: Page;
}

/**
 * Open a fresh, isolated browser context with a single blank page.
 *
 * WHAT IT DOES
 * 1. Creates a new BrowserContext on the provided browser instance.
 *    This context shares no state with any other context.
 * 2. Opens a new page (tab) inside that context.
 * 3. Returns both so the caller can navigate and interact freely.
 *
 * WHY THIS IS BETTER THAN REUSING THE EXISTING PAGE
 * - No leftover auth tokens from the member portal
 * - No cached API responses from the booking flow
 * - No local/session storage contamination
 * - A clean HTTP cache so every request goes to the server
 *
 * @param browser  The Playwright Browser instance. Available as the `browser`
 *                 fixture in any Playwright test.
 * @returns        An object containing the new context and page.
 */
export async function openFreshBrowser(browser: Browser): Promise<FreshBrowserResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}
