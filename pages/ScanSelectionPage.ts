/**
 * =============================================================================
 * ScanSelectionPage.ts | Step 1, Select Your Scan
 * =============================================================================
 *
 * This page object covers the first visible step in the booking flow.
 *
 * WHAT HAPPENS ON THIS PAGE
 * - the member enters date of birth
 * - the member chooses a scan option
 * - the member moves forward into scheduling
 *
 * WHY THIS PAGE MATTERS
 * If the test cannot get through this step cleanly, nothing else in the booking
 * flow matters yet. This is the front door of the path.
 * =============================================================================
 */

import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ScanSelectionPage extends BasePage {
  /** Candidate locators for the date-of-birth field. */
  readonly dobCandidates: Locator[];

  /** Candidate locators for the sex-at-birth dropdown. */
  readonly sexCandidates: Locator[];

  /** Candidate locator group for scan choices. */
  readonly scanCardCandidates: Locator[];

  /**
   * Build the locator lists used on the scan-selection page.
   */
  constructor(page: Page) {
    super(page);

    this.dobCandidates = [
      page.getByLabel(/date of birth|dob/i),
      page.locator('[data-testid="dob-input"]'),
      page.locator('input[name*="dob" i]'),
      page.locator('input[placeholder*="MM" i]'),
      page.locator('input[type="date"]'),
    ];

    this.sexCandidates = [
      page.getByLabel(/sex at birth|sex|gender/i),
      page.locator('select[name*="sex" i]'),
      page.locator('select[name*="gender" i]'),
      page.locator('select').filter({ hasText: /male|female/i }),
    ];

    this.scanCardCandidates = [
      page.locator('[data-testid="scan-option"]'),
      page.locator('[role="radio"]'),
      page.locator('button'),
      page.locator('label'),
      page.locator('[class*="scan"]'),
    ];
  }

  /**
   * Open the scan-selection page.
   *
   * The exact start path is stored in the environment so the test does not need
   * to hardcode it in the spec.
   */
  async goto(): Promise<void> {
    const startPath = process.env.BOOKING_START_PATH || '/sign-up/select-plan';
    await this.page.goto(startPath);
    await this.waitForPageReady();
  }

  /**
   * Fill the member's date of birth.
   */
  async enterDOB(dob: string): Promise<void> {
    await this.fillFirstVisible(this.dobCandidates, dob, 'date of birth input');
  }

  /**
   * Select sex at birth. Defaults to Male.
   *
   * Both DOB and sex are required before the scan cards unlock.
   *
   * REAL DOM (confirmed via interactive browser exploration)
   * The Ezra scan page renders the sex-at-birth field as an ARIA combobox
   * (`role="combobox"`). When clicked, it opens a `listbox` containing
   * `option` elements. The option accessible names include the combobox
   * placeholder text — e.g. "Male Select" instead of just "Male".
   *
   * STRATEGY
   *   1. Click the combobox to open the dropdown.
   *   2. Wait for the `option` matching the value (via regex) to appear.
   *   3. Click it.
   *   4. Verify the combobox now shows the selected value.
   *   5. If already selected, skip to avoid deselecting it.
   */
  async selectSexAtBirth(value = 'Male'): Promise<void> {
    const combobox = this.page.getByRole('combobox').first();
    await combobox.waitFor({ state: 'visible', timeout: 5_000 });

    // Check if the value is already selected (e.g. from a previous session).
    const currentText = await combobox.textContent().catch(() => '');
    if (currentText && new RegExp(`\\b${value}\\b`, 'i').test(currentText)
        && !/\bSelect\b/.test(currentText)) {
      return; // Already selected — skip to avoid toggling it off.
    }

    // Open the dropdown by clicking the combobox.
    await combobox.click();

    // Wait for the option to appear in the listbox. The option accessible
    // name includes the placeholder text (e.g. "Male Select"), so match
    // with a regex that just requires "Male" anywhere in the name.
    const option = this.page.getByRole('option', { name: new RegExp(value, 'i') });
    await option.first().waitFor({ state: 'visible', timeout: 3_000 });
    await option.first().click();

    // Verify the selection registered — the combobox text should now include
    // the selected value and no longer show "Select" as the only content.
    await expect(combobox).toContainText(new RegExp(value, 'i'), { timeout: 3_000 });
  }

  /**
   * Choose a scan by visible name.
   *
   * Scan cards on the Ezra page are <div> elements, not buttons or radios.
   * The card heading text is inside a <p> — e.g. <p>MRI Scan</p> — so an
   * exact-match regex is required to avoid "MRI Scan" also hitting
   * "MRI Scan with Spine" or "MRI Scan with Skeletal...".
   *
   * The codegen recorded: getByText('MRI Scan Available at $').click()
   * That combined heading+price text is unique per card and is tried first.
   */
  async selectScan(scanName: string): Promise<void> {
    await this.clickFirstVisible(
      [
        // Combined heading+price text — exactly what the codegen recorded.
        this.page.getByText(new RegExp(`${scanName}\\s+Available`, 'i')),
        // Exact-match on the heading <p> so "MRI Scan" ≠ "MRI Scan with Spine".
        this.page.getByText(new RegExp(`^${scanName}$`, 'i')).locator('..'),
        this.page.getByText(new RegExp(`^${scanName}$`, 'i')),
        // Fallback: button or radio if the UI ever changes.
        this.page.getByRole('button', { name: new RegExp(scanName, 'i') }),
        this.page.getByRole('radio', { name: new RegExp(scanName, 'i') }),
      ],
      `scan option matching "${scanName}"`,
      6_000,
    );
  }

  /**
   * Click the page's main forward button.
   *
   * The Ezra scan page marks its Continue button with data-testid="select-plan-submit-btn".
   * That is tried first; BasePage.continueButton is the fallback.
   */
  async continue(): Promise<void> {
    const submitBtn = this.page.locator('[data-testid="select-plan-submit-btn"]');
    const isVisible = await submitBtn.isVisible().catch(() => false);
    if (isVisible) {
      await submitBtn.click();
    } else {
      await this.continueButton.click();
    }
  }

  /**
   * Complete the whole scan-selection step in one helper.
   *
   * FLOW
   * 1. enter DOB
   * 2. choose the scan
   * 3. move to the next step
   */
  async completeScanSelection(dob: string, scanName: string): Promise<void> {
    await this.enterDOB(dob);
    await this.selectSexAtBirth();
    await this.selectScan(scanName);
    await this.continue();
  }
}
