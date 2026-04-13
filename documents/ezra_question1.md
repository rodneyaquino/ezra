<div align="center">

[← Back to README](../README.md) &nbsp;&nbsp;|&nbsp;&nbsp; [Question 2 | Privacy and Security →](ezra_question2.md)

</div>

---

# Question 1 Response | Ezra Booking Flow
This response focuses on the first three steps of Ezra’s booking flow in the Member Facing Portal
 - **Select Your Scan**
 - **Schedule your Scan**
 - **Reserve your appointment**

---

# Part 1 | 15 Most Important Test Cases

> The 15 test cases below are ranked from highest to lowest priority based on booking risk, payment integrity, user trust, data accuracy, and the behaviors most likely to affect a successful booking outcome. Part 2 explains why the top three test cases were ranked highest.

## 1. End-to-end successful booking request creation through payment

**Description**
<span style="color:#8C86FF">Verify that an eligible user can complete the full booking path from scan selection through scheduling and payment, then reach the correct post-payment page.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Access the Member Facing Portal as a valid user.
2. Go to **Select Your Scan**.
3. Enter a qualifying DOB for a user who is at least 18 years old.
4. Select a valid scan option.
5. Continue to **Schedule your Scan**.
6. Select a valid office.
7. Select the required number of appointments for that flow.
8. Continue to **Reserve your appointment**.
9. Enter valid Stripe test payment information.
   - Example: use Visa `4242 4242 4242 4242`
   - Use any valid future expiration date and any 3-digit CVC
10. Submit the payment.

**Expected Result**
- The user moves successfully through scan selection, scheduling, and payment without errors.
- The flow accepts the booking request.
- The user lands on the correct post-payment page.
- The post-payment page reflects a submitted request state, displays accurate booking details, and exposes the next step in the flow.

</details>

**Post-condition check**

- Review the booking in the **User Facing Portal** and confirm it appears on the correct member record.
- Because the **User Facing Portal** appears to show multiple status layers, this could be raised with the team to align on the expected downstream behavior before turning it into a strict check.
- **NOTE** | Given current scope, this would remain a follow-up validation point until the expected downstream behavior is confirmed and the team decides whether it belongs in this end-to-end test or in a separate test.


## 2. Failed payment does not create a submitted booking state

**Description**
<span style="color:#8C86FF">Verify that a payment failure does not move the user into a success state or make the booking appear submitted.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Complete scan selection and scheduling with valid data.
2. Proceed to **Reserve your appointment**.
3. Enter Stripe test decline card `4000 0000 0000 9995`.
   - This is a Stripe test card for an insufficient funds decline
   - Expected Stripe outcome: `card_declined` with decline code `insufficient_funds`
4. Submit the payment.
5. Observe the page behavior and resulting state.

**Expected Result**
- Payment is declined.
- The payment fails through the declined-payment path, not through a generic form-validation error.
- The user does not land on the post-payment success page.
- The booking is not presented as submitted anywhere in the flow or in any backend-facing state.
- The user receives clear, specific feedback that payment failed.
- The user is given a safe path to retry without re-entering scan or scheduling selections.

</details>


## 3. Duplicate payment submission does not create duplicate charges or duplicate booking requests

**Description**
<span style="color:#8C86FF">Verify that repeated submit actions during a slow or pending payment request do not create duplicate bookings or duplicate charges.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Complete scan selection and scheduling with valid data.
2. Continue to **Reserve your appointment**.
3. Enter valid payment data.
4. Open browser DevTools and throttle the network to a very slow profile.
   - Example: **Slow 3G**
   - This is meant to create a delayed payment response and a realistic in-flight payment state
5. Click **Continue** to submit payment.
6. Observe the payment action while the request is in flight.
   - Confirm the **Continue** button becomes disabled or grayed out
   - Confirm a loading state is shown while payment is processing
7. Confirm the UI does not allow an additional submit while the first payment request is still in flight.
8. Check for evidence of duplicate charges or duplicate booking records if backend access is available.

**Expected Result**
- After the first click, **Continue** becomes disabled or grayed out while the payment request is in flight.
- A loading state is shown while payment is processing.
- The UI blocks additional submission attempts during that in-flight state.
- Only one payment confirmation request is sent.
- Only one successful booking outcome is created.
- The user does not end up with duplicate booking states.
- No duplicate payment charges are processed.

</details>


## 4. Booking details remain accurate across scan selection, scheduling, payment, and post-payment pages

**Description**
<span style="color:#8C86FF">Verify that the selected scan, office, appointment details, and booking summary stay accurate and consistent as the user moves through every step of the flow.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Select a scan and note the exact scan name and any plan details shown.
2. Select an office and note the office name and address.
3. Select the required appointment(s) and note the date(s) and time(s).
4. Continue to payment and compare the booking summary against what was selected.
5. Complete the payment.
6. Compare the details shown on the post-payment page against all prior steps.

**Expected Result**
- The selected scan name and plan remain correct on every page.
- The office name and address remain correct.
- The selected date(s) and time(s) remain correct.
- The booking summary on the payment page and the post-payment page do not misrepresent any detail the user chose.

</details>


## 5. User is blocked when the selected appointment count is below the required threshold

**Description**
<span style="color:#8C86FF">Verify that the scheduling step prevents the user from continuing when fewer appointments are selected than required for the selected scan and office context.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Start on **Select Your Scan**.
2. Choose a scan and office combination that requires more than one appointment.
3. Continue to **Schedule your Scan**.
4. Select fewer appointments than required.
5. Attempt to continue.

**Expected Result**
- The user is blocked from continuing.
- A clear validation state or message is shown indicating the required number of appointments.
- The flow does not advance until the required appointment count is met.

</details>


## 6. Under-18 DOB blocks qualification on Select Your Scan

**Description**
<span style="color:#8C86FF">Verify that a user younger than 18 cannot qualify for the booking flow, with boundary testing around the exact age threshold.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Open **Select Your Scan**.
2. Enter a DOB that makes the user one day under 18.
   - This checks the qualification cutoff at the boundary, not just an obvious underage case
3. Attempt to continue.
4. Enter a DOB that makes the user exactly 18 today.
   - This confirms the cutoff is calculated correctly at the acceptance boundary
5. Attempt to continue.
6. Enter a DOB that makes the user clearly older than 18.
7. Attempt to continue.

**Expected Result**
- Under-18 users are blocked from qualifying for the scan flow.
- A user who is exactly 18 is accepted.
- The UI clearly explains the age requirement when the user is blocked.
- Eligible DOB values are accepted and allow the user to continue.

</details>


## 7. Back navigation and browser history do not corrupt flow state

**Description**
<span style="color:#8C86FF">Verify that using the browser back button or in-app back navigation at any point in the flow does not corrupt the booking state, lose user selections, or create orphaned payment or scheduling data.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Complete scan selection and proceed to scheduling.
2. Use the browser back button to return to scan selection.
3. Observe whether prior selections are preserved or cleanly reset.
4. Proceed forward again and continue to the payment page.
5. Use the browser back button from the payment page.
6. Observe the scheduling page state.
7. Complete the flow and verify the final booking state is accurate.

**Expected Result**
- Back navigation does not produce errors or blank pages.
- User selections are either preserved correctly or reset cleanly with clear re-entry points.
- No orphaned or partial booking data is created by navigating backward.
- The user can complete the flow successfully after navigating back and forward.

</details>


## 8. User can continue when the required appointment count is fully satisfied

**Description**
<span style="color:#8C86FF">Verify that the user can proceed once the exact required number of appointments has been selected.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Start on **Select Your Scan**.
2. Choose a scan and office combination with a known appointment requirement.
3. Continue to **Schedule your Scan**.
4. Select the exact required number of appointments.
5. Attempt to continue.

**Expected Result**
- The validation state clears once the requirement is met.
- **Continue** becomes available.
- The flow advances to the payment step.

</details>


## 9. Payment page renders the correct payment options, booking summary, and total

**Description**
<span style="color:#8C86FF">Verify that **Reserve your appointment** loads with the expected payment methods, booking summary, and total price.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Complete scan selection and scheduling with a known scan and office.
2. Continue to **Reserve your appointment**.
3. Review the payment page for completeness.

**Expected Result**
- The correct payment methods are visible and functional.
- The booking summary matches what was selected in prior steps.
- The displayed total is present, correct, and understandable.
- The page appears complete and ready for payment submission without missing elements.

</details>


## 10. State filter returns the correct office list

**Description**
<span style="color:#8C86FF">Verify that selecting a state on **Schedule your Scan** filters the visible office list correctly.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Go to **Schedule your Scan**.
2. Note the initial office list with the default state setting.
3. Select a specific state.
4. Compare the office list before and after filtering.
5. If possible, verify against a known list of offices for that state.

**Expected Result**
- The office list changes based on the selected state.
- Offices shown after filtering match the selected state.
- The filter does not surface offices from unrelated states.

</details>


## 11. Find closest centers to me returns the correct office list

**Description**
<span style="color:#8C86FF">Verify that the nearest-center filter narrows the office list based on the user's location context.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Go to **Schedule your Scan**.
2. Use **Find closest centers to me**.
   - Grant location permission if prompted
   - Use a controlled test location, such as the tester’s current location or a browser-mocked location, so the expected office list is predictable
3. Observe the filtered office list.
4. Compare the results with the known geographic location used in testing.

**Expected Result**
- The office list is filtered based on proximity to the user's location.
- The results align reasonably with the test location.
- The behavior is consistent with the expected location-based filtering for this step.

</details>


## 12. Selected office loads the correct scheduling context and office-specific controls

**Description**
<span style="color:#8C86FF">Verify that selecting an office loads the correct lower scheduling section with controls tied to that office.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Go to **Schedule your Scan**.
2. Select an office (e.g., **North Irvine**).
3. Scroll to the lower half of the page.
4. Observe the scheduling section.
5. Select a different office and observe whether the scheduling context updates.

**Expected Result**
- The office selection triggers the lower scheduling section to load correctly.
- **Additional Scheduling Information** and the date-selection area appear.
- The schedule context is tied to the selected office.
- Switching offices updates the scheduling section accordingly.

</details>


## 13. Calendar and date/time selector stay hidden until an office is selected

**Description**
<span style="color:#8C86FF">Verify that the scheduling controls do not appear prematurely before the user selects an office.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Go to **Schedule your Scan**.
2. Do not select an office.
3. Observe whether the calendar and date/time selector are visible.
4. Select an office.
5. Observe the scheduling controls again.

**Expected Result**
- Before office selection, the calendar and date/time selector are not shown.
- After office selection, the correct scheduling controls appear.

</details>


## 14. Add-on restriction messaging and info-icon tooltips display the correct explanatory content

**Description**
<span style="color:#8C86FF">Verify that the tooltip content shown during scan selection appears correctly for the add-on restriction scenario and the information icons.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Open **Select Your Scan**.
2. Select MRI and move through the scan-selection page.
3. Attempt the add-on interaction and observe the resulting tooltip behavior.
4. Click the visible information icons.

**Expected Result**
- The expected tooltip appears for the add-on restriction scenario.
- Information icons display explanatory content that is readable and relevant.
- The content corresponds to the correct scan context.

</details>


## 15. "What's Included" and "What's Not Included" open the correct plan-specific modals

**Description**
<span style="color:#8C86FF">Verify that the plan detail modals open correctly and display content matching the selected plan.</span>

<details>
<summary><strong>Test details</strong></summary>

**Steps**
1. Open **Select Your Scan**.
2. Locate **What's Included** and **What's Not Included** for a plan.
3. Open each modal.
4. Repeat for at least one additional plan if available.

**Expected Result**
- The correct modal opens for the selected plan.
- The included and excluded content maps to the correct plan.
- The modal content is not mismatched or cross-linked to another plan.

</details>

---

# Part 2 | Why the Top 3 Test Cases Matter Most

## 1. End-to-end successful booking request creation through payment

This is the most important test because it validates the entire revenue-generating path the assignment is centered on. It exercises every step of the funnel: scan selection, scheduling, payment, and the handoff into the post-payment experience. If this path fails, Ezra cannot accept bookings, and the most business-critical user journey is broken. Every other test case is meaningful only if this primary path is capable of succeeding.

## 2. Failed payment does not create a submitted booking state

This is in the top three because payment is the highest-trust moment in the flow. If a decline or error is handled poorly and the system presents a booking as submitted when payment actually failed, the consequences are immediate: the user believes they are booked, support receives escalations, and Ezra's credibility takes a direct hit. This test protects both booking integrity and customer trust at the exact point where real money changes hands.

## 3. Duplicate payment submission does not create duplicate charges or duplicate booking requests

This ranks third because double-charging a user is one of the most damaging outcomes a booking system can produce. Users on slow connections, impatient users, or users who receive no immediate UI feedback will click submit more than once. If the system does not prevent or safely absorb repeated submissions, the result is duplicate charges, duplicate booking records, and a support and refund burden that directly erodes user trust and operational efficiency. This is a financial integrity issue that must be guarded at the system level.

---
<div align="center">

[← Back to README](../README.md) &nbsp;&nbsp;|&nbsp;&nbsp; [Question 2 | Privacy and Security →](ezra_question2.md)

</div>