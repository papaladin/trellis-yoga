# Trellis — Task List

Rewritten from scratch this pass, since the previous version was checked against the actual code and found to be almost entirely stale — most of what it listed as pending was already done, just undocumented. This version only lists what's genuinely still open, verified against the real code as of this pass.

---

## Resolved this pass (for reference — not action items)

- ✅ Bilateral (Left/Right) pose splitting now works in procedural generation (levels 11–200), not just handcrafted levels 1–10.
- ✅ New-pose-cap counting bug fixed (was reading the wrong property, always counting as 0 new / always treating everything past the 2nd entry as capped) — now correctly counts distinct pose ids, so a bilateral pose's two sides count as one.
- ✅ Test suite unblocked — removed dead top-level code in `session-generator.test.js` that threw on import and prevented the entire harness (both suites) from running at all.
- ✅ Deterministic RNG actually wired into real test assertions (new SUITE 11), not just sitting unused. Same-seed reproducibility verified.
- ✅ New SUITE 12 added: bilateral pose handling, including that L/R splits count as one pose toward the distinct-pose cap.
- ✅ Pose-count test assertions corrected to check distinct pose count, not raw array length (raw length can legitimately exceed the range now, due to bilateral splits and safety-repair insertions).
- ✅ Service worker re-enabled, but gated to skip registration on `localhost`/local-network addresses — fixes the stale-cache local-dev problem without losing offline support for real users.
- ✅ Dead state cleanup: removed the unused lifetime `bodyFocusHistory` counter (superseded by the rolling 14-day window, never read after that was introduced) and the bogus `focusHistory` field Quick Unlock was resetting (never existed in the schema, never read). Schema bumped to v2 with a migration to strip the old field from existing saves.
- ✅ Confirmed already correct in code (previous docs incorrectly described these as unresolved): the six-pose Shoulder Stand/Plow warm-up set (Cat, Cow, Downward-Facing Dog, Dolphin, Bridge, Plank), time-decayed body-focus penalty, audio chime, pose-count ranges, `manifest.json` relative paths, Quick Unlock confirmation dialog.

---

## Still open

### 1. Apply the Half Boat data swap
**What:** Pose id 2 is currently "Cobra" (invented, no real source data) — the real source pose at id 2 is "Half Boat" (Ardha Navasana), with real description/benefits text and a working illustration URL, already prepared and handed over in conversation. This is a manual `poses.json` edit, not a design decision — just needs to actually be applied.
**Files:** `poses.json`

### 2. Decide the license
**What:** A `LICENSE` file (AGPLv3) exists but was never a deliberate choice — it appeared during implementation. AGPL's copyleft/network-disclosure terms are a mismatch for a static app shared with friends; a permissive license (MIT, matching the source data) or no license are the more typical fits. Needs an explicit decision, not an assumption either way.
**Files:** `LICENSE`

### 3. Resolve Focus double-weighting fully
**What:** Currently mitigated (hold-time multipliers were reduced) but not resolved — Focus still gets both a selection-weight bonus (`+2.0` per matching tag in `selectWeightedPose`) and a hold-time multiplier (`FOCUS_MODIFIERS`) for the same match. Decide whether to keep both at reduced strength (current state) or drop one entirely.
**Files:** `session-generator.js`

### 4. Discrete-slot generator refactor
**What:** The generator still fills *time budgets* per stage rather than reserving guaranteed slots up front — the loop-continuation logic was improved this pass (poses no longer silently skip on a bad random pick), but a stage can still end up thin if its eligible pool is small. The `needsRepair`/`repairSession` safety net catches genuine gaps, but a discrete-slot design would prevent them by construction instead of patching after the fact. This remains the single biggest architectural question if thin-stage issues ever surface in practice — not urgent unless they do.
**Files:** `session-generator.js`

### 5. Minor: repair-injected poses bypass the distinct-pose cap
**What:** Found while fixing the bilateral/new-pose-cap bugs — `repairSession()`'s safety insertions (counterpose Child's Pose, spine-warmup Cat/Cow, wrist-release, etc.) splice directly into the session array without going through the same `pushPose()`/`distinctPoseIds` tracking the main generation loop uses. In practice this means a session that triggers repair could end up with slightly more distinct poses than its duration's stated max. Low priority — repair is a rare safety-net path, not the common case — but worth fixing for correctness if Block 4 (discrete-slot refactor) doesn't make it moot first.
**Files:** `session-generator.js`

### 6. Responsive layout pass
**What:** Still mobile-first only, no tablet/desktop adaptation. Deferred pending the visual design pass (item 7).
**Files:** `main.css`

### 7. Real visual design pass
**What:** Palette, typography, vine graphics — current colors/type are still the original placeholder, not a deliberate choice. Deliberately deferred throughout this project; still open.
**Files:** `main.css`

---

## Next concrete step

Items 1 and 2 are pure action items (no design work needed) — worth clearing first. Item 3 is a judgment call that doesn't require code archaeology, so it's a reasonable next design conversation. Items 4–6 are all genuinely bigger and can wait.