# WW360 QA Test Suite

Pipeline QA uses credentials from `~/.openclaw/openclaw.env` with prefix `WW360`:
`WW360_APP_URL`, `WW360_E2E_USERNAME` (or `WW360_TEST_EMAIL`), `WW360_E2E_PASSWORD` (or `WW360_TEST_PASSWORD`).

## Variables (substituted by pipeline)

- `${BASE_URL}` — from WW360_APP_URL (staging)
- `${TEST_EMAIL}` — from WW360_E2E_USERNAME or WW360_TEST_EMAIL
- `${TEST_PASSWORD}` — from WW360_E2E_PASSWORD or WW360_TEST_PASSWORD

## Smoke Tests (Required)

### Test: Landing Load
**URL:** ${BASE_URL}/
**Steps:**
1. Wait 2
**Expected:**
- Page loads within 5 seconds
- Title or hero mentions Workforce / WW360

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
- See "Sign in to Workforce 360"
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
