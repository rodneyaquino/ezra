/**
 * =============================================================================
 * utils/urlMatchers.ts | Shared URL and endpoint matchers
 * =============================================================================
 *
 * This file keeps the important URL checks in one place.
 *
 * WHY THIS HELPS
 * Tests should not each invent their own regular expressions for the same idea.
 * If the matching logic changes, it is much easier to update it in one file.
 *
 * WHAT THIS FILE COVERS
 * - a success-style booking URL check
 * - a reserve-appointment page URL check
 * =============================================================================
 */

/**
 * Return true when the browser URL looks like a success outcome.
 */
export function isSuccessfulBookingUrl(url: string): boolean {
  return /(redirect_status=succeeded|scan-confirm|confirmation|success|thank)/i.test(url);
}

/**
 * Return true when the browser still appears to be on the reserve-appointment page.
 */
export function isReserveAppointmentUrl(url: string): boolean {
  return /reserve-appointment/i.test(url);
}

