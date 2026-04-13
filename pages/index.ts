/**
 * =============================================================================
 * pages/index.ts | Single export point for page objects
 * =============================================================================
 *
 * This file is often called a barrel export.
 * That just means it re-exports several files from one place.
 *
 * WHY THIS HELPS
 * Instead of writing many long import paths all over the repo,
 * fixtures and tests can import from `../pages` and get what they need.
 * =============================================================================
 */

export { BasePage } from './BasePage';
export { ConfirmationPage } from './ConfirmationPage';
export { PaymentPage } from './PaymentPage';
export { ScanSelectionPage } from './ScanSelectionPage';
export { SchedulingPage } from './SchedulingPage';
export type { SchedulingSelection } from './SchedulingPage';
export { SignupPage } from './SignupPage';
