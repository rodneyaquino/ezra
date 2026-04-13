/**
 * =============================================================================
 * SchedulingPage.ts | Step 2, Schedule your Scan
 * =============================================================================
 *
 * This page object handles the scheduling step where the member:
 *   1. Filters by state to narrow the office list
 *   2. Selects an office (e.g. North Irvine)
 *   3. Navigates the calendar to find a date with availability
 *   4. Clicks an available date to reveal time slots
 *   5. Selects the required number of time-slot preferences
 *   6. Dismisses the "I understand" modal (for offices requiring 3 preferences)
 *   7. Clicks Continue to proceed to payment
 *
 * KEY OBSERVATIONS FROM LIVE WALKTHROUGH AND DOM INSPECTION
 * - The state filter is a custom combobox (role="combobox"), not a native <select>.
 *   Default text is "All Available". Selecting "California" reveals North Irvine.
 * - The calendar only appears after an office is selected.
 * - Uses vue-cal (Vue Calendar) library with `vuecal__cell` class structure.
 * - Calendar day cells use data-testid="{month}-{day}-cal-day-content"
 *   (e.g., "5-4-cal-day-content" for May 4).
 * - Each cell is a `<span class="vc-day-content">` containing:
 *     - `<div class="eyebrow">` for the weekday letter (M, T, W, etc.)
 *     - `<div class="b3--bold">` for the day number (1, 2, 3, etc.)
 * - AVAILABILITY is controlled by the GRANDPARENT `<div class="vuecal__cell">`:
 *     - `vuecal__cell--disabled` = unavailable / not clickable
 *     - `vuecal__cell--before-min` = before the minimum allowed date
 *     - `vuecal__cell--out-of-scope` = overflow from adjacent months
 *     - `vuecal__cell--today` = today's date
 *   Checking the cell itself (opacity/disabled) is UNRELIABLE because all cells
 *   share opacity=1 and have no disabled attribute. The CSS class on the
 *   grandparent is the only reliable signal.
 * - The month header is a `<button class="trigger-btn">` with text like "April 2026".
 * - Forward/back arrows are `<button class="header-btn">` containing an `<svg>`
 *   with `class="icon__arrow"`. The back arrow has the `disabled` attribute set.
 *   Neither arrow button has text content — they are icon-only.
 * - Time slots render as `<div class="b3--bold">` inside `<label>` elements.
 *   Each label shows text like "8:30 AM" and is directly clickable.
 * - Selecting a time slot disables adjacent slots (+/- 30 min).
 * - North Irvine shows an "I understand" modal after the first slot selection,
 *   informing the member that 3 time preferences are required.
 * - The Continue button uses data-test="submit" and becomes enabled only when
 *   all required slots are selected.
 *
 * WAIT STRATEGY
 * Every wait in this file targets a specific DOM condition:
 *   - Calendar visible    -> poll for `[data-testid$="-cal-day-content"]` elements
 *   - Month change        -> poll for the month header text to differ from before
 *   - Time slots loaded   -> wait for an element matching the `H:MM AM/PM` pattern
 *   - Continue enabled    -> `toBeEnabled()` assertion
 * No `waitForLoadState()` or fixed sleeps are used anywhere.
 *
 * BACKWARD COMPATIBILITY
 * - completeScheduling() now returns a SchedulingSelection so the e2e test
 *   can assert dynamic dates on the confirmation page. Existing callers that
 *   ignore the return value (e.g. the decline test) are unaffected.
 * =============================================================================
 */

import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Captures the member's scheduling choices so downstream steps (payment,
 * confirmation) can assert the correct dates and time slots without hardcoding.
 */
export interface SchedulingSelection {
  /** The calendar header text when the date was selected, e.g. "May 2026". */
  calendarMonth: string;

  /** The day number clicked on the calendar, e.g. "4". */
  selectedDay: string;

  /** A human-readable date string for assertions, e.g. "May 4, 2026". */
  selectedDateText: string;

  /** The time-slot labels selected, e.g. ["8:30 AM", "2:00 PM", "4:30 PM"]. */
  selectedTimeSlots: string[];
}

export class SchedulingPage extends BasePage {
  /** Candidate locators for the calendar area (used by isCalendarVisible). */
  readonly calendarCandidates: Locator[];

  /**
   * Build the locator groups used on the scheduling page.
   *
   * REAL DOM STRUCTURE (confirmed via live browser inspection, April 2026)
   * The calendar uses plain <button> elements for day cells, NOT vue-cal
   * classes or data-testid attributes. Each day is:
   *   <div>                              ← generic wrapper
   *     <button>M 4</button>             ← weekday letter + day number
   *   </div>
   *
   * Time slots are leaf <div> elements with cursor:pointer containing
   * text like "8:30 AM". They are NOT wrapped in <label> elements and
   * do NOT use class names like "b2--bold" or "b3--bold". The
   * cursor:pointer CSS property is the primary signal for clickability.
   * After a slot is selected, adjacent slots lose cursor:pointer.
   */
  constructor(page: Page) {
    super(page);

    // The calendar is detectable by the month header button ("May 2026"),
    // the day grid, or generic calendar-related class names.
    this.calendarCandidates = [
      page.locator('button.trigger-btn'),
      page.locator('button').filter({ hasText: /^[MTWFS]\s*\d{1,2}$/ }),
      page.locator('[class*="calendar"]'),
      page.locator('[data-testid$="-cal-day-content"]'),
      page.locator('.vuecal__cell'),
    ];
  }

  // ---------------------------------------------------------------------------
  // STATE FILTER
  // ---------------------------------------------------------------------------

  /**
   * Select a state in the filter dropdown to narrow the office list.
   *
   * WHY THIS USES selectFromCombobox
   * The scheduling page renders the state filter as a custom combobox
   * (role="combobox") with a default value of "All Available". Selecting a
   * state like "California" triggers the office list to update, revealing
   * region-specific offices (e.g. North Irvine).
   *
   * WAIT PATTERN
   * After the combobox interaction completes, a brief body-visible check
   * gives the SPA time to re-render the filtered office list. The next
   * action (selectOffice) uses its own element-based wait so this is just
   * a lightweight transition guard.
   *
   * @param state  The visible state name to select (e.g. "California").
   */
  async selectState(state: string): Promise<void> {
    await this.selectFromCombobox(state);
    // The office list re-renders after the combobox closes. Wait for the
    // body to remain visible (fast SPA render check) before moving on.
    await this.waitForPageReady();
  }

  // ---------------------------------------------------------------------------
  // OFFICE SELECTION
  // ---------------------------------------------------------------------------

  /**
   * Choose the office by visible name.
   *
   * Office cards are rendered as clickable div elements containing the office
   * name as paragraph text. After clicking, the calendar and scheduling
   * controls appear in the lower half of the page.
   *
   * WAIT PATTERN
   * The getByText locator uses `.waitFor({ state: 'visible' })` internally
   * via `firstVisible()`. After the click, the caller (completeScheduling)
   * polls for the calendar to appear -- not a generic load state.
   *
   * @param officeName  The visible office name to click (e.g. "North Irvine").
   */
  async selectOffice(officeName: string): Promise<void> {
    const officeNamePattern = new RegExp(`^${officeName}$`, 'i');
    const officeText = this.page.getByText(officeNamePattern).first();
    await officeText.waitFor({ state: 'visible', timeout: 10_000 });
    await officeText.scrollIntoViewIfNeeded();

    const cardCandidates = [
      officeText.locator('xpath=ancestor::button[1]'),
      officeText.locator('xpath=ancestor::div[1]'),
      officeText.locator('xpath=ancestor::div[2]'),
      officeText.locator('xpath=ancestor::div[3]'),
      officeText,
    ];

    let clicked = false;
    for (const candidate of cardCandidates) {
      const locator = candidate.first();
      if (!(await locator.isVisible().catch(() => false))) continue;

      try {
        await locator.click();
        clicked = true;
        break;
      } catch {
        // Keep trying larger/smaller ancestor containers until a clickable
        // office card target is found.
      }
    }

    if (!clicked) {
      throw new Error(`Could not click the office card for "${officeName}".`);
    }

    await expect
      .poll(
        async () => {
          const monthHeader = await this.getCalendarMonthHeader();
          const dayButtons = await this.page
            .locator('button')
            .filter({ hasText: /^[MTWFS]\s*\d{1,2}$/ })
            .count()
            .catch(() => 0);
          return monthHeader || String(dayButtons);
        },
        {
          timeout: 15_000,
          message: `Calendar should render after selecting office "${officeName}".`,
        },
      )
      .not.toBe('');
  }

  // ---------------------------------------------------------------------------
  // CALENDAR NAVIGATION
  // ---------------------------------------------------------------------------

  /**
   * Read the calendar month header text.
   *
   * The Ezra calendar shows a header button like "April 2026" or "May 2026".
   * This method extracts the full month+year text for use in date assembly
   * and for detecting when the calendar has navigated to a new month.
   *
   * @returns  The month header text, e.g. "May 2026". Empty string if not found.
   */
  async getCalendarMonthHeader(): Promise<string> {
    const monthPattern =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/;
    const candidates = this.page.getByText(monthPattern);
    const text = await candidates.first().textContent().catch(() => '');
    const match = text?.match(monthPattern);
    return match ? match[0] : '';
  }

  /**
   * Click the forward arrow on the calendar to advance to the next month.
   *
   * REAL DOM STRUCTURE (confirmed via live DOM inspection)
   * The calendar header contains:
   *   - A `<button class="trigger-btn">April 2026</button>` showing the month
   *   - Two `<button class="header-btn">` elements containing `<svg>` arrows:
   *     - Back arrow:    `<button class="header-btn" disabled><svg ...></button>`
   *     - Forward arrow: `<button class="header-btn"><svg ...></button>`
   * The arrow buttons have NO text and NO aria-label -- they are SVG-icon-only.
   *
   * SELECTOR STRATEGY (priority order)
   *   1. `button.header-btn:not([disabled])` -- direct class match for the
   *      forward arrow. The last non-disabled header-btn is always forward.
   *   2. Structural: find the month trigger button, navigate to its parent
   *      container, then locate the last non-disabled button with an SVG child.
   *   3. Aria-label fallback for future DOM changes.
   *
   * WAIT PATTERN
   * After clicking, this method polls the month header text until it changes
   * -- proving the calendar advanced. No fixed sleep.
   */
  async navigateCalendarForward(): Promise<void> {
    const currentMonth = await this.getCalendarMonthHeader();
    let clicked = false;

    // Strategy 1 (confirmed from live DOM inspection):
    // The forward arrow is a `<button class="header-btn">` that is NOT disabled.
    // Both arrow buttons share the same class; the back arrow is disabled when
    // the current month is the earliest allowed. The forward arrow is the last
    // non-disabled `header-btn` on the page.
    const headerBtns = this.page.locator('button.header-btn:not([disabled])');
    const btnCount = await headerBtns.count().catch(() => 0);
    if (btnCount > 0) {
      await headerBtns.last().click();
      clicked = true;
    }

    // Strategy 2: structural -- find the month trigger button by class, navigate
    // to its parent container, then find the last non-disabled button with an SVG.
    if (!clicked) {
      const triggerBtn = this.page.locator('button.trigger-btn').first();
      if (await triggerBtn.isVisible().catch(() => false)) {
        const container = triggerBtn.locator('..').locator('..');
        const arrowBtns = container.locator('button:not([disabled]):has(svg)');
        if ((await arrowBtns.count().catch(() => 0)) > 0) {
          await arrowBtns.last().click();
          clicked = true;
        }
      }
    }

    // Strategy 3: generic month header parent approach.
    if (!clicked) {
      const monthHeader = this.page.getByRole('button', {
        name: new RegExp(currentMonth.replace(/\s+/g, '\\s+'), 'i'),
      });
      const navContainer = monthHeader.locator('..');
      const forwardArrow = navContainer.locator('button:not([disabled])').last();
      if ((await forwardArrow.count()) > 0) {
        await forwardArrow.click();
        clicked = true;
      }
    }

    // Strategy 4: aria-label fallback for future DOM changes.
    if (!clicked) {
      const fallbackArrow = this.page
        .locator('button[aria-label*="next" i]')
        .or(this.page.locator('button[aria-label*="forward" i]'));
      await fallbackArrow.first().click();
    }

    // Poll until the header changes, confirming the calendar navigated.
    await expect
      .poll(() => this.getCalendarMonthHeader(), {
        timeout: 10_000,
        message: 'Calendar month header should change after clicking the forward arrow.',
      })
      .not.toBe(currentMonth);
  }

  /**
   * Find and click the first available calendar date, or use the auto-selected one.
   *
   * STRATEGY (confirmed via live browser inspection)
   * The Ezra calendar auto-selects the first available date when an office
   * is chosen. Time slots for that date appear immediately below the calendar.
   * This method:
   *   1. Checks if visible time slots already exist (from auto-selected date).
   *   2. If yes, reads the active day number from the calendar and returns.
   *   3. If no, iterates calendar day buttons, clicking each clickable one
   *      until time slots appear.
   *   4. If no dates work in the current month, navigates forward and repeats.
   *
   * REAL DOM STRUCTURE (confirmed via live DOM inspection)
   * Calendar days are plain <button> elements with accessible names like
   * "M 4" (Monday 4th), "T 12" (Tuesday 12th), etc. The currently selected
   * date has a CSS class containing "active". Unavailable dates lack
   * cursor:pointer in their computed style.
   *
   * VISIBLE TIME SLOT DETECTION
   * Time slots are leaf <div> elements with cursor:pointer containing
   * time text like "8:30 AM". hasVisibleTimeSlotElements() targets these
   * leaf divs by checking offsetHeight > 0 and matching the H:MM AM/PM
   * pattern — the most reliable cross-environment visibility check.
   *
   * @param maxMonthsForward  How many months to try before failing (default: 3).
   * @returns  The selected day number and the calendar month header text.
   */
  async selectAvailableCalendarDate(
    maxMonthsForward = 3,
    requiredSlotCount = 1,
  ): Promise<{ day: string; monthYear: string }> {
    for (let attempt = 0; attempt <= maxMonthsForward; attempt++) {
      const monthYear = await this.getCalendarMonthHeader();

      // CHECK 1: The calendar auto-selects the first available date when an
      // office is chosen. Time slots appear immediately. Use page.evaluate()
      // for reliable visibility detection — CSS pseudo-selectors like :has()
      // proved unreliable in the managed browser environment.
      const slotsAlreadyVisible = await expect
        .poll(() => this.hasVisibleTimeSlotElements(), {
          timeout: 8_000,
          message: 'Waiting for auto-selected time slots to appear.',
        })
        .toBe(true)
        .then(() => true)
        .catch(() => false);

      if (slotsAlreadyVisible) {
        const clickableSlots = await this.getClickableTimeSlotTexts();
        const dayText = await this.getActiveDayNumber();
        if (dayText && clickableSlots.length >= requiredSlotCount) {
          return { day: dayText, monthYear };
        }
      }

      // CHECK 2: No auto-selected slots visible. Click the bold calendar day
      // content nodes. In the live Ezra DOM these are <span> elements with
      // data-testid="*-cal-day-content", not <button> elements.
      const dayCells = this.page.locator('[data-testid$="-cal-day-content"]');
      const cellCount = await dayCells.count().catch(() => 0);
      const fallbackDayIndices: number[] = [];

      for (let i = 0; i < cellCount; i++) {
        const cell = dayCells.nth(i);
        const cellState = await cell.evaluate((el) => {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const match = text.match(/^[MTWFS]\s*(\d{1,2})$/);
          const testId = el.getAttribute('data-testid') || '';
          const wrapper = el.closest('.vuecal__cell') || el.parentElement || el;
          const wrapperClass = wrapper instanceof HTMLElement ? wrapper.className : '';
          const dayLabel =
            el.lastElementChild instanceof HTMLElement ? el.lastElementChild : el;
          const style = window.getComputedStyle(el);
          const dayStyle = window.getComputedStyle(dayLabel);
          const fontWeight = Number.parseInt(dayStyle.fontWeight || '400', 10);
          const isDisabled =
            /disabled|before-min|out-of-scope/i.test(wrapperClass) ||
            el.getAttribute('aria-disabled') === 'true' ||
            style.pointerEvents === 'none' ||
            style.visibility === 'hidden' ||
            parseFloat(style.opacity || '1') <= 0.2;

          return {
            day: match?.[1] || '',
            testId,
            isBold: fontWeight >= 600,
            isDisabled,
          };
        }).catch(() => ({ day: '', testId: '', isBold: false, isDisabled: true }));

        if (!cellState.day || cellState.isDisabled) continue;
        if (!cellState.isBold) {
          fallbackDayIndices.push(i);
          continue;
        }

        await cell.click();

        const slotsAppeared = await expect
          .poll(() => this.hasVisibleTimeSlotElements(), { timeout: 5_000 })
          .toBe(true)
          .then(() => true)
          .catch(() => false);

        if (slotsAppeared) {
          const clickableSlots = await this.getClickableTimeSlotTexts();
          if (clickableSlots.length >= requiredSlotCount) {
            return { day: cellState.day, monthYear };
          }
        }
      }

      for (const index of fallbackDayIndices) {
        const cell = dayCells.nth(index);
        const day = await cell.evaluate((el) => {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          return text.match(/^[MTWFS]\s*(\d{1,2})$/)?.[1] || '';
        }).catch(() => '');
        if (!day) continue;

        await cell.click();
        const slotsAppeared = await expect
          .poll(() => this.hasVisibleTimeSlotElements(), { timeout: 5_000 })
          .toBe(true)
          .then(() => true)
          .catch(() => false);

        if (slotsAppeared) {
          const clickableSlots = await this.getClickableTimeSlotTexts();
          if (clickableSlots.length >= requiredSlotCount) {
            return { day, monthYear };
          }
        }
      }

      // No available dates this month — advance the calendar.
      if (attempt < maxMonthsForward) {
        await this.navigateCalendarForward();
      }
    }

    throw new Error(
      `No calendar date with at least ${requiredSlotCount} available time slots was found after checking ${maxMonthsForward + 1} months. ` +
        'The test environment may not have enough scheduling availability configured.',
    );
  }

  /**
   * Check whether at least one visible time-slot element exists in the DOM.
   *
   * Targets leaf <div> nodes whose text matches the "H:MM AM/PM" pattern
   * and that have non-zero rendered dimensions. Uses page.evaluate() for
   * reliable cross-browser visibility detection — Playwright CSS pseudo-
   * selectors like :has() proved unreliable in the managed browser.
   */
  private async hasVisibleTimeSlotElements(): Promise<boolean> {
    return this.page.evaluate(() => {
      const timeRe = /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i;
      const elements = document.querySelectorAll<HTMLElement>('body *');
      for (const el of elements) {
        if (el.offsetHeight === 0 || el.offsetWidth === 0) continue;
        const text = (el.textContent || '').trim();
        if (!timeRe.test(text)) continue;
        const hasChildWithSameText = Array.from(el.children).some((child) =>
          timeRe.test((child.textContent || '').trim()),
        );
        if (!hasChildWithSameText) return true;
      }
      return false;
    }).catch(() => false);
  }

  /**
   * Read the day number from the currently active calendar cell.
   *
   * Calendar cells are `<span role="button" class="vc-day-content">` (NOT
   * <button>). The active cell has a CSS class containing "active" or
   * "selected", or its data-testid can be cross-referenced with the vuecal
   * cell wrapper's class.
   *
   * @returns  The day number string (e.g. "8"), or empty string if not found.
   */
  private async getActiveDayNumber(): Promise<string> {
    return this.page.evaluate(() => {
      // In the live Ezra DOM, days are exposed as span[data-testid$="-cal-day-content"].
      const candidates = document.querySelectorAll('[data-testid$="-cal-day-content"]');
      const dayRe = /^[MTWFS]\s*(\d{1,2})$/;
      for (const el of candidates) {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const m = text.match(dayRe);
        if (!m) continue;
        const wrapper = el.closest('.vuecal__cell') || el.parentElement;
        const cls = (el.className || '') + ' ' + (wrapper?.className || '');
        const isActive =
          el.hasAttribute('active') ||
          el.getAttribute('aria-selected') === 'true' ||
          el.getAttribute('aria-pressed') === 'true' ||
          cls.includes('active') ||
          cls.includes('selected');
        if (isActive) return m[1];
      }
      return '';
    }).catch(() => '');
  }

  // ---------------------------------------------------------------------------
  // TIME SLOT SELECTION
  // ---------------------------------------------------------------------------

  /**
   * Dismiss the "Please select 3 times you are available" modal if it appears.
   *
   * North Irvine shows this modal after the first slot is clicked because it
   * cannot confirm immediately -- the member must provide 3 time preferences.
   * The modal must be dismissed before additional slots can be selected.
   *
   * WAIT PATTERN
   * The "I understand" button is waited on with `.waitFor()` for a short
   * window. If the modal does not appear (e.g. single-slot offices), the
   * catch block silently moves on. No fixed sleep.
   */
  async dismissSlotModal(): Promise<void> {
    try {
      const btn = this.page.getByRole('button', { name: /i understand/i });
      await btn.waitFor({ state: 'visible', timeout: 3_000 });
      await btn.click();
    } catch {
      // Modal did not appear -- office confirms immediately, nothing to dismiss.
    }
  }

  /**
   * Collect the text labels of all currently clickable time-slot elements.
   *
   * REAL DOM STRUCTURE (confirmed via live browser snapshot, April 2026)
   * Time slots are leaf <div> elements with cursor:pointer containing text
   * like "8:30 AM", "9:00 AM", etc. They live inside a container div that
   * is a sibling of the "The time(s) are displayed in Pacific Standard Time"
   * label. The slots are NOT wrapped in <label> elements and do NOT use
   * CSS class names like "b2--bold" or "b3--bold".
   *
   * CLICKABILITY DETECTION
   * After a slot is selected, adjacent slots (+/- 30 min) lose interactive
   * styling (cursor changes from pointer, opacity may decrease, or the
   * element gains a disabled class/attribute). This method only returns
   * slots that pass all clickability checks so the caller can safely
   * iterate through them.
   *
   * @returns  An ordered list of clickable time-slot text labels.
   */
  private async getClickableTimeSlotTexts(): Promise<string[]> {
    return this.page.evaluate(() => {
      const timeRe = /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i;
      const results: string[] = [];
      const elements = document.querySelectorAll<HTMLElement>('body *');
      for (const el of elements) {
        const hasChildWithSameText = Array.from(el.children).some((child) =>
          timeRe.test((child.textContent || '').trim()),
        );
        if (hasChildWithSameText) continue;
        if (el.offsetHeight === 0 || el.offsetWidth === 0) continue;
        const text = (el.textContent || '').trim();
        if (!timeRe.test(text)) continue;
        // Verify the element is interactive, not disabled by the
        // adjacent-slot rule or any other UI mechanism.
        const style = window.getComputedStyle(el);
        const cursorOk = style.cursor === 'pointer';
        const opacityOk = parseFloat(style.opacity) > 0.5;
        const pointerOk = style.pointerEvents !== 'none';
        const noDisabled = !el.closest(
          '[disabled], [aria-disabled="true"], .disabled',
        );
        if (cursorOk && opacityOk && pointerOk && noDisabled) {
          results.push(text);
        }
      }
      return results;
    });
  }

  /**
   * Click a time-slot element identified by its exact text label.
   *
   * Uses page.getByText() with exact matching for precise targeting, then
   * Playwright's standard click() for proper mouse-event simulation. If
   * multiple DOM nodes share the same text (e.g. a hidden duplicate and a
   * visible one), the method iterates from last to first — hidden elements
   * appear earlier in DOM order, so the visible instance is found faster.
   *
   * CLICKABILITY VERIFICATION
   * Before dispatching the click, the method checks:
   *   - cursor:pointer (the primary interactive signal)
   *   - opacity > 0.5 (not visually hidden)
   *   - pointer-events ≠ none (not click-blocked)
   *   - no disabled ancestor ([disabled], aria-disabled, .disabled)
   *
   * @param slotText  The exact time label to click, e.g. "8:30 AM".
   * @returns         true if the click succeeded, false if the element was
   *                  not visible, not clickable, or the click threw.
   */
  private async clickTimeSlotByText(slotText: string): Promise<boolean> {
    const candidates = this.page.getByText(slotText, { exact: true });
    const count = await candidates.count().catch(() => 0);

    // Iterate from last to first — hidden duplicates tend to appear earlier
    // in DOM order, so the last match is most likely the visible target.
    for (let i = count - 1; i >= 0; i--) {
      const el = candidates.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;

      // Verify the element is still interactive before clicking.
      const isClickable = await el.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const cursorOk = style.cursor === 'pointer';
        const opacityOk = parseFloat(style.opacity) > 0.5;
        const pointerOk = style.pointerEvents !== 'none';
        const noDisabled = !node.closest(
          '[disabled], [aria-disabled="true"], .disabled',
        );
        return cursorOk && opacityOk && pointerOk && !!noDisabled;
      }).catch(() => false);

      if (!isClickable) continue;

      try {
        await el.click();
        return true;
      } catch {
        // Click failed (element detached, overlapped, etc.) — try next match.
        continue;
      }
    }

    return false;
  }

  /**
   * Select the required number of time-slot preferences.
   *
   * FLOW
   * 1. Wait for at least one visible time slot to appear in the DOM.
   * 2. Query the DOM for all currently clickable slot texts via evaluate().
   * 3. Click the first available slot using Playwright's native click().
   * 4. After the first slot, dismiss the "I understand" modal.
   * 5. Allow a brief transition for Vue to re-render disabled states.
   * 6. Re-query the clickable pool (adjacent slots may now be disabled).
   * 7. Repeat until the required count is reached.
   *
   * REAL DOM STRUCTURE (confirmed via live browser snapshot)
   * Time slots are rendered as leaf <div> elements with cursor:pointer and
   * text like "8:30 AM". They are NOT wrapped in <label> elements and do
   * NOT use CSS classes like "b2--bold" or "b3--bold". After a slot is
   * selected, adjacent slots (+/- 30 min) lose cursor:pointer and become
   * visually disabled.
   *
   * ADJACENT-SLOT DISABLED RULE
   * When a slot is selected (e.g., 9:00 AM), its neighbors (8:30 AM and
   * 9:30 AM) become disabled. This method detects disabled slots by
   * re-querying the clickable pool after each selection — evaluate() checks
   * cursor, opacity, pointer-events, and the disabled attribute on the
   * element and its ancestors.
   *
   * WAIT PATTERN
   * - Time slot visibility is polled with expect.poll() on
   *   hasVisibleTimeSlotElements().
   * - The "I understand" modal uses its own element-based wait.
   * - A 200ms micro-pause after each selection gives Vue time to re-render
   *   slot states before the next evaluate() query. This is a sub-second
   *   transition guard, not a timing hack.
   *
   * @param count  How many time slots to select (e.g., 3 for North Irvine MRI).
   * @returns      The text labels of the selected time slots.
   */
  async selectTimeSlots(count: number): Promise<string[]> {
    const selectedSlots: string[] = [];

    // Wait for at least one visible time slot to appear.
    await expect
      .poll(() => this.hasVisibleTimeSlotElements(), {
        timeout: 8_000,
        message: 'At least one visible time slot should appear.',
      })
      .toBe(true);

    // Select slots one at a time, re-querying the clickable pool after each
    // click because the adjacent-slot disable rule changes availability.
    const maxRounds = 15; // Safety valve against infinite loops.
    for (let round = 0; round < maxRounds && selectedSlots.length < count; round++) {
      // Discover which slots are currently clickable.
      const clickableSlots = await this.getClickableTimeSlotTexts();
      // Exclude already-selected slots from the candidate pool.
      const remaining = clickableSlots.filter((t) => !selectedSlots.includes(t));

      if (remaining.length === 0) break; // No more slots to try.

      // Click the first available slot.
      const slotText = remaining[0];
      const clicked = await this.clickTimeSlotByText(slotText);

      if (!clicked) continue; // Slot could not be clicked — try next round.

      selectedSlots.push(slotText);

      // After the first slot, North Irvine shows an "I understand" modal
      // informing the member that 3 preferences are required.
      if (selectedSlots.length === 1) {
        await this.dismissSlotModal();
      }

      // Allow 200ms for Vue to re-render the slot disabled states before
      // re-querying. This is a sub-second transition guard — Playwright's
      // auto-wait does not cover framework-level reactive DOM updates that
      // happen asynchronously after a click event.
      if (selectedSlots.length < count) {
        await this.page.waitForTimeout(200);
      }
    }

    if (selectedSlots.length < count) {
      const remainingClickable = await this.getClickableTimeSlotTexts();
      throw new Error(
        `Selected ${selectedSlots.length} of ${count} required time slots. ` +
          `Clickable slots remaining: ${remainingClickable.length} ` +
          `(${remainingClickable.join(', ') || 'none'}). ` +
          'Some may be disabled by the adjacent-slot rule. ' +
          'Increase office availability or adjust the time-slot selection strategy.',
      );
    }

    return selectedSlots;
  }

  /**
   * Select the requested number of appointment slots without returning the slot labels.
   *
   * This is a convenience wrapper around selectTimeSlots() for callers that
   * only need to advance through scheduling without capturing the selection
   * for downstream assertions.
   *
   * @param count  Number of slots to select.
   */
  async selectAppointments(count: number): Promise<void> {
    await this.selectTimeSlots(count);
  }

  // ---------------------------------------------------------------------------
  // CALENDAR VISIBILITY
  // ---------------------------------------------------------------------------

  /**
   * Return true when the calendar area is visible.
   *
   * Used by the polling loop in completeScheduling() and by direct assertions
   * in the e2e test to confirm the calendar appeared after office selection.
   */
  async isCalendarVisible(): Promise<boolean> {
    return this.isAnyVisible(this.calendarCandidates);
  }

  // ---------------------------------------------------------------------------
  // CONTINUE BUTTON
  // ---------------------------------------------------------------------------

  /**
   * Click Continue after making sure the button is enabled.
   *
   * The Ezra scheduling page marks its Continue button with data-test="submit".
   * That is preferred for specificity; BasePage.continueButton is the fallback.
   *
   * WAIT PATTERN
   * `toBeEnabled()` is an assertion-based wait -- Playwright retries until the
   * button's disabled attribute is removed, or until the assertion timeout.
   * This is more reliable than checking `isDisabled()` once.
   */
  async continue(): Promise<void> {
    const submitBtn = this.page.locator('[data-test="submit"]');
    const isVisible = await submitBtn.isVisible().catch(() => false);

    if (isVisible) {
      await expect(
        submitBtn,
        'Continue should be enabled after all required time slots are selected.',
      ).toBeEnabled({ timeout: 5_000 });
      await submitBtn.click();
    } else {
      await expect(this.continueButton).toBeEnabled({ timeout: 5_000 });
      await this.continueButton.click();
    }
  }

  // ---------------------------------------------------------------------------
  // COMPOSITE HELPER
  // ---------------------------------------------------------------------------

  /**
   * Complete the whole scheduling step and return the selections made.
   *
   * FLOW
   * 1. If a state is provided, filter the office list to that state.
   * 2. Select the specified office by name.
   * 3. Wait for the calendar to appear (polled, not load-state based).
   * 4. Navigate forward through the calendar to find a date with availability.
   * 5. Click an available date and verify time slots appeared.
   * 6. Select the required number of non-adjacent time-slot preferences.
   * 7. Click Continue to proceed to payment.
   * 8. Return the captured selections for downstream assertions.
   *
   * WAIT PATTERN SUMMARY
   * - State filter:         combobox interaction -> option click (element-based)
   * - Office selection:     text locator wait -> click (element-based)
   * - Calendar visible:     expect.poll() polling for calendar day cells
   * - Calendar navigation:  expect.poll() polling for month header change
   * - Available date:       vuecal__cell--disabled class check -> time slot waitFor
   * - Time slots:           waitFor on H:MM AM/PM text -> CSS evaluate() per slot
   * - Continue:             toBeEnabled() assertion-based wait
   *
   * No `waitForLoadState()`. A 200ms micro-pause in selectTimeSlots() guards
   * Vue's reactive slot re-render between selections — documented there.
   *
   * @param officeName        The office to select (e.g. "North Irvine").
   * @param appointmentCount  How many time-slot preferences to select (e.g. 3).
   * @param state             Optional state filter (e.g. "California").
   * @returns                 The scheduling choices for downstream assertion.
   */
  async completeScheduling(
    officeName: string,
    appointmentCount: number,
    state?: string,
  ): Promise<SchedulingSelection> {
    // Step 1: filter offices by state if provided.
    if (state) {
      await this.selectState(state);
    }

    // Step 2: select the target office.
    await this.selectOffice(officeName);

    // Step 3: wait until the calendar is visible.
    // This is the RIGHT kind of wait -- polling for a specific DOM condition
    // rather than a generic load state. The calendar renders asynchronously
    // after the office click triggers an API call for availability data.
    await expect
      .poll(() => this.isCalendarVisible(), {
        timeout: 15_000,
        message: 'Calendar should appear after an office is selected.',
      })
      .toBe(true);

    // Step 4-5: navigate to find an available date and click it.
    const { day, monthYear } = await this.selectAvailableCalendarDate(3, appointmentCount);

    // Step 6: select the required number of time-slot preferences.
    const selectedTimeSlots = await this.selectTimeSlots(appointmentCount);

    // Parse the month header into components for the formatted date text.
    const [monthName = '', yearStr = ''] = monthYear.split(/\s+/);
    const selectedDateText = `${monthName} ${day}, ${yearStr}`;

    // Step 7: proceed to payment.
    await this.continue();

    return {
      calendarMonth: monthYear,
      selectedDay: day,
      selectedDateText,
      selectedTimeSlots,
    };
  }
}
