/**
 * =============================================================================
 * SignupPage.ts | Member account creation at /join
 * =============================================================================
 *
 * The Ezra staging environment gates the booking flow behind authentication.
 * A new member must create an account at /join before accessing the scan
 * selection page. This page object drives that signup step.
 *
 * FIELDS HANDLED
 * - first name
 * - last name
 * - email
 * - phone number
 * - password
 * - submit
 *
 * HOW SELECTORS ARE CHOSEN
 * Candidates follow the same multi-locator pattern used throughout the project:
 * label-based first (most accessible and stable), then placeholder, then name
 * attribute, then type. The first candidate that is visible wins.
 * =============================================================================
 */

import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { TestUser } from '../utils/testData';

export class SignupPage extends BasePage {
  readonly firstNameCandidates: Locator[];
  readonly lastNameCandidates: Locator[];
  readonly emailCandidates: Locator[];
  readonly phoneCandidates: Locator[];
  readonly passwordCandidates: Locator[];

  /** Candidate locators for the terms/conditions checkbox. */
  readonly termsCandidates: Locator[];

  constructor(page: Page) {
    super(page);

    this.termsCandidates = [
      // The terms agreement is rendered as a <button> with the full terms text
      // as its accessible name. Role-based locator is the most reliable selector.
      page.getByRole('button', { name: /i agree to ezra/i }),
      // Fallback: class-based selectors for the checkbox-style button.
      page.locator('button.checkbox').first(),
      page.locator('button[class*="checkbox"]').first(),
      page.getByText(/i agree to.*terms/i).locator('..').locator('button'),
      page.locator('[class*="checkbox-wrapper"]').locator('button').first(),
    ];

    this.firstNameCandidates = [
      page.getByLabel(/first name/i),
      page.locator('input[name="firstName"]'),
      page.locator('input[name="first_name"]'),
      page.locator('input[placeholder*="first" i]'),
    ];

    this.lastNameCandidates = [
      page.getByLabel(/last name/i),
      page.locator('input[name="lastName"]'),
      page.locator('input[name="last_name"]'),
      page.locator('input[placeholder*="last" i]'),
    ];

    this.emailCandidates = [
      page.getByLabel(/email/i),
      page.locator('input[type="email"]'),
      page.locator('input[name="email"]'),
      page.locator('input[placeholder*="email" i]'),
    ];

    this.phoneCandidates = [
      // intl-tel-input wraps the real input in a div with aria-label containing
      // "phone" — skip getByLabel here so we don't land on the country picker.
      page.locator('input[type="tel"]'),
      page.locator('input[name="phone"]'),
      page.locator('input[name="phoneNumber"]'),
      page.locator('input[placeholder*="phone" i]'),
    ];

    this.passwordCandidates = [
      page.getByLabel(/^password$/i),
      page.locator('input[type="password"]'),
      page.locator('input[name="password"]'),
    ];
  }

  /** Navigate to the signup page. */
  async goto(): Promise<void> {
    await this.page.goto('/join');
    await this.waitForPageReady();
    await this.dismissCookieBanner();
  }

  /**
   * Dismiss the cookie consent banner if it is present.
   *
   * The banner sits in the bottom-left corner and can overlap form elements,
   * blocking clicks on checkboxes near the bottom of the page.
   */
  async dismissCookieBanner(): Promise<void> {
    try {
      const btn = this.page.getByRole('button', { name: /accept/i });
      await btn.waitFor({ state: 'visible', timeout: 3_000 });
      await btn.click();
    } catch {
      // Banner was not present — nothing to dismiss.
    }
  }

  /** Fill first name. */
  async fillFirstName(value: string): Promise<void> {
    await this.fillFirstVisible(this.firstNameCandidates, value, 'first name input');
  }

  /** Fill last name. */
  async fillLastName(value: string): Promise<void> {
    await this.fillFirstVisible(this.lastNameCandidates, value, 'last name input');
  }

  /** Fill email. */
  async fillEmail(value: string): Promise<void> {
    await this.fillFirstVisible(this.emailCandidates, value, 'email input');
  }

  /** Fill phone number. */
  async fillPhone(value: string): Promise<void> {
    await this.fillFirstVisible(this.phoneCandidates, value, 'phone input');
  }

  /** Fill password. */
  async fillPassword(value: string): Promise<void> {
    await this.fillFirstVisible(this.passwordCandidates, value, 'password input');
  }

  /** Check the terms and conditions checkbox. */
  async acceptTerms(): Promise<void> {
    // Scroll to the bottom of the page so the checkbox is in the viewport.
    // Many signup forms place the terms checkbox at the bottom of the form.
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Custom checkbox implementations often hide the real <input> behind a
    // styled sibling (opacity:0 / position:absolute). Try the visible check
    // first, then fall back to a force-click on the raw input.
    for (const candidate of this.termsCandidates) {
      try {
        const el = candidate.first();
        await el.waitFor({ state: 'attached', timeout: 3_000 });
        // force:true bypasses Playwright's visibility/overlap check.
        // Needed because (a) the cookie banner may still be in the DOM and
        // (b) the SVG button may not pass the standard actionability checks.
        await el.click({ force: true });
        return;
      } catch {
        // Try the next candidate.
      }
    }

    throw new Error(
      'Could not find a terms checkbox on the signup page. ' +
      'Update the selector candidates in SignupPage.ts.',
    );
  }

  /** Click the signup submit button. */
  async submit(): Promise<void> {
    await this.clickFirstVisible(
      [
        this.page.getByRole('button', { name: /sign up|create account|join|continue|next|get started|submit/i }),
        this.page.locator('button[type="submit"]'),
        this.page.locator('input[type="submit"]'),
      ],
      'signup submit button',
      6_000,
    );
  }

  /**
   * Fill all signup fields and submit the form, then wait for navigation away
   * from /join before returning.
   */
  async completeSignup(user: TestUser): Promise<void> {
    await this.fillFirstName(user.firstName);
    await this.fillLastName(user.lastName);
    await this.fillEmail(user.email);
    await this.fillPhone(user.phone);
    await this.fillPassword(user.password);
    await this.acceptTerms();
    await this.submit();

    // Wait until the app navigates away from the signup page, confirming the
    // account was created and the session is active.
    await this.page.waitForURL((url) => !url.pathname.includes('/join'), {
      timeout: 15_000,
    });
  }
}
