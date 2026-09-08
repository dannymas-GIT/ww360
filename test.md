# WW360 QA Test Suite

Pipeline QA uses credentials from `~/.openclaw/openclaw.env` with prefix `WW360`:
`WW360_APP_URL`, `WW360_E2E_USERNAME` (or `WW360_TEST_EMAIL`), `WW360_E2E_PASSWORD` (or `WW360_TEST_PASSWORD`).

## Variables (substituted by pipeline)

- `${BASE_URL}` — from WW360_APP_URL (staging)
- `${TEST_EMAIL}` — from WW360_E2E_USERNAME or WW360_TEST_EMAIL
- `${TEST_PASSWORD}` — from WW360_E2E_PASSWORD or WW360_TEST_PASSWORD

### Test: Hudson Falls district roles (optional)
**Prereq:** Run `python backend/scripts/seed_hudson_falls_district.py` on the backend host.
**Credentials:** `hf-manager` / `hf-operator-1` with `WW360_SEED_DISTRICT_PASSWORD` (default `ChangeMe-HFWD!`).
**Steps:**
1. Log in as `hf-manager` → `/dashboard` shows District dashboard + documentation widgets
2. Log in as `hf-operator-1` → Operator home; no Executive/Admin nav
3. Assign primary coverage to linked operator → documentation task appears in operator home
4. Operator submits tutorial for review → manager review queue count increases

Playwright: `frontend/e2e/district_roles.spec.ts` (manifest `district-roles`).

### Test: Impersonation persona preview
**Prereq:** Run `python backend/scripts/seed_demo_personas.py` on the backend host.
**Credentials:** `jingrao-aman-OWW` with admin password.
**Steps:**
1. Log in → confirm **Kitchen Sink** is off by default in sidebar
2. Click **View as role** → select a national persona (e.g. ASDWA program director)
3. Confirm landing on `/national` (not district Path to compliance) with simplified KPIs/charts
4. Confirm impersonation banner shows **Read-only preview**
5. Turn **Kitchen Sink** on → full national nav and executive tools appear
6. Select a utility persona → district/operator simplified home
7. Click **Exit preview**

Playwright: `frontend/e2e/impersonation.spec.ts`.

### Test: Kitchen Sink & role tour
**Steps:**
1. Preview any persona → role tour auto-opens once per persona key
2. Confirm tour mentions Document Studio and Kitchen Sink toggle
3. Dismiss tour → reopen via **Role tour** FAB if visible

### Test: Data mode labels (factual content checklist)
**Steps:**
1. On simplified workspace, each KPI tile shows Live or Sample badge
2. Chart sections cite source id in subtitle (e.g. `bls_oews`, `epa_echo_sdwis`)
3. Illustrative tiles must not claim live sync timestamps
4. National full view (`Kitchen Sink` on) — state table links to scorecards with provenance footer

### Test: National overview
**URL:** ${BASE_URL}/national
**Credentials:** `ww360-national` / `ChangeMe-National!`
**Expected:**
- Five headline KPI tiles
- State comparison table with scorecard links

Playwright: `frontend/e2e/national_overview.spec.ts`.

### Test: Customize home panels
**Credentials:** any authenticated user (Jenny / platform admin).
**Steps:**
1. Sidebar → **Customize home**
2. Confirm panel library lists Headline numbers, Charts, Federal jobs, Document Studio, etc.
3. Start customize tour — slides cover identify KPIs and match to panels
4. Toggle a panel off, Save layout
5. Reload `/dashboard` — panel stays off
6. Reset to defaults — panels restore

## Smoke Tests (Required)

### Test: Landing Load
**URL:** ${BASE_URL}/
**Steps:**
1. Wait 2
**Expected:**
- Page loads within 5 seconds
- Title or hero mentions Workforce / WW360
- Slider logo sits to the right of the hero copy (not stacked under the header logo)

### Test: Health API
**URL:** ${BASE_URL}/health
**Steps:**
1. Wait 1
**Expected:**
- HTTP 200
- Response contains "ok"

### Test: Login Page
**URL:** ${BASE_URL}/login
**Steps:**
1. Wait 2
**Expected:**
- See "Sign in to Water Workforce 360"
- input#password visible

## Authenticated (Required when credentials set)

### Test: Executive Dashboard
**URL:** ${BASE_URL}/login
**Steps:**
1. Fill input#username with ${TEST_EMAIL}
2. Fill input#password with ${TEST_PASSWORD}
3. Click button[type="submit"]
4. Wait 3
5. Navigate to ${BASE_URL}/dashboard
6. Wait 2
**Expected:**
- URL contains /dashboard
- KPI or executive overview content visible
- Digital reach teaser visible with link "Open Digital reach"

### Test: Digital Reach Analytics
**URL:** ${BASE_URL}/analytics
**Steps:**
1. Wait 3
2. Click tab "onewaterworkforce.org"
3. Wait 1
4. Click tab "Learning Stream"
5. Wait 1
**Expected:**
- See "Digital reach"
- Property tabs for WW360, onewaterworkforce.org, Learning Stream
- Top organic queries section visible
- Sample data badge on OWW / LS tabs

### Test: Water System Landscape
**URL:** ${BASE_URL}/water-systems
**Steps:**
1. Wait 2
**Expected:**
- See "water system landscape"
- See "Live"

### Test: Continuity Workspace
**URL:** ${BASE_URL}/continuity
**Steps:**
1. Wait 2
**Expected:**
- See "Workforce continuity"

### Test: Admin Settings
**URL:** ${BASE_URL}/admin/settings
**Steps:**
1. Wait 2
**Expected:**
- See "SDWIS"
- See "refresh"

### Test: Document Studio
**URL:** ${BASE_URL}/studio
**Steps:**
1. Wait 3
**Expected:**
- See "Document Studio"
- See "All documents"
- See "Program briefs"
- Button "New document" visible
- Button "Import" visible
- Button "Record tutorial" visible

### Test: Document Studio — Record tutorial mode picker
**URL:** ${BASE_URL}/studio
**Steps:**
1. Wait 3
2. Click button "Record tutorial"
3. Wait 1
**Expected:**
- Modal "Record tutorial" visible
- Five recording modes: Screen, Screen + Camera, Camera only, Voice only, Screenshots
- Close dismisses the modal (no live screen capture required)

### Test: Document Studio Tour
**URL:** ${BASE_URL}/studio
**Steps:**
1. Wait 3
2. Click button "Tour"
3. Wait 1
**Expected:**
- See "Welcome to Document Studio"
- Button "Next" visible
