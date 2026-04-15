/**
 * =============================================================================
 * ConfirmationPage.ts | Post-payment success state
 * =============================================================================
 *
 * This page object represents the end of the booking flow in the Member Facing
 * Portal. It is the final proof that the booking request was accepted before
 * the test moves on to User Facing Portal verification.
 *
 * PAGE STRUCTURE
 * - URL: /sign-up/scan-confirm
 * - Heading: "Your requested time slots have been received."
 * - Body includes:
 *     - "MRI Scan Appointment"
 *     - Office name and address (e.g. "North Irvine")
 *     - "Requested Times:" followed by up to 3 time slots with timezone
 *       (e.g. "Sun, May 4, 2026, 8:30 AM PDT")
 *     - "Begin Medical Questionnaire" button
 *
 * WHY THE ASSERTIONS USE PAGE-LEVEL TEXT
 * The confirmation page does not expose data-testid attributes for individual
 * data sections (scan type, office, times). Instead of building brittle class-
 * based locators, this page object reads the full page body text and lets the
 * spec file assert specific values against it. This is both simpler and more
 * resilient to CSS class renaming or layout changes.
 * =============================================================================
 */

import { expect, Locator, Page } from '@playwright/test';
import { isSuccessfulBookingUrl } from '../utils/urlMatchers';
import { BasePage } from './BasePage';

export class ConfirmationPage extends BasePage {
  /** Candidate locators for a success heading or success-style message. */
  readonly confirmationHeadingCandidates: Locator[];

  /**
   * Create the locator lists used by this page object.
   *
   * The heading candidates include the exact heading text ("requested time slots")
   * as well as generic success patterns so the tests survive if the wording
   * changes slightly.
   */
  constructor(page: Page) {
    super(page);

    this.confirmationHeadingCandidates = [
      // Primary: the exact heading observed on /sign-up/scan-confirm.
      page.getByText(/requested time slots have been received/i),
      page.getByRole('heading', { name: /requested time slots/i }),
      // Generic success patterns as fallback.
      page.getByRole('heading', { name: /confirmed|thank you|booked|appointment reserved/i }),
      page.getByText(/confirmed|thank you|booked|appointment reserved/i),
    ];
  }

  /**
   * Wait for the booking success state.
   *
   * FLOW
   * 1. Keep checking for a success signal.
   * 2. Accept either a success-looking URL (/scan-confirm, redirect_status=succeeded)
   *    or a visible confirmation heading.
   * 3. Once one of those appears, wait for the page to settle.
   *
   * WHY expect.poll()
   * The payment redirect can take a variable amount of time depending on Stripe
   * processing speed. Polling gives the page a realistic window to settle while
   * still failing fast if something is genuinely wrong.
   */
  async waitForConfirmation(timeout = 30_000): Promise<void> {
    await expect
      .poll(async () => {
        const urlLooksGood = isSuccessfulBookingUrl(this.page.url());
        const headingVisible = await this.isAnyVisible(this.confirmationHeadingCandidates);
        return urlLooksGood || headingVisible;
      }, {
        timeout,
        message: 'Expected the browser to reach a successful post-payment state.',
      })
      .toBe(true);

    await this.waitForPageReady();
  }

  /**
   * Return true when a visible success signal exists on the page.
   *
   * Used by the decline test to confirm that the confirmation page is NOT loaded
   * after a failed payment, and by the e2e test to confirm it IS loaded.
   */
  async isLoaded(): Promise<boolean> {
    return this.isAnyVisible(this.confirmationHeadingCandidates);
  }

  /**
   * Read the full visible body text of the confirmation page.
   *
   * WHY THIS IS THE PRIMARY ASSERTION METHOD
   * The confirmation page does not use data-testid attributes for individual
   * booking details (scan name, office, times). Reading the entire body text
   * and asserting against it is:
   *   - More robust than class-based selectors that can break on redesigns.
   *   - More flexible: the spec can assert any combination of values.
   *   - Easier to debug: the full text is visible in failure messages.
   *
   * USAGE IN THE SPEC
   * ```ts
   * const pageText = await confirmationPage.getPageText();
   * expect(pageText).toContain('MRI Scan');
   * expect(pageText).toContain('North Irvine');
   * expect(pageText).toContain('May 4');   // dynamic date from scheduling
   * expect(pageText).toContain('8:30 AM'); // dynamic slot from scheduling
   * ```
   *
   * @returns  The full visible text content of the page body.
   */
  async getPageText(): Promise<string> {
    return this.page.locator('body').innerText();
  }

  /**
   * Read the visible booking id or confirmation number text.
   *
   * The staging confirmation page may not always show a traditional booking id.
   * This method tries several common patterns. If none are found, it returns
   * an empty string rather than throwing — callers that need a booking id can
   * assert on the return value's length.
   */
  async getBookingId(): Promise<string> {
    const candidates = [
      this.page.locator('[data-testid="booking-id"]'),
      this.page.locator('[data-testid="confirmation-id"]'),
      this.page.getByText(/booking id|reference|confirmation number/i).locator('..'),
    ];

    try {
      const locator = await this.firstVisible(candidates, 'booking id', 4_000);
      return (await locator.innerText()).trim();
    } catch {
      // Some confirmation pages do not expose a booking id at all.
      // Return empty so the caller can decide whether to fail.
      return '';
    }
  }
}
