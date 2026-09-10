# Document Studio tutorials (public assets)

| File | Purpose |
|------|---------|
| `application-steps-sample-dmas.mp4` | **Default** — HeyGen AI Studio Document Studio overview (`2497c7dd…`, ~29s). |
| `application-steps-sample-dmas.vtt` | Captions for the Studio overview |
| `application-steps-heygen.json` | Provenance (HeyGen video / project ids) |
| `application-steps-sample.mp4` | Prior watermarked Abigail catalog sample (fallback A/B) |
| `application-steps-sample.vtt` | Captions for Abigail |

**A/B in browser:** `localStorage.setItem('ww360-application-steps-avatar', 'dmas'|'abigail')` then reload Studio.

**HeyGen cast (Mission Control):** `config/tour-video-avatars.json` — preferred look id `10cf2af011bb47caa54856761c38534a` (beige blazer); legacy default look `4873ffc3c89844948e61634fb0b1d799`.

Source draft / review: Mission Control → SaaS Apps → WW360 → Tour Videos → slot `application-steps`  
Guidance: `/opt/projects/workspace/docs/ww360-application-steps-recording-guidance.md`  
Script: `/opt/projects/workspace/docs/tour-video-scripts/ww360-application-steps.md`

Do **not** publish a watermarked test render as the customer-facing final — run paid Generate → Approve → Publish when ready.
