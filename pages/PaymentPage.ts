/**
 * =============================================================================
 * PaymentPage.ts | Reserve your appointment
 * =============================================================================
 *
 * This file handles the last step before a booking is considered successful.
 * That makes it one of the most important files in the project.
 *
 * WHAT THIS PAGE OBJECT NEEDS TO HANDLE
 * - reading the booking summary
 * - reading the total amount
 * - typing into Stripe card fields inside an iframe
 * - submitting payment
 * - checking for failure messages
 * - checking for loading states that help block double submit problems
 *
 * IMPORTANT REAL-WORLD NOTE
 * Stripe often puts its card fields inside one or more iframes.
 * That means the test cannot treat the card fields like normal inputs on the
 * main page. It has to step into the Stripe frame first.
 * =============================================================================
 */

import { expect, FrameLocator, Locator, Page } from '@playwright/test';
import { isSuccessfulBookingUrl } from '../utils/urlMatchers';
import { BasePage } from './BasePage';

/**
 * Shape of the card data used by the fillCard helper.
 */
type CardInput = {
  number: string;
  expiry: string;
  cvc: string;
  zip?: string;
};

export class PaymentPage extends BasePage {
  /** Stripe iframe locator. This is where the secure payment fields live. */
  readonly stripeFrame: FrameLocator;

  /** Candidate locators for the booking-summary area. */
  readonly bookingSummaryCandidates: Locator[];

  /** Candidate locators for the total amount. */
  readonly totalAmountCandidates: Locator[];

  /** Main payment submit button. */
  readonly submitButton: Locator;

  /** Candidate locators for inline payment errors. */
  readonly inlineErrorCandidates: Locator[];

  /** Candidate locators for loading or processing signals. */
  readonly loadingCandidates: Locator[];

  /**
   * Create all locator groups for the payment page.
   */
  constructor(page: Page) {
    super(page);

    // -------------------------------------------------------------------------
    // STRIPE IFRAME ARCHITECTURE — READ BEFORE CHANGING THIS SELECTOR
    // -------------------------------------------------------------------------
    //
    // Stripe embeds its payment fields inside one or more iframes.
    // The number of iframes depends on which Stripe product is in use:
    //
    //   Payment Element (current default, recommended by Stripe)
    //   - All fields (card number, expiry, CVC, postal code) live inside ONE
    //     unified iframe. The selector below targets that single iframe.
    //   - The `title` attribute is typically "Secure payment input frame".
    //   - This is what `this.stripeFrame` is designed to work with.
    //
    //   Stripe Elements (older, per-field API)
    //   - Each field lives in its OWN separate iframe.
    //   - `this.stripeFrame` would only point to one of them, and all three
    //     card fields would fail to find their inputs.
    //   - If the real Ezra implementation uses per-field iframes, this page
    //     object needs to be updated to use separate FrameLocator instances:
    //       cardFrame = page.frameLocator('[title*="card number" i]')
    //       expiryFrame = page.frameLocator('[title*="expiration" i]')
    //       cvcFrame = page.frameLocator('[title*="security code" i]')
    //
    // HOW TO CONFIRM WHICH STRIPE API EZRA USES
    // Open DevTools while on the Reserve Your Appointment page.
    // Count the iframes that contain "stripe" in their src or name.
    // One iframe → Payment Element (single-iframe path, current code works).
    // Multiple iframes → Elements per-field (multi-iframe path, needs update).
    // -------------------------------------------------------------------------
    // Stripe injects its iframe with names like "__privateStripeFrame67714".
    // The name always contains "Stripe" (capital S), so both lowercase and
    // mixed-case variants are listed here to survive Stripe SDK version changes.
    this.stripeFrame = page
      .locator(
        'iframe[name*="stripe"], iframe[name*="Stripe"], iframe[title*="Secure payment input" i], iframe[src*="js.stripe.com"], iframe',
      )
      .first()
      .contentFrame();

    this.bookingSummaryCandidates = [
      page.locator('[data-testid="booking-summary"]'),
      page.locator('[data-testid="payment-summary"]'),
      page.getByText(/on one of the following dates/i).locator('xpath=ancestor::div[2]'),
      page.getByText(/north irvine/i).locator('xpath=ancestor::div[2]'),
      page.getByText(/MRI Scan/i).locator('xpath=ancestor::div[2]'),
      page.getByText(/north irvine/i).locator('xpath=ancestor::div[3]'),
      page.getByText(/MRI Scan/i).locator('xpath=ancestor::div[3]'),
    ];

    this.totalAmountCandidates = [
      page.locator('[data-testid="total-amount"]'),
      page.getByText(/^total$/i).locator('xpath=ancestor::div[1]'),
      page.getByText(/have a promo code\? use it here\./i).locator('xpath=ancestor::div[1]'),
      page.locator('[class*="total"]'),
    ];

    // The Ezra app marks its primary CTA with data-test="submit".
    // Prefer that over the role-based selector so we match the exact intended target.
    this.submitButton = page.locator('[data-test="submit"]').or(
      page.getByRole('button', { name: /continue|pay now|pay|submit payment|reserve/i }),
    ).first();

    this.inlineErrorCandidates = [
      page.locator('[data-testid="payment-error"]'),
      this.stripeFrame.getByText(/card was declined|your card was declined|insufficient funds|payment failed|unable to process|declined/i),
      this.stripeFrame.locator('[role="alert"]'),
      page.getByText(/card was declined|your card was declined|insufficient funds|payment failed|unable to process/i),
      page.locator('[role="alert"]'),
      page.locator('[class*="error"]'),
    ];

    this.loadingCandidates = [
      page.locator('[data-testid="loading-overlay"]'),
      page.locator('.loading-spinner'),
      page.locator('.loading'),
      page.getByText(/processing|loading|please wait/i),
    ];
  }

  /**
   * Candidate locators for the Stripe card number field.
   */
  private cardNumberCandidates(): Locator[] {
    return [
      // Role-based locator confirmed working via live browser recording.
      this.stripeFrame.getByRole('textbox', { name: /card number/i }),
      this.stripeFrame.locator('[name="cardnumber"]'),
      this.stripeFrame.getByPlaceholder(/card number/i),
      this.stripeFrame.getByLabel(/card number/i),
    ];
  }

  /**
   * Candidate locators for the Stripe expiry field.
   */
  private expiryCandidates(): Locator[] {
    return [
      this.stripeFrame.getByRole('textbox', { name: /expir/i }),
      this.stripeFrame.locator('[name="exp-date"]'),
      this.stripeFrame.getByPlaceholder(/MM\s*\/\s*YY/i),
      this.stripeFrame.getByLabel(/expiration|expiry/i),
    ];
  }

  /**
   * Candidate locators for the Stripe security-code field.
   */
  private cvcCandidates(): Locator[] {
    return [
      this.stripeFrame.getByRole('textbox', { name: /cvc|cvv|security/i }),
      this.stripeFrame.locator('[name="cvc"]'),
      this.stripeFrame.getByPlaceholder(/CVC|CVV/i),
      this.stripeFrame.getByLabel(/cvc|cvv|security code/i),
    ];
  }

  /**
   * Candidate locators for the Stripe postal-code field.
   *
   * This field is sometimes present and sometimes not, depending on Stripe setup.
   */
  private postalCodeCandidates(): Locator[] {
    return [
      this.stripeFrame.getByRole('textbox', { name: /zip|postal/i }),
      this.stripeFrame.locator('[name="postalCode"]'),
      this.stripeFrame.getByPlaceholder(/ZIP|Postal/i),
      this.stripeFrame.getByLabel(/zip|postal/i),
    ];
  }

  /**
   * Fill a single Stripe field inside the iframe.
   *
   * WHY A SPECIAL HELPER EXISTS FOR STRIPE FIELDS
   * Stripe's iframe inputs can intercept standard Playwright `fill()` events
   * in some SDK versions. This helper tries `fill()` first (fastest, most
   * reliable) and falls back to `pressSequentially()` (character-by-character
   * typing) if the first attempt fails. That makes the card fill resilient
   * across Stripe SDK version changes without requiring manual intervention.
   *
   * @param candidates   Locator candidates for the Stripe field.
   * @param value        The value to type into the field.
   * @param description  A human-readable label for error messages.
   * @param timeout      How long to wait for the field to appear.
   */
  private async fillStripeField(
    candidates: Locator[],
    value: string,
    description: string,
    timeout = 8_000,
  ): Promise<void> {
    const locator = await this.firstVisible(candidates, description, timeout);

    // Click the field first to ensure it has focus — Stripe inputs sometimes
    // ignore programmatic fill() unless the field is already focused.
    await locator.click();

    try {
      await locator.fill(value);
    } catch {
      // Stripe may block programmatic fill() in some versions.
      // Fall back to character-by-character typing which triggers real key events.
      await locator.pressSequentially(value, { delay: 60 });
    }
  }

  /**
   * Fill the Stripe card fields.
   *
   * FLOW
   * 1. Enter card number
   * 2. Enter expiry date
   * 3. Enter CVC
   * 4. Try postal code if the current Stripe setup asks for it
   *
   * Each field uses the fillStripeField helper which handles both standard
   * fill() and character-by-character fallback for maximum compatibility.
   */
  async fillCard(card: CardInput): Promise<void> {
    await this.fillStripeField(this.cardNumberCandidates(), card.number, 'Stripe card number field', 8_000);
    await this.fillStripeField(this.expiryCandidates(), card.expiry, 'Stripe expiry field', 8_000);
    await this.fillStripeField(this.cvcCandidates(), card.cvc, 'Stripe CVC field', 8_000);

    if (card.zip) {
      try {
        await this.fillStripeField(this.postalCodeCandidates(), card.zip, 'Stripe postal code field', 3_000);
      } catch {
        // Postal code is optional in some Stripe layouts.
        // If the field is not there, that is fine.
      }
    }
  }

  /**
   * Click the main payment submit button in the normal safe way.
   */
  async submit(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
    await this.submitButton.click();
  }

  /**
   * Click the submit button with force.
   *
   * This helper imitates an impatient user who keeps clicking
   * even while the page is processing the original submission.
   */
  async forceSubmit(): Promise<void> {
    await this.submitButton.click({ force: true });
  }

  /**
   * Return true when the submit button is disabled.
   */
  async isSubmitDisabled(): Promise<boolean> {
    return this.submitButton.isDisabled();
  }

  /**
   * Return true when the page shows any loading or processing signal.
   */
  async hasLoadingSignal(): Promise<boolean> {
    return this.isAnyVisible(this.loadingCandidates);
  }

  /**
   * Read the visible booking summary.
   */
  async getSummaryText(): Promise<string> {
    return this.readTextFromFirstVisible(this.bookingSummaryCandidates, 'payment booking summary', 6_000);
  }

  /**
   * Read the visible total amount text.
   */
  async getTotalText(): Promise<string> {
    return this.readTextFromFirstVisible(this.totalAmountCandidates, 'payment total amount', 6_000);
  }

  /**
   * Wait for a failure state on the payment page.
   *
   * FLOW
   * 1. Keep polling the page state
   * 2. If the browser reaches a success URL, report "success"
   * 3. If an inline error appears, report "error"
   * 4. Keep waiting otherwise
   *
   * The assertion expects "error" because this helper is used by the declined
   * payment test, not the happy path.
   */
  async waitForFailureState(timeout = 30_000): Promise<void> {
    await expect
      .poll(async () => {
        if (isSuccessfulBookingUrl(this.page.url())) {
          return 'success';
        }

        if (await this.isAnyVisible(this.inlineErrorCandidates)) {
          return 'error';
        }

        return 'pending';
      }, {
        timeout,
        message: 'Expected the payment step to show a failure state without reaching success.',
      })
      .toBe('error');
  }

  /**
   * Read the visible payment failure text.
   */
  async getVisibleErrorText(): Promise<string> {
    return this.readTextFromFirstVisible(
      this.inlineErrorCandidates,
      'payment decline or failure message',
      5_000,
    );
  }
}
