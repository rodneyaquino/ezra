# Ezra | QA Engineering Submission
This submission covers the Ezra booking flow across three parts: test case design, privacy and security testing, and Playwright automation using a Page Object Model architecture.

Each section below maps directly to the assignment questions. The written responses live in the `documents/` folder. The automation lives in this repo.

---

**Jump to:** [Question 1](documents/ezra_question1.md) · [Question 2](documents/ezra_question2.md) · [Automation](#automation--playwright-test-suite)

---

# Question 1 | Booking Flow Test Cases

> What are the 15 most important test cases across the booking flow, and why do the top 3 rank highest?

**Part 1** identifies 15 test cases ranked from highest to lowest priority across the first three steps of the member-facing booking flow:
 - **Select Your Scan**
 - **Schedule your Scan**
 - **Reserve your appointment**

**Part 2** explains the reasoning behind the top 3 rankings, covering booking risk, payment integrity, and user trust.

<span style="color:#8C86FF">The cases are ordered so the most business-critical and trust-sensitive behaviors surface first. Priority reflects what breaks hardest if it fails, not just what is easiest to test.</span>

**[View Question 1 response →](documents/ezra_question1.md)**

---

# Question 2 | Privacy and Security

> How do you prevent members from accessing other members' medical data, and how do you manage security quality across 100+ sensitive endpoints?

**Part 1** defines an integration test case that verifies cross-member access control across the Medical Questionnaire flow, starting from **Begin Medical Questionnaire**.

**Part 2** provides the full HTTP request sequence used to implement the test, covering the baseline ownership check, all four negative authorization cases, and the final data integrity confirmation.

**Part 3** outlines a practical approach to managing security quality across a large sensitive API surface: organizing endpoints by risk, applying a reusable authorization test matrix, keeping the highest-risk checks in CI, and pairing test coverage with engineering guardrails.

<span style="color:#8C86FF">The core principle throughout: authentication alone is not enough. The backend must also confirm that the authenticated caller owns the object they are trying to reach.</span>

**[View Question 2 response →](documents/ezra_question2.md)**

---

# Automation | Playwright Test Suite

> Two of the 15 test cases from Question 1, automated end-to-end using Playwright and a Page Object Model architecture.

## Why these two

**TC-1** was the first choice because it is the most important test in the suite. It covers every step of the revenue-generating path in one run. If any step breaks (scan selection, scheduling, Stripe payment, or the confirmation state) this test catches it. It also captures the selected date and time slots dynamically and asserts them on the confirmation page, so the test is never stale regardless of when it runs.

**TC-2** was the second choice because it guards against the most trust-damaging failure mode in the flow. A declined card should never look like a confirmed booking. This scenario is deterministic with Stripe test cards, making it reliable to automate, and the consequences of getting it wrong are immediate: a member believes they are booked when they are not.

<details>
<summary><strong>What TC-1 covers</strong></summary>

1. create a new member account at `/join` (handled by the fixture)
2. open the **Member Facing Portal** booking flow
3. enter a valid date of birth and select MRI Scan
4. move to scheduling
5. filter to California and select **North Irvine**
6. navigate the calendar to the first date with availability
7. select 3 non-adjacent time-slot preferences
8. dismiss the "please select 3 times" modal
9. move to payment
10. assert the payment summary matches the selections made
11. fill a valid Stripe test card and submit
12. confirm the booking success page appears
13. assert the confirmation page shows the correct scan type, office, date, and time slots

</details>

<details>
<summary><strong>What TC-2 covers</strong></summary>

1. run the full booking flow through to the payment page
2. fill a Stripe decline test card
3. submit payment
4. assert a visible decline or failure message appears
5. assert the URL never reaches a success state
6. assert the confirmation page heading is not shown
7. assert the user remains on or near the payment page

</details>

---

## Architecture

**Description**
<span style="color:#8C86FF">A Page Object Model suite where every step of the booking flow has its own class, every test gets clean pre-built fixtures, and no test shares state with another.</span>

<details>
<summary><strong>File structure</strong></summary>

```text
ezra-booking-tests/
├── .env.example
├── .gitignore
├── Makefile
├── README.md
├── fixtures/
│   └── index.ts
├── pages/
│   ├── BasePage.ts
│   ├── ConfirmationPage.ts
│   ├── PaymentPage.ts
│   ├── ScanSelectionPage.ts
│   ├── SchedulingPage.ts
│   └── index.ts
├── tests/
│   ├── e2e-booking.spec.ts
│   └── payment-decline.spec.ts
├── utils/
│   ├── testData.ts
│   └── urlMatchers.ts
├── package.json
├── playwright.config.ts
└── tsconfig.json
```

</details>

**Page objects**
The `pages/` folder holds one class per step of the flow. Each class knows how to interact with its own part of the UI. The specs stay short and readable because all the selector and interaction logic lives in the page object, not the test.

**Fixtures**
The `fixtures/` folder wires the page objects together and handles member account creation before each test. Every test gets a fresh authenticated session automatically.

**Utilities**
The `utils/` folder holds shared test data and URL matchers. Card numbers, office names, scan types, and success URL patterns all live here so a single change updates every test that uses them.

---

## Setup

> Built and tested on macOS (Apple Silicon) with Node.js and Chromium via Playwright.

**Steps**
1. Install dependencies
```bash
npm install
npx playwright install --with-deps chromium
```

2. Create your local env file
```bash
cp .env.example .env
```

3. Fill in the required values
 - `BASE_URL` - the Member Facing Portal root URL
 - `BOOKING_START_PATH` - defaults to `/sign-up/select-plan`

---

## Commands

<details>
<summary><strong>NPM</strong></summary>

| Command | What it does |
|---|---|
| `npm test` | Runs the full suite |
| `npm run test:main` | Runs both TC-1 and TC-2 |
| `npm run test:happy` | Runs TC-1 only |
| `npm run test:decline` | Runs TC-2 only |
| `npm run test:list` | Lists the discovered tests |
| `npm run typecheck` | Checks TypeScript types |
| `npm run report` | Opens the HTML report |

</details>

<details>
<summary><strong>Makefile</strong></summary>

```bash
make install
make test
make booking
make decline
make report
make clean
```

</details>

---

## Notes

- The suite creates a unique member account per test run using a timestamped email, so no test state leaks between runs.
- Stripe card fields are handled inside an iframe. The payment page object uses a multi-strategy fill that tries `fill()` first and falls back to `pressSequentially()` for compatibility across Stripe SDK versions.

---

## Trade-offs and assumptions

- **Card fields** - the test assumes Stripe puts all card inputs inside one box on the page. If they are in separate boxes, the card-fill code needs to be updated to find each one individually.
- **Multiple selector options** - instead of guessing one exact button or field name, the test tries a short list of options and uses the first one that shows up. This is safer when you do not have the full page in front of you, but the list should be cleaned up once the real page is confirmed.
- **Running slowly and one at a time** - tests run slow on purpose and take turns instead of running at the same time. This prevents them from bumping into each other on the shared test site. Once things are stable, speed can go up.
- **Short pauses** - two small waits exist in the code. One gives the page a moment to gray out nearby time slots after one is picked. The other gives the card form a moment to let go before the test clicks submit. Both are under one second.
- **No hardcoded dates** - the test does not pick a specific day on the calendar. It finds whatever day is available, remembers it, and then checks that the confirmation page shows that same day. This way the test works no matter when it runs.
- **North Irvine needs 3 time slots** - this is what the site requires for that office. It is stored in one place so if it ever changes, only one line needs updating.

---

## Scalability

- Adding a new step to the booking flow means writing one new page file and adding one line to the fixtures file. Nothing else changes.
- The scheduling helper works for any office. Swap the office name and slot count and it runs a different path.
- All test values like card numbers, office names, and scan types live in one file. Changing them updates every test at once.
- Running tests at the same time is one setting change once the tests are proven to not interfere with each other.

---

## What would come next

- Check that the booked member shows up correctly in the admin portal after payment goes through.
- Add tests for double-clicking submit, mismatched booking details across steps, and the slot count gate.
- After the first real run, cut down the selector lists to just the ones that actually matched.
- Set up automatic test runs on every code push and once a night.

---

**Jump to:** [Question 1](documents/ezra_question1.md) · [Question 2](documents/ezra_question2.md) · [Automation](#automation--playwright-test-suite)