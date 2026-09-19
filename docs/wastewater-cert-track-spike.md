# Spike: WW360 wastewater operator certification track (Wave 1c)

**Status:** Spike only — no schema/API/UI shipped in this doc.  
**Branch:** `develop`  
**Date:** 2026-09-19  
**Contract:** [`docs/one-water-integration-contract.md`](./one-water-integration-contract.md)  
(canonical workspace copy: `/opt/projects/workspace/docs/one-water-integration-contract.md`)

---

## Goal (small)

Extend WW360’s existing drinking-water OpCert / CEU model so wastewater operator certs (NYSDEC / NYWEA) can be stored, filtered, and summarized for AquaSafe + aquasafe-wastewater via `coverage.summary` — **without** a large refactor of continuity UI or CEU math.

---

## How drinking-water certifications are modeled today

### Model

| Path | Role |
| --- | --- |
| `backend/app/models/workforce_succession.py` → `WorkforceCertification` | Table `workforce_certifications`: `certification_type`, `certification_grade`, `issuing_authority`, dates, `employee_code`, **no `cert_program`** |
| Same file → `WorkforceTrainingCourse` / `WorkforceScheduledTraining` | Already have `cert_program` (`String(50)`, default `"drinking_water"`) |
| `backend/app/models/sync.py` | `ExtUser`, `ExtDistrict`, `ExtDistrictMembership`, `ExtModuleFlag` — **no `ExtFacility` yet** |

Unique key on certs: `(district_code, employee_code, certification_type, certification_grade, credential_id)`.

### Schemas

| Path | Role |
| --- | --- |
| `backend/app/schemas/workforce_succession.py` | `WorkforceCertificationBase` / `Create` / `Update` / `Read` — free-form `certification_type` + optional `certification_grade` |
| Same file | Training course schemas already expose `cert_program` (default `drinking_water`) |

### CEU / grade taxonomy (drinking water only)

| Path | Role |
| --- | --- |
| `backend/app/services/workforce_succession/ceu_requirements.py` | NYSDOH 10 NYCRR Subpart 5-4: grades IA/IIA/…/C/D; **3-year** renewal; `cert_program`: `drinking_water` \| `backflow` |
| `backend/app/services/workforce_succession/training_scraper.py` | `_infer_cert_program()` returns `wastewater` if course cert type is `"wastewater"`, else `drinking_water` |

### API

| Path | Role |
| --- | --- |
| `backend/app/api/endpoints/workforce_crud_routes.py` | CRUD: `POST/PATCH/DELETE /certifications`; list via generic workforce entity list |
| `backend/app/api/v1/endpoints/sync.py` | Ingest AquaSafe outbox; HMAC `X-WW360-Signature` |
| `backend/app/services/sync_processor.py` | Handlers: `user`, `district`, `district_membership`, `module_flag` only — **facility aggregate ignored today** |

### UI (drinking-water OpCert)

| Path | Role |
| --- | --- |
| `frontend/src/components/regulator/OpCertProgramPanel.tsx` | NYSDOH OpCert coverage KPIs |
| `frontend/src/pages/WorkforceContinuityPage.tsx` + CEU tabs | Cert cliff, grade display from `certification_type` / `certification_grade` |
| `frontend/src/components/workforce/workforcePlanningFormModel.ts` | Cert form fields (no program discriminator) |

**Implication:** Operator cert rows are program-agnostic strings. Program split already exists for **courses**, not for **certifications**. Wastewater can piggyback on `cert_program` without inventing a parallel table.

---

## Proposed additive shape

### 1. `cert_program` on certifications

Add nullable-or-default column / schema field:

```text
cert_program: "drinking_water" | "wastewater"   # default drinking_water (non-breaking)
```

- Default existing rows → `drinking_water`.
- Keep `certification_type` as today (`Operator`, `Treatment`, `Distribution`, …) for DW; for WW use e.g. `Operator` or `Wastewater` + grade.
- Do **not** widen the unique constraint in PR1 unless collisions appear (same employee holding DW + WW same grade string is unlikely if grade vocabularies differ: `IIA` vs `3A`).

Optional later: `exam_body` (`abc` / `nysdoh`) — out of scope for first slice.

### 2. NYSDEC wastewater grade / renewal rules (reference only)

| Item | Value |
| --- | --- |
| Authority | NYSDEC / NYWEA admin (6 NYCRR Part 650) |
| Grades | Non-AS: **1–4**; activated sludge: **1A–4A** |
| Exam | ABC (WPI) computer exam |
| Renewal cycle | **5 years** (contrast: DW = 3 years in `ceu_requirements.py`) |
| RTC hours | 1/1A: 20 · 2/2A: 40 · 3/3A: 60 · 4/4A: 80 |
| Cyber CEU | For expirations **≥ 2027-01-01**: 2h (1/1A, 2/2A) or 4h (3/3A, 4/4A) **within** total RTC — not additive |

Spike follow-up (separate small module, not a rewrite of DW CEU): e.g. `ceu_requirements_wastewater.py` or a `cert_program="wastewater"` branch in the taxonomy — **do not** change `RENEWAL_CYCLE_YEARS = 3` globally.

### 3. `ExtFacility` consumption of `facility.*`

Per contract §5, WW360 consumes `facility` from AquaSafe (PWS) and aquasafe-wastewater (WWTP / collection_system).

**Gap:** no `ExtFacility` model or sync handler.

Minimal additive plan:

```text
ext_facilities
  facility_id (PK or natural + publisher)
  publisher          # aquasafe | aquasafe_wastewater
  district_code
  facility_type      # pws | wwtp | collection_system
  name, state_code
  pwsid, npdes_id, spdes_id
  plant_class        # 1|2|3|4|1A|2A|3A|4A|null  (WW required grade hint)
  design_flow_mgd, lat/lon, is_active
  version, synced_at
```

Wire in `sync_processor._HANDLERS["facility"]`. Idempotency: `(publisher, facility_id)` or stable `facility_id` as in contract.

Link to critical functions later via existing `linked_facility_id` **or** a new FK to `ext_facilities` — prefer a dedicated FK in a later PR; do not overload integer AquaSafe IDs blindly.

### 4. `coverage.summary` API sketch

Aligned with contract §6:

```
GET /api/v1/coverage/summary?district_code=…&facility_id=…
→ {
  "facility_id": "...",
  "required_grade": "3A",          # from ExtFacility.plant_class
  "program": "wastewater | drinking_water",
  "covered": true,
  "chief_operator": { "name": "...", "grade": "3A", "expires_on": "2027-06-01" },
  "warnings": ["cyber_ceu_due", "expires_within_90_days"]
}
```

**Coverage heuristic (v0):** facility `plant_class` → required grade; find active `WorkforceCertification` on district with matching `cert_program` and grade ≥ required (define simple ordinal map for 1–4 / 1A–4A); pick earliest-expiring qualifying “chief” or primary role-coverage link if present. Missing WW360 data → callers hide chip (contract).

Warnings:

- `expires_within_90_days` — reuse cliff logic.
- `cyber_ceu_due` — only if `program=wastewater` and `expires_on >= 2027-01-01` and cyber RTC incomplete (stub as warning flag until CEU categories exist).

Auth: service token or user JWT; district-scoped. No UI dependency in first API PR.

### 5. UI chip (tiny)

- Continuity / cert table: small program chip `DW` | `WW` from `cert_program`.
- Optional: AquaSafe/Wastewater risk chip consumes `coverage.summary` (partner apps) — WW360 only needs to **publish** the endpoint first.

---

## Suggested first PR slices (keep small)

| PR | Scope | Out of scope |
| --- | --- | --- |
| **A – Schema** | Add `cert_program` to `workforce_certifications` + Pydantic; default `drinking_water`; migration | CEU math, facility sync, UI redesign |
| **B – ExtFacility + sync** | Model + `facility` handler + contract tests | Coverage API, UI |
| **C – coverage.summary** | Read-only endpoint + grade ordinal helper + warnings stub | Full cyber CEU ledger |
| **D – UI chip** | Cert list / form: program select + chip; filter query param | OpCert panel rewrite |

Do **not** merge A–D into one PR. Prefer A alone as first mergeable change.

---

## Non-goals (this wave)

- Rewriting `ceu_requirements.py` or DOH-352 fill for wastewater.
- Replacing free-form `certification_type` with a rigid enum across all cert kinds (CDL, OSHA, etc.).
- Rsync / dirty-tree deploy — PR to `develop` only.

---

## Quick verification checklist (when implementing)

1. Existing DW cert CRUD still works with default `cert_program=drinking_water`.
2. Sync unknown aggregates still no-op safely; `facility` upserts are idempotent.
3. `coverage.summary` returns 200 with `covered: false` when no operators — never 5xx for empty roster.
4. Partner chips hide when WW360 unreachable (contract).

---

## References

- Integration contract: [`one-water-integration-contract.md`](./one-water-integration-contract.md)
- NYSDEC operator certification overview: https://dec.ny.gov/environmental-protection/water/water-quality/wastewater-treatment-resources/plant-operation/operator-certification
- Cyber renewal (exp ≥ 2027-01-01): NYWEA renewal + DEC wastewater cybersecurity resources
