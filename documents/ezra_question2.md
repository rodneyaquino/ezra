<div align="center">

[← Back to README](../README.md) &nbsp;&nbsp;|&nbsp;&nbsp; [← Question 1 | Booking Flow Test Cases](ezra_question1.md) &nbsp;&nbsp;|&nbsp;&nbsp; [Automation →](../README.md#automation--playwright-test-suite)

</div>

---

# Question 2 Response | Ezra Privacy and Security

This response focuses on the **Medical Questionnaire** portion of Ezra's member flow.

- **Part 1** defines a single high-value integration test case centered on cross-member access control
- **Part 2** turns that test into a written HTTP request sequence that shows exactly how the privacy check would be executed
- **Part 3** explains how security quality can be managed across a larger set of sensitive endpoints in a way that is practical to maintain

The general concern in this flow is fairly simple: authentication alone may not be enough. The backend should also confirm that the authenticated member is allowed to read or update the record in front of it.

---

# Part 1 | Integration Test

> **Cross-member Medical Questionnaire access remains restricted throughout the flow**

**Description**
<span style="color:#8C86FF">Verify that an authenticated member cannot read, create, resume, or update another member's Medical Questionnaire by reusing that member's identifiers.</span>

<details>
<summary><strong>Test details</strong></summary>

**Objective**
Protect the Medical Questionnaire flow from object-level authorization failures.

This is a strong privacy check for this flow because access appears to depend on identifiers such as:
- `memberId`
- `encounterId`
- `submissionId`

If the backend accepts those identifiers without verifying ownership, one member could reach another member's questionnaire data. The main check here is not just whether the caller is logged in. It is whether the caller owns the referenced object.

**Preconditions**
- Two valid test members exist: **Member A** and **Member B**
- Each member has a separate authenticated session or bearer token
- Member A can reach **Begin Medical Questionnaire** through the normal flow

**Test data to capture from Member A**
- `A_MEMBER_ID`
- `A_ENCOUNTER_ID`
- `A_SUBMISSION_ID`

**Steps**
1. Authenticate as **Member A**.
2. Complete the booking flow through payment and open **Begin Medical Questionnaire**.
3. Capture Member A's identifiers from the observed request sequence:
   - capture `A_MEMBER_ID` from the authenticated member or encounter response
   - capture `A_ENCOUNTER_ID` from the booking flow context and confirm it through the encounter response
   - capture `A_SUBMISSION_ID` from the questionnaire create or resume response
4. Save at least one known answer as Member A so there is real questionnaire data to protect.
5. Confirm Member A can read that answer back successfully.
6. Authenticate separately as **Member B**.
7. Using Member B's token, replay Member A's questionnaire requests with Member A's identifiers.
8. Attempt the four key negative cases:
   - read questionnaire detail with `A_ENCOUNTER_ID`
   - create or resume a questionnaire using `A_MEMBER_ID` and `A_ENCOUNTER_ID`
   - read questionnaire data using `A_SUBMISSION_ID`
   - write questionnaire data using `A_SUBMISSION_ID`
9. Switch back to Member A and verify the original questionnaire still exists and the saved answer is unchanged.

**Expected Result**
- Every unauthorized request made by Member B against Member A's identifiers is rejected with `403 Forbidden` or `404 Not Found`
- No Medical Questionnaire data is returned in the response body
- No submission ID is returned from the create or resume path
- No update is persisted to Member A's questionnaire
- Member A's previously saved answer remains unchanged
- Member B can still access only Member B's own questionnaire data

**Failure Result**
This is a privacy failure if any of the following occurs:
- Member B can view Member A's questionnaire detail or answers
- Member B can create or resume a questionnaire tied to Member A
- Member B can save or overwrite any answer in Member A's submission
- The API leaks sensitive data even when the request is partially rejected

**Why this test fits the assignment well**
It begins at the point the prompt calls out: **Begin Medical Questionnaire**.

It also focuses on the places where privacy risk is most direct in this flow:
- ownership enforcement
- read-path protection
- write-path protection
- workflow resume protection

</details>

---

# Part 2 | HTTP Requests Used to Implement the Test Case

> **Written request sequence for the cross-member privacy test**

This section shows the minimum HTTP request set needed to execute the Part 1 test case. It does not try to represent every request in the full booking flow. It stays focused on the requests that establish ownership context, open the Medical Questionnaire, and then attempt cross-member reuse of the same identifiers.

Only the fields that matter to the privacy check are shown below. Placeholder values are used intentionally.

**Description**
<span style="color:#8C86FF">Use the observed Medical Questionnaire request flow to verify that Member B cannot reuse Member A's identifiers to read, resume, or modify Member A's Medical Questionnaire.</span>

<details>
<summary><strong>HTTP test details</strong></summary>

**Identifiers used in this test**
- `A_MEMBER_ID`: Member A's member identifier
- `A_ENCOUNTER_ID`: Member A's encounter identifier tied to the booked questionnaire flow
- `A_SUBMISSION_ID`: Member A's questionnaire submission identifier
- `A_AUTH_TOKEN`: Member A's bearer token
- `B_AUTH_TOKEN`: Member B's bearer token

**How the identifiers are sourced**
- `A_ENCOUNTER_ID` is carried in the booking flow context and then confirmed by the encounter request used before the questionnaire sequence
- `A_MEMBER_ID` is confirmed from the authenticated member or encounter context tied to that same flow
- `A_SUBMISSION_ID` is returned by the questionnaire create or resume request

**Execution**
The sequence is split into three parts:
1. establish the valid baseline as Member A
2. replay Member A's identifiers as Member B
3. confirm Member A's data was not changed

### Phase A. Establish the valid baseline as Member A

#### 1) Confirm the encounter context used by Medical Questionnaire
```http
POST https://stage-api.ezra.com/packages/api/encounter/me
Authorization: Bearer <A_AUTH_TOKEN>
Content-Type: application/json

{
  "encounterId": "<A_ENCOUNTER_ID>",
  "packageId": "<PACKAGE_ID>",
  "centerId": "<CENTER_ID>",
  "offlineBookings": [],
  "onlineBookings": [
    {
      "startTime": "<START_TIME>",
      "endTime": "<END_TIME>",
      "lockIds": ["<LOCK_ID_1>", "<LOCK_ID_2>"]
    }
  ]
}
```

**Purpose**
Confirm the encounter context that the Medical Questionnaire sequence relies on next.

**Expected Result**
- Request succeeds for Member A
- Response stays bound to Member A's booked encounter context
- `A_ENCOUNTER_ID` and the related member context can be confirmed from the returned encounter record

#### 2) Confirm the authenticated member profile
```http
GET https://stage-api.ezra.com/individuals/api/members
Authorization: Bearer <A_AUTH_TOKEN>
```

**Purpose**
Confirm the bearer token belongs to Member A and that the member context matches the encounter record.

**Expected Result**
- Request succeeds for Member A
- Response returns Member A's profile
- Returned member identifier matches `A_MEMBER_ID`

#### 3) Read questionnaire detail for Member A's encounter
```http
GET https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_ENCOUNTER_ID>/detail
Authorization: Bearer <A_AUTH_TOKEN>
```

**Purpose**
Check the questionnaire state tied to Member A's encounter before submission data is created or resumed.

**Expected Result**
- Request succeeds for Member A
- Response returns only Member A's questionnaire state for that encounter

#### 4) Create or resume Member A's questionnaire submission
```http
POST https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_MEMBER_ID>/<A_ENCOUNTER_ID>
Authorization: Bearer <A_AUTH_TOKEN>
Content-Type: application/x-www-form-urlencoded
```

**Purpose**
Create or resume the questionnaire submission that will be used for later read and write checks.

**Expected Result**
- Request succeeds for Member A
- Response returns a valid `A_SUBMISSION_ID`
- That submission is tied to Member A's encounter, not just to any caller holding the URL pattern

#### 5) Read Member A's questionnaire data
```http
GET https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_SUBMISSION_ID>/data
Authorization: Bearer <A_AUTH_TOKEN>
```

**Purpose**
Confirm the rightful owner can retrieve questionnaire fields and answers.

**Expected Result**
- Request succeeds for Member A
- Questionnaire data for Member A is returned

#### 6) Save a known answer as Member A
```http
POST https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_SUBMISSION_ID>/data
Authorization: Bearer <A_AUTH_TOKEN>
Content-Type: application/json

{
  "key": "bookingFor",
  "value": "\"Myself\"",
  "hasAnswer": true
}
```

**Purpose**
Persist a known value so the negative authorization checks are protecting real questionnaire data, not an empty record.

**Expected Result**
- Request succeeds for Member A
- The answer is saved and can be read back by Member A

### Phase B. Replay Member A's identifiers as Member B

At this point, Member B is authenticated correctly. That is intentional. The test is not trying to prove authentication. It is checking that object ownership is still enforced even when the caller holds a valid token.

#### 7) Attempt to read Member A's questionnaire detail as Member B
```http
GET https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_ENCOUNTER_ID>/detail
Authorization: Bearer <B_AUTH_TOKEN>
```

**Purpose**
Check that encounter-level questionnaire detail cannot be fetched across members.

**Expected Result**
- Response is `403 Forbidden` or `404 Not Found`
- No questionnaire detail for Member A is returned

#### 8) Attempt to create or resume Member A's questionnaire as Member B
```http
POST https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_MEMBER_ID>/<A_ENCOUNTER_ID>
Authorization: Bearer <B_AUTH_TOKEN>
Content-Type: application/x-www-form-urlencoded
```

**Purpose**
Check that another member cannot create or resume a submission on someone else's encounter.

**Expected Result**
- Response is `403 Forbidden` or `404 Not Found`
- No submission identifier is returned
- No questionnaire is created, resumed, or rebound under Member B's session for Member A's encounter

#### 9) Attempt to read Member A's questionnaire data as Member B
```http
GET https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_SUBMISSION_ID>/data
Authorization: Bearer <B_AUTH_TOKEN>
```

**Purpose**
Check that a valid `submissionId` is not enough to retrieve another member's answers.

**Expected Result**
- Response is `403 Forbidden` or `404 Not Found`
- No questionnaire payload is returned

#### 10) Attempt to write into Member A's questionnaire as Member B
```http
POST https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_SUBMISSION_ID>/data
Authorization: Bearer <B_AUTH_TOKEN>
Content-Type: application/json

{
  "key": "bookingFor",
  "value": "\"Myself\"",
  "hasAnswer": true
}
```

**Purpose**
Check that another member cannot overwrite or append answers by reusing a valid submission identifier.

**Expected Result**
- Response is `403 Forbidden` or `404 Not Found`
- No write is persisted to Member A's questionnaire
- No partial success state is exposed in the response body

### Phase C. Confirm the protected record is unchanged

#### 11) Re-read Member A's questionnaire as Member A
```http
GET https://stage-api.ezra.com/diagnostics/api/medicaldata/forms/mq/submissions/<A_SUBMISSION_ID>/data
Authorization: Bearer <A_AUTH_TOKEN>
```

**Purpose**
Confirm that Member B's unauthorized attempts did not alter the rightful member's data.

**Expected Result**
- Member A can still access the questionnaire normally
- The previously saved answer is unchanged
- No unexpected new submission exists

**Pass condition for the full HTTP sequence**
- Member A can complete the normal Medical Questionnaire request flow
- Member B is blocked at detail, resume, read, and write points when using Member A's identifiers
- Member A's saved data remains intact after Member B's attempts
- The backend proves that possession of another member's IDs is still not enough to cross the privacy boundary

</details>

---

# Part 3 | Thought Process for Managing the Security Quality of 100+ Sensitive Endpoints

**Description** <span style="color:#8C86FF">Protect sensitive endpoints by grouping them by risk, checking access the same way across similar routes, and keeping the most important security tests running in CI.</span>

With more than 100 endpoints transferring sensitive data, keeping protection consistent becomes the real challenge. Most of the API may follow the right access rules, but one or two weaker endpoints can still expose private data.

One way to manage that is to group endpoints into a few common types, then put the deepest testing on the areas with the highest privacy risk. That gives the work more structure, keeps attention on the places where a mistake would hurt most, and makes the overall API surface easier to manage.

The process is:

| Step | Purpose |
|---|---|
| **Organize** | Identify which endpoints read, write, export, resume, or otherwise expose sensitive data, and which identifiers control access |
| **Prioritize** | Put the deepest coverage on the endpoints that can expose, modify, export, or resume sensitive data |
| **Standardize** | Reuse the same core authorization and data-exposure checks across similar endpoint families |
| **Automate** | Keep the highest-risk checks running in CI so privacy regressions are caught early |
| **Track Gaps** | Make uncovered areas, accepted exceptions, and temporary risk visible instead of assuming full coverage |

For sensitive endpoints, authentication is only the first check. The system also has to confirm that the caller is allowed to access that specific record. In this flow, identifiers like `memberId`, `encounterId`, and `submissionId` can help locate the data, but they should never be treated as proof that the caller is allowed to read or modify it.

<details>
<summary><strong>Part 3 plan</strong></summary>

## 1. Organize | Build a lightweight endpoint inventory

The first step is to group the 100+ endpoints into something testable. That inventory does not need to be heavy. It just needs enough detail to drive risk decisions and coverage.

A useful inventory would capture:

| Field | Reason |
|---|---|
| **Endpoint / method** | Defines the route and action being tested |
| **Data sensitivity** | Separates direct medical data from lower-risk support data |
| **Access model** | Shows whether access is member-based, role-based, internal-only, or mixed |
| **Action type** | Distinguishes read, write, update, delete, export, search, and workflow actions |
| **Key identifiers** | Highlights path, query, or body IDs that could be swapped or replayed |
| **Expected denial behavior** | Defines whether unauthorized access should return `403`, `404`, or another controlled response |

That inventory quickly shows where the biggest privacy risk sits.

## 2. Prioritize | Rank endpoints by privacy impact

Not every endpoint needs the same depth on day one. The first pass should go to the endpoints where failure would matter most.

A practical priority order would be:

| Priority | Endpoint type |
|---|---|
| **Tier 1** | Endpoints that read or write medical data |
| **Tier 1** | Endpoints that create, resume, or transition sensitive workflows |
| **Tier 1** | Export, file, and attachment endpoints |
| **Tier 2** | Search, list, and bulk endpoints that could leak data at scale |
| **Tier 3** | Supporting endpoints with low direct exposure but still worth baseline checks |

This keeps effort tied to privacy impact instead of raw endpoint count.

## 3. Standardize | Apply a reusable security test matrix

Instead of writing fully custom security tests for every endpoint, the better move is to apply the same core checks across endpoint families.

The baseline negative matrix should cover:

| Check | What it proves |
|---|---|
| **Unauthenticated access is rejected** | Sensitive routes are not exposed without a valid session or token |
| **Cross-user access is rejected** | One member cannot read or modify another member's object |
| **Wrong-role access is rejected** | Elevated or internal data is not exposed to the wrong role |
| **Identifier swapping is blocked** | Changing path, query, or body IDs does not cross the privacy boundary |
| **Denied responses do not leak data** | Error paths do not expose sensitive fields, internal details, or object existence unnecessarily |
| **Unauthorized writes do not persist** | Rejected write attempts leave no partial state behind |

This is the same principle already used in Parts 1 and 2. The caller may be authenticated, but ownership still has to be enforced at the object level.

## 4. Automate | Keep the highest-risk checks in CI

The most important security checks should not live only in a one-time test pass. They should run continuously.

For the highest-risk endpoints, CI should prove that:

- authorized access still works
- cross-user reads are blocked
- cross-user writes are blocked
- workflow resume paths still enforce ownership
- denied responses do not return sensitive data
- rejected writes do not partially persist

That is where the suite becomes useful. It turns privacy checks into release protection, not just a one-time exercise.

## 5. Track Gaps | Report coverage gaps and back them with engineering guardrails

Test coverage alone is not enough. If the implementation path is inconsistent, the suite will always be chasing gaps after the fact.

Long term, it should be paired with engineering guardrails such as:

- shared authorization patterns where possible
- a standard ownership check for object-based routes
- response review for sensitive fields
- a required negative authorization test for any new endpoint that handles medical data
- API review checkpoints for new sensitive routes before they ship

That reduces the chance that privacy depends on one reviewer or one test suite catching everything.

## Tradeoffs and potential risks

| Area | Tradeoff | Risk |
|---|---|---|
| **Depth vs speed** | Deeper coverage catches more real issues, but takes longer to build and stabilize | Moving too fast can leave major privacy paths thin |
| **Reusable patterns vs custom coverage** | Shared checks scale well, but some endpoints still need custom workflow testing | Over-relying on patterns can miss endpoint-specific logic |
| **Strict assertions vs maintainability** | Tighter leakage checks catch exposure earlier | The suite can get noisy if contracts change often |
| **Risk-based rollout vs full parity** | Prioritizing Tier 1 endpoints is practical | Lower-risk endpoints may stay under-covered longer |
| **QA ownership vs shared ownership** | QA can drive coverage and visibility | Treating security as QA-only creates blind spots in design and implementation |

## Recommended approach

The recommended approach is to manage security quality as a repeatable authorization and data-exposure program, not as a long list of unrelated endpoint tests.

That means:
- organize the endpoints
- prioritize by privacy impact
- apply shared negative checks
- automate the highest-risk coverage in CI
- pair testing with engineering guardrails
- keep uncovered areas visible

That gives Ezra a practical way to improve security quality across a large API surface without assuming every endpoint will get the same depth on day one.

</details>

----
<div align="center">

[← Back to README](../README.md) &nbsp;&nbsp;|&nbsp;&nbsp; [← Question 1 | Booking Flow Test Cases](ezra_question1.md) &nbsp;&nbsp;|&nbsp;&nbsp; [Automation →](../README.md#automation--playwright-test-suite)

</div>