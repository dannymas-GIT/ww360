# WW360 QA Test Suite

Pipeline QA uses credentials from `~/.openclaw/openclaw.env` with prefix `WW360`:
`WW360_APP_URL`, `WW360_TEST_EMAIL`, `WW360_TEST_PASSWORD`.

## Variables (substituted by pipeline)

- `${BASE_URL}` — from WW360_APP_URL (staging)
- `${TEST_EMAIL}` — from WW360_TEST_EMAIL
- `${TEST_PASSWORD}` — from WW360_TEST_PASSWORD

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

### Test: OWW Dashboard (when staging has seed user)
**URL:** ${BASE_URL}/dashboard/oww
**Steps:**
1. Wait 2
**Expected:**
- Page loads (login redirect acceptable until handoff auth wired)
