/**
 * =============================================================================
 * utils/testData.ts | Shared test data for the Ezra booking test suite
 * =============================================================================
 *
 * This file keeps the common inputs in one place.
 *
 * WHY THIS MATTERS
 * If every spec hardcoded its own scan names, office names, and card numbers,
 * the suite would be much harder to maintain.
 *
 * WHAT LIVES HERE
 * - a valid adult date of birth
 * - the scan names used by the suite
 * - the office used by the main path
 * - Stripe test cards for success and decline
 * =============================================================================
 */

/**
 * Valid adult date of birth used to pass the age gate on the scan page.
 */
export const VALID_DOB = '01-15-1990';

/**
 * Shape of a generated test user.
 */
export type TestUser = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

/**
 * Generate a unique test user for each test run.
 *
 * NAMING CONVENTION
 * - firstName : rahkiino (fixed)
 * - lastName  : user-MMDDYYYYHHMMSS  (datetime makes it unique per run)
 * - email     : rahkiino+user-MMDDYYYYHHMMSS@gmail.com
 * - phone     : 1231231234
 * - password  : EzraTest1
 */
export function generateTestUser(): TestUser {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    String(now.getFullYear()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  return {
    firstName: 'rahkiino',
    lastName:  `user-${ts}`,
    email:     `rahkiino+user-${ts}@gmail.com`,
    phone:     '1231231234',
    password:  'EzraTest1',
  };
}

/**
 * Scan labels used by the suite.
 *
 * These strings are based on the provided booking-flow notes.
 */
export const SCAN = {
  MRI: 'MRI Scan',
} as const;

/**
 * Office-related test data.
 */
export const OFFICE = {
  /**
   * North Irvine California — used by the suite.
   * Cannot confirm immediately; requires 3 suggested time-slot preferences.
   */
  NORTH_IRVINE: 'North Irvine',
  NORTH_IRVINE_APPT_COUNT_FOR_MRI: 3,
  STATE: 'California',
} as const;

/**
 * Stripe test cards.
 *
 * VALID is used for a successful payment path.
 * DECLINE is used to force a payment failure path.
 */
export const STRIPE_CARDS = {
  VALID: {
    number: '4242424242424242',
    expiry: '11/40',
    cvc: '123',
    zip: '12345',
  },
  DECLINE: {
    number: '4000000000009995',
    expiry: '12/30',
    cvc: '123',
    zip: '92602',
  },
} as const;

