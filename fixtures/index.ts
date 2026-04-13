/**
 * =============================================================================
 * fixtures/index.ts | Shared Playwright fixtures for the Ezra booking test suite
 * =============================================================================
 *
 * This file is the "starter kit" for the tests.
 *
 * SIMPLE IDEA
 * A Playwright test always gets a raw browser page.
 * That raw page is useful, but it is a little too low-level for this project.
 * Instead of making every test build its own page objects again and again,
 * they are created here one time and handed to the tests as fixtures.
 *
 * WHY THIS HELPS
 * - test files stay shorter
 * - the test intent is easier to read
 * - page object setup stays in one place
 * - TypeScript can tell each test exactly what it receives
 *
 * HOW AUTH IS HANDLED
 * The staging environment requires a member account before the booking flow is
 * accessible. The scanPage fixture performs signup before handing the page
 * object to the test. Because all fixtures in a single test share the same
 * `page` instance, the authenticated session carries through to every other
 * fixture the test uses — schedulingPage, paymentPage, confirmationPage, etc.
 *
 * Every test in this suite reaches the booking flow via scanPage.goto(), so
 * putting signup here means no spec file needs to request it explicitly, and
 * there is no void fixture type to worry about (void in a TypeScript
 * intersection type collapses the whole type to never).
 * =============================================================================
 */

import { test as base } from '@playwright/test';
import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
} from '@playwright/test';
import {
  ConfirmationPage,
  PaymentPage,
  ScanSelectionPage,
  SchedulingPage,
  SignupPage,
} from '../pages';
import { generateTestUser, type TestUser } from '../utils/testData';

/**
 * BookingFixtures tells TypeScript which custom helpers a test can request.
 *
 * Example:
 * If a test writes `async ({ scanPage, paymentPage }) => { ... }`,
 * TypeScript uses this type to understand what those two names mean.
 */
type BookingFixtures = {
  /** Unique test user generated for each test run. */
  testUser: TestUser;

  /** Signup page object — available when a test needs to drive signup directly. */
  signupPage: SignupPage;

  /** Step 1 page object for the Member Facing Portal. */
  scanPage: ScanSelectionPage;

  /** Step 2 page object for choosing the office and appointment slots. */
  schedulingPage: SchedulingPage;

  /** Step 3 page object for payment. */
  paymentPage: PaymentPage;

  /** Post-payment page object for the success state. */
  confirmationPage: ConfirmationPage;


};

/**
 * `test` is the version of Playwright's test function used across this repo.
 *
 * The base Playwright test is extended so each spec gets the page objects below.
 * The fixture functions are intentionally tiny. Their job is just to create the
 * right object and pass it into the test.
 */
export const test = base.extend<BookingFixtures>({
  /**
   * Generate a unique test user once per test.
   * The timestamp in the last name and email ensures no two runs collide.
   */
  testUser: async ({}, use) => {
    await use(generateTestUser());
  },

  /**
   * Build the signup page object.
   */
  signupPage: async ({ page }, use) => {
    await use(new SignupPage(page));
  },

  /**
   * Build the scan-selection page object.
   *
   * WHY SIGNUP HAPPENS HERE
   * The staging environment requires a member account before the booking flow
   * is accessible. Every test in the suite enters the booking flow through
   * scanPage, so performing signup inside this fixture means every test gets
   * an authenticated session automatically — no spec file needs to ask for it,
   * and no void-typed auto fixture is needed (which would collapse the
   * TypeScript intersection type to never).
   *
   * After signup completes, scanPage.goto() in the test body navigates to the
   * booking start path with a live session already in place.
   */
  scanPage: async ({ page, testUser }, use) => {
    const signupPage = new SignupPage(page);
    await signupPage.goto();
    await signupPage.completeSignup(testUser);
    await use(new ScanSelectionPage(page));
  },

  /**
   * Build the scheduling page object.
   */
  schedulingPage: async ({ page }, use) => {
    const schedulingPage = new SchedulingPage(page);
    await use(schedulingPage);
  },

  /**
   * Build the payment page object.
   */
  paymentPage: async ({ page }, use) => {
    const paymentPage = new PaymentPage(page);
    await use(paymentPage);
  },

  /**
   * Build the confirmation page object.
   */
  confirmationPage: async ({ page }, use) => {
    const confirmationPage = new ConfirmationPage(page);
    await use(confirmationPage);
  },

});

/**
 * Re-export `expect` so every test can import from one place.
 *
 * That keeps the test imports simple:
 * `import { test, expect } from '../fixtures';`
 */
export { expect } from '@playwright/test';

/**
 * Combined parameter type for all booking test callbacks.
 *
 * WHY THIS EXPORT EXISTS
 * In TypeScript strict mode (noImplicitAny), the compiler must be able to
 * infer the exact type of every destructured fixture parameter.
 *
 * WHY IT IS WRITTEN AS A MANUAL INTERSECTION
 * Playwright 1.59+ added a three-argument test overload (title, details, body).
 * The old `Parameters<Parameters<typeof test>[1]>[0]` extraction breaks because
 * index [1] now resolves to TestDetails (an object) rather than the body
 * function. Constructing the intersection directly avoids the overload ambiguity
 * and works across all Playwright versions.
 *
 * USAGE IN TEST FILES
 * ```
 * import { test, expect, type BookingTestArgs } from '../fixtures';
 *
 * test('my test', async ({ scanPage, paymentPage }: BookingTestArgs) => {
 *   // TypeScript knows the exact type of every fixture here.
 * });
 * ```
 */
export type BookingTestArgs =
  PlaywrightTestArgs &
  PlaywrightTestOptions &
  BookingFixtures &
  PlaywrightWorkerArgs &
  PlaywrightWorkerOptions;
