/**
 * =============================================================================
 * BasePage.ts | Shared foundation for every page object in this Ezra project
 * =============================================================================
 *
 * This class is the toolbox that the other page objects share.
 *
 * WHY IT EXISTS
 * If every page object had to re-write the same helper code, the repo would get
 * noisy fast. The BasePage keeps the common behavior in one home.
 *
 * WHAT IT HANDLES
 * - storing the Playwright page instance
 * - finding a safe "continue" style button
 * - waiting for the page to become usable (element-based, not load-state based)
 * - trying several locator options in order
 * - reading text from the first locator that really exists
 *
 * WAIT STRATEGY (CRITICAL DESIGN DECISION)
 * This project avoids fixed sleeps and generic `waitForLoadState` calls.
 * Instead, every wait targets a SPECIFIC condition:
 *   - An element becoming visible  (`.waitFor({ state: 'visible' })`)
 *   - A URL changing               (`page.waitForURL(...)`)
 *   - A polling condition resolving (`expect.poll(...)`)
 *
 * Playwright auto-waits on actions (click, fill) for actionability. The
 * explicit waits here exist only where the test needs to observe a state
 * change before the NEXT action — not to "make the page ready" generically.
 *
 * WHY THE MULTI-LOCATOR APPROACH MATTERS
 * Not every exact DOM detail was available before building the suite.
 * A practical approach works best: each page object defines a short list of
 * possible selectors, then uses the first one that is truly there.
 *
 * That is safer than pretending one guessed selector will always be correct.
 * =============================================================================
 */

import { Locator, Page } from '@playwright/test';

export class BasePage {
  /**
   * The raw Playwright browser page.
   * Every child page object inherits this.
   */
  readonly page: Page;

  /**
   * A shared locator for the main forward-moving button in the flow.
   * Different screens may say Continue, Next, Reserve, Pay, or Submit.
   */
  readonly continueButton: Locator;

  /**
   * Save the shared browser page and create the common continue button locator.
   */
  constructor(page: Page) {
    this.page = page;
    // Exclude step-nav buttons (class "step__btn") at the CSS selector level.
    // These are disabled progress-indicator buttons like "Reserve your appointment"
    // that match the name pattern. filter({ hasNot }) checks for DESCENDANTS
    // matching the class — it does not exclude the element itself — so CSS
    // :not(.step__btn) is the correct way to drop them from the match set.
    this.continueButton = page
      .locator('button:not(.step__btn)')
      .filter({ hasText: /continue|next|reserve|pay now|pay|submit/i })
      .first();
  }

  /**
   * Wait until the page content area is rendered and interactive.
   *
   * WHY THIS DOES NOT USE waitForLoadState
   * `waitForLoadState('domcontentloaded')` fires once per navigation but means
   * nothing in a SPA where Vue/React patches the DOM asynchronously.
   * `waitForLoadState('networkidle')` blocks on a 500ms gap with zero inflight
   * requests — impossible in apps with background polling, analytics, or
   * WebSocket heartbeats. Both are anti-patterns that cause either flaky
   * timeouts or false confidence.
   *
   * WHAT THIS DOES INSTEAD
   * Waits for the visible <body> — the minimal signal that the browser has
   * painted something. Callers that need a SPECIFIC element should wait for
   * that element directly (e.g. `page.getByRole('heading').waitFor()`).
   *
   * The naming is kept for backward compatibility. All call sites that
   * previously relied on `networkidle` now get a fast, deterministic check.
   */
  async waitForPageReady(): Promise<void> {
    await this.page.locator('body').waitFor({ state: 'visible' });
  }

  /**
   * Wait for a specific landmark element to prove the page transition completed.
   *
   * WHY THIS EXISTS
   * After a navigation or a route transition in a SPA, the fastest way to know
   * "the new page is ready" is to wait for a SPECIFIC element that only exists
   * on the destination page. This is more deterministic than `waitForLoadState`
   * (which measures generic browser events) or fixed sleeps (which waste time).
   *
   * USAGE
   * ```ts
   * // After clicking Continue, wait for the scheduling heading to appear:
   * await this.waitForLandmark(
   *   this.page.getByRole('heading', { name: /schedule your scan/i }),
   * );
   * ```
   *
   * @param landmark  A Playwright Locator for an element unique to the target page.
   * @param timeout   Maximum ms to wait. Defaults to the test's action timeout.
   */
  async waitForLandmark(landmark: Locator, timeout = 10_000): Promise<void> {
    await landmark.waitFor({ state: 'visible', timeout });
  }

  /**
   * Return the first visible locator from a list of candidates.
   *
   * Each page object provides a prioritized list of locator candidates for a
   * given element. This helper checks them in order and returns the first one
   * that is visible. Candidates are ordered from most specific to most generic.
   *
   * If none are visible, the helper throws a detailed error identifying which
   * element description failed, so the correct page object can be updated.
   *
   * WHY THE TIMEOUT APPROACH
   * Each candidate gets a short window to appear. The window defaults to the
   * Playwright config action timeout (10s in this project) so it stays
   * consistent with the framework's own actionability checks. Callers can
   * still pass a tighter or longer value when a specific interaction demands it.
   */
  protected async firstVisible(
    candidates: Locator[],
    description: string,
    timeout = 10_000,
  ): Promise<Locator> {
    for (const candidate of candidates) {
      const locator = candidate.first();

      try {
        await locator.waitFor({ state: 'visible', timeout });
        return locator;
      } catch {
        // This candidate was not the right one.
        // Keep checking the next possible locator.
      }
    }

    throw new Error(
      `Could not find a visible element for: ${description}. ` +
      'Update the selector candidates in the page object for the real Ezra DOM.',
    );
  }

  /**
   * Click the first visible candidate from a list.
   *
   * This helper is just `firstVisible()` plus `.click()`.
   * Keeping it here avoids repeating the same two-line pattern everywhere.
   */
  protected async clickFirstVisible(
    candidates: Locator[],
    description: string,
    timeout = 10_000,
  ): Promise<void> {
    const locator = await this.firstVisible(candidates, description, timeout);
    await locator.click();
  }

  /**
   * Fill the first visible input candidate with a value.
   */
  protected async fillFirstVisible(
    candidates: Locator[],
    value: string,
    description: string,
    timeout = 10_000,
  ): Promise<void> {
    const locator = await this.firstVisible(candidates, description, timeout);

    // Clear and type the value into the first good input that appears.
    await locator.fill(value);
  }

  /**
   * Read text from the first visible candidate.
   *
   * This is used for summaries, totals, booking ids, and error messages.
   */
  protected async readTextFromFirstVisible(
    candidates: Locator[],
    description: string,
    timeout = 10_000,
  ): Promise<string> {
    const locator = await this.firstVisible(candidates, description, timeout);
    return locator.innerText();
  }

  /**
   * Select a value from a custom combobox dropdown.
   *
   * WHY THIS EXISTS
   * The Ezra scheduling and scan-selection pages use custom combobox components
   * (role="combobox") instead of native `<select>` elements. The native Playwright
   * `selectOption()` does not work on these. The correct interaction pattern is:
   *   1. Click the combobox trigger to open the dropdown listbox.
   *   2. Wait for the matching option to become visible.
   *   3. Click that option.
   *
   * WAIT PATTERN
   * - The combobox itself is waited on with `.waitFor({ state: 'visible' })`.
   * - After the click, the option list animates open. The option locator uses
   *   `.waitFor()` to detect when the dropdown has rendered the matching item.
   * - No fixed sleep — the waits are bound to actual DOM events.
   *
   * @param value             The visible option text to select (matched case-insensitively).
   * @param comboboxLocator   Optional: a specific combobox locator. Defaults to the first
   *                          combobox on the page, which is safe when only one exists.
   */
  protected async selectFromCombobox(value: string, comboboxLocator?: Locator): Promise<void> {
    const combobox = comboboxLocator || this.page.getByRole('combobox').first();

    // Wait for the combobox trigger to be visible before clicking.
    await combobox.waitFor({ state: 'visible' });
    await combobox.click();

    // Strategy 1: standard ARIA option role (works with fully accessible dropdowns).
    const ariaOption = this.page.getByRole('option', { name: new RegExp(value, 'i') });
    try {
      await ariaOption.first().waitFor({ state: 'visible', timeout: 2_000 });
      await ariaOption.first().click();
      return;
    } catch {
      // Options do not have role="option" — fall through to text-based strategies.
    }

    // Strategy 2: Vue multiselect renders options as <span> elements inside
    // a `.multiselect__content` container without standard ARIA roles.
    // Match the visible option text directly.
    const textOption = this.page.getByText(value, { exact: true });
    try {
      await textOption.first().waitFor({ state: 'visible', timeout: 2_000 });
      await textOption.first().click();
      return;
    } catch {
      // Text-based match also failed — try the listbox item fallback.
    }

    // Strategy 3: some dropdowns use listitem or generic elements.
    const listOption = this.page.locator(`li, [role="listbox"] *`).filter({ hasText: new RegExp(`^${value}$`, 'i') });
    await listOption.first().waitFor({ state: 'visible', timeout: 3_000 });
    await listOption.first().click();
  }

  /**
   * Check whether any locator in a list is visible.
   *
   * This returns a simple true or false answer and avoids failing loudly.
   * It is useful for polling logic where the page may still be changing.
   */
  protected async isAnyVisible(candidates: Locator[]): Promise<boolean> {
    for (const candidate of candidates) {
      try {
        if (await candidate.first().isVisible()) {
          return true;
        }
      } catch {
        // Some candidates may be detached or not present yet.
        // That is okay. Just keep checking the rest.
      }
    }

    return false;
  }
}
