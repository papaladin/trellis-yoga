# Trellis — Task List

Reconciled after an architecture + yoga-pedagogy review of the first implementation pass, and a round of decisions on previously open questions. Supersedes the earlier task list. Each item notes its origin: 🆕 new from this review, ✏️ modified from the earlier list, or ✅ carried over unchanged (already correctly identified).

---

## 🔥 P0 — Critical, do first 

### 0.1 Fix absolute-path deployment bug 🆕. ---> DONE
**Why:** `sw.js`, `index.html`, `manifest.json`, and the service-worker registration in `app.js` all use absolute root paths (`/index.html`, `/icon-192.png`, `register('/sw.js')`, `"start_url": "/"`). GitHub Pages serves this repo at `username.github.io/trellis-yoga/`, not domain root — every one of these will 404 once actually deployed, even though it works fine in local testing.
**How:** Convert every internal reference to a relative path (`./sw.js`, `./icon-192.png`, `"start_url": "./"`, etc.).
**Files:** `sw.js`, `index.html`, `manifest.json`, `app.js`

### 0.2 Convert `sequence_role` from string to array ✏️ ---> DONE
**Why:** Currently stored as `"Pathway / Peak"` and matched via `.includes()` substring search. Works today by coincidence, but fragile and doesn't extend cleanly — directly causes 0.3 below.
**How:** Change to `["Pathway", "Peak"]` for every pose in `poses.json`. Update all `sequence_role.includes(...)` filters in the generator to array `.includes()` (same method name, different semantics — verify each call site).
**Files:** `data/poses.json`, `session-generator.js`

### 0.3 Fix Integration/Cooldown stage mismatch ✅ ---> DONE
**Why:** Only Savasana carries `"Integration"`; every real cool-down pose (Seated Forward Bend, Plow, Butterfly, etc.) is tagged `"Cooldown"`. The generator's Integration stage can currently only ever select Savasana.
**How:** Rename the final generation stage to `Cooldown` in `STAGE_WEIGHTS`/`arcStages`. Append Savasana **after** the stage loop as a mandatory final element, not part of the Cooldown pool. Validator must confirm Savasana is the last pose.
**Files:** `session-generator.js`

### 0.4 Guarantee a valid Peak pose ✅ ---> DONE
**How:** Validator checks at least one pose has `sequence_role` including `"Peak"`. If absent, regenerate or force-insert from the eligible pool.
**Files:** `session-generator.js`

### 0.5 Add stage-presence validation ✅ --> DONE
**How:** After generation, confirm every stage has at least one pose. Inject from the original eligible pool if a stage came up empty.
**Clarification (from external review):** the handcrafted onboarding sessions (levels 1–10) don't carry stage labels at all and are too short (2–6 poses) to meaningfully fill five stages — **exempt them from this check entirely** rather than trying to force-fit the arc onto them. They still must end in Savasana (already true in the current code) and open with something gentle, which is the spirit of the arc even without the literal structure.
**Files:** `session-generator.js`

### 0.6 Add input validation to `generateSession()` ✅. -> DONE
**How:** Validate `poseLibrary` is an array; `level` is 1–200 (now fixed, not "or your max"); `focus` ∈ `{relax, strengthen, mobility}`; `duration` ∈ `{short, medium, long}`. Throw descriptive errors.
**Files:** `session-generator.js`

### 0.7 Fix state migration to actually merge ✅ ---> DONE
**Why:** `loadState()` detects a schema mismatch but only logs it — doesn't merge. Users with older saved state get `undefined` for newer fields.
**How:** `Object.assign({}, getDefaultState(), parsed)` after parsing.
**Files:** `storage.js`

### 0.8 Fix replay completion tracking ✏️ (elevated from P2)  ---> DONE
**Why:** Finishing a replayed (non-frontier) level currently takes the identical code path as quitting halfway through one — neither records anything. This silently breaks our own completion rule for the (explicitly allowed, and presumably common) replay case, and undercounts the nudge system's view of practice history.
**How:** Record a session history entry (and apply the finish-or-skip-every-pose / no-early-exit completion check) for **every** session, not just ones that advance the frontier. Only frontier advancement should remain conditional on `completed && level === frontierLevel`.
**Files:** `app.js`

### 0.9 Replace placeholder images with real per-pose illustrations ✏️ (elevated from P2)
**Why:** All 48 poses currently point to the same generic Flaticon icon — the core "illustration per pose" feature is non-functional.
**How:** Pull the actual per-pose Cloudinary URLs from the original `alexcumplido/yoga-api` source and populate `image_url` correctly for each pose.
**Files:** `data/poses.json`

### 0.10 Fix `poses.json` location mismatch between docs and code 🆕 ---> REJECTED, all in root.
**Why:** README documents the file as living at `data/poses.json`; the actual code (`app.js` fetch call, `sw.js` cache list) reads it from the repo root as `poses.json`. Caught by external review — real inconsistency, not just a docs typo.
**How:** Standardize on `data/poses.json` (matches the documented repo layout). Move the file if it's currently at root, and update the fetch call in `app.js` and the cache list in `sw.js` to match.
**Files:** `app.js`, `sw.js`, `data/poses.json`

---

## 🟡 P1 — High priority

### 1.1 True weighted-random-without-replacement ✅ --> DONE
**Why:** A fresh eligible-pool array is built every loop iteration, so removing a chosen pose has no lasting effect — a pose can repeat within a stage.
**How:** Maintain one persistent working array per stage; remove a pose after selection; refill from the original pool only if exhausted (controlled repeats, not failure).
**Files:** `session-generator.js`

### 1.2 Add `intensity` tagging 🆕 --> DONE
**Why:** `body_focus` conflates movement family with severity — Bridge and Wheel share the `Backbend` tag despite very different intensity, so the counterpose rule currently can't tell them apart correctly.
**How:** Add `"intensity": "mild" | "moderate" | "intense"` to every pose. Update the counterpose-tracking logic (1.4 below) to key off this field, not raw `body_focus` membership.
**Files:** `data/poses.json`, `session-generator.js`

### 1.3 Add `hip_rotation` tagging ✅ ---> DONE
**Why:** Standing-pose grouping and balance-transition safety currently infer rotation from the `Hip-Opener` tag, which is anatomically unreliable (e.g. Warrior I vs. Warrior II).
**How:** Add `"hip_rotation": "external" | "internal" | "neutral"` to every pose. Replace the Pathway grouping filters and the rotation-transition rule (1.4) to use this field.
**Files:** `data/poses.json`, `session-generator.js`

### 1.4 Add rotation-transition and intensity-aware counterpose rules ✏️ (merges old 0.6 + 0.7, now dependent on 1.2/1.3; tightened per external review) ---> DONE
**Why the change:** the original version only guaranteed a counterpose showed up *somewhere* in Cooldown, potentially several poses later. For an intense pose (a real backbend, a real arm balance), deferring the release that long is worse practice than resolving it right away — tightened to immediacy.
**How:**
- Detect consecutive standing balance poses with opposite `hip_rotation`; insert a neutral pose (Downward-Facing Dog) between them.
- For any pose with `intensity: "intense"`: the **next** pose in the sequence must be its counterpose (twist / forward-bend / restorative, by `body_focus`) — force-insert one immediately if the next selected pose doesn't already qualify. Exception: if two same-family intense poses are deliberately grouped back-to-back within Peak (a legitimate pattern — e.g. building through a short backbend series), the counterpose must immediately follow the *group*, not each individual pose, but still may not be deferred to general Cooldown mixing. Fall back to Child's Pose if nothing else fits.
**Files:** `session-generator.js`

### 1.5 Implement Shoulder Stand / Plow safety gating 🆕 ---> DONE
**Why:** Both are neck-loading inversions with real injury risk without live instructor correction.
**How:** Restrict eligibility to level 41+ (Building block onward). **"Suitable warm-up," defined concretely (per external review — this was left as an open interpretation before):** at least one pose from `{Cat, Cow, Downward-Facing Dog, Dolphin, Bridge, Plank}` must already appear in the Warming or Pathway stage earlier in the same session before Shoulder Stand or Plow can be selected for Peak/Cooldown. If none of these are present in the pool that stage-generation produced, force one in rather than skipping the requirement. Add a one-time safety disclaimer shown on first app launch (not a substitute for instruction; consult a professional if pregnant or with neck/back conditions; stop if anything hurts).
**Files:** `session-generator.js`, `app.js`, `index.html`

### 1.6 Rescale level macro-blocks to cap = 200 🆕 ---> DONE
**How:** Implement the five-block structure from `README.md` §5.3 (Onboarding 1–10, Foundation 11–40, Building 41–100, Advancing 101–170, Integration 171–200), replacing the current 1–10/11–50/51–1000 bands.
**Files:** `session-generator.js`

### 1.6a Document the precise hold-time-vs-level formula 🆕 (made explicit per external review — was only implied inside 1.6) ---> DONE
**Why:** the block table gives directional ranges ("~35s → 50s") per block, not an actual formula. Left implicit, this is exactly the kind of thing that gets silently decided inside code without a documented rationale — which already happened once this project (the original 1–1000 formula that went flat past level 170).
**How:** Write out the actual per-block interpolation function (e.g. linear from block-start-hold to block-end-hold across the block's level range) as a documented formula in `README.md` §5.3 *before* implementing it in code, not after.
**Files:** `README.md`, then `session-generator.js`

### 1.6b Extend `localStorage` schema for continuity features 🆕 (made explicit per external review — was only implied inside 2.x items) ---> DONE
**Why:** the New-Pose Cap (1.16) and the Plateau Detection design (1.17) below both need session history data beyond what's currently stored.
**How:** Extend the state schema with whatever the finalized designs of 1.16/1.17 actually need (e.g. a per-pose "first seen" record, a consecutive-non-advancing-session counter). Bump `schemaVersion` and confirm the 0.7 migration merge handles it.
**Files:** `storage.js`

### 1.7 Recalibrate duration/pose-count targets 🆕 ---> DONE
**How:** Duration targets: 90–100% of 15/25/45 minutes (confirmed). Pose count caps: short 8–10, medium 12–15, long 16–20 (revised down from 15/22/30 — unrealistic for a data model without bilateral pose repeats).
**Files:** `session-generator.js`

### 1.8 Fix Downward-Facing Dog tagging ✅ ---> DONE
**How:** Change `body_focus` from `["Arm-Balance", "Forward-Bend"]` to `["Forward-Bend", "Standing-Strength"]` — it shouldn't trigger arm-balance counterpose logic.
**Files:** `data/poses.json`

### 1.9 Make Pathway sub-stages focus-aware and peak-aware ✅ ---> DONE
**How:** Use `hip_rotation` (1.3) for grouping. Define sub-stage filters that vary by selected Focus (and ideally by the already-selected Peak pose), rather than the current hardcoded Hip-Opener → Standing-Strength pattern.
**Files:** `session-generator.js`

### 1.10 Add exact Flaticon attribution ✏️ (elevated from P3 — real assets are already live without it) ---> DONE
**How:** Locate the exact required attribution lines and add them as a small footer credit on the Home screen.
**Files:** `index.html`

### 1.11 Service worker cache freshness 🆕 ---> DONE
**Why:** No `skipWaiting()`/`clients.claim()` — combined with cache-first fetching, code changes can be served stale after deploy, working against the fast-iteration priority.
**How:** Call `self.skipWaiting()` on install and `clients.claim()` on activate.
**Files:** `sw.js`

### 1.12 Refactor duplicated pose-selection logic 🆕 ---> DONE
**Why:** The Pathway sub-stage loop and the standard stage loop in the generator are near-identical copy-pasted blocks (weighted selection + exclusion filters) — a maintainability risk as rules grow.
**How:** Extract into one shared `selectNextPose(pool, focus, lastBodyFocus, ...)` helper used by both.
**Files:** `session-generator.js`

### 1.13 Add loading spinner & in-session progress indicator ✅ ---> DONE
**How:** Show a spinner while `poses.json` loads; show "3/12 poses" (or similar) during a session.
**Files:** `index.html`, `main.css`, `app.js`

### 1.14 Implement a proper structural validator ✅ ---> DONE
**How:** One `validateSession(sessionPoses, poseLibrary)` function checking: all five stages present (skip this check for handcrafted levels 1–10, per 0.5), at least one Peak pose, Cooldown precedes Savasana, Savasana exactly once and last, no illegal difficulty for the level, no forbidden transitions, required prep exists (including the concrete Shoulder Stand/Plow warm-up check from 1.5), no excessive repetition, all intense poses immediately counterposed (per the tightened 1.4 rule), pose-count/duration constraints respected. Repair or regenerate on failure.
**Files:** `session-generator.js`

### 1.15 Automated tests for generator invariants ✏️ (elevated from P3 per external review) ---> DONE
**Why elevated:** the generator is now complex enough (weighted selection, five stages, level-blocks, multiple safety rules) that manual testing alone is a real risk during implementation — agreed with the external review on this one.
**How:** Plain assertion functions runnable directly via `node session-generator.test.js` — **no Jest/Vitest**, keeping with the no-build-step philosophy. Assert: Savasana always last, no illegal difficulty per level, all five stages present (except handcrafted levels), Peak stage non-empty, no immediate duplicates, counterpose rule holds, pose-count/duration targets met, Shoulder Stand/Plow gating respected.
**Files:** New `session-generator.test.js`

### 1.16 New-pose cap per session ✏️ (elevated from P2 per external review — agreed, this one's simple enough to specify now) ---> DONE
**Why:** without this, progression can feel like a reshuffled slot machine rather than a program building on itself — and unlike Plateau Detection below, this doesn't need open design work, it's a simple counting rule.
**How:** Track which pose IDs a user has completed at least once (needs 1.6b). Cap new (never-seen) poses at 2 per session — if the weighted selection would introduce a 3rd, prefer a previously-seen pose from the same eligible pool instead.
**Files:** `session-generator.js`, `storage.js`

### 1.17 Implement Plateau Detection Nudge (Replaced the old "Variation Mode" plan) ---> DONE WITH DIFFERENT IMPLEMENTATION
- **Status:** Implemented (P1 completed).
- **Logic:** The app checks the last 3 completed sessions in `recentSessions`. If they are the exact same level, a "Plateau" is detected.
- **Action:** The app uses the exact same "Soft Nudge" UI system as the Focus Nudge. A message appears in the permanent HUD footer saying: *"You've mastered Level X several times! Ready to try Level X+1?"*, and the `frontierLevel + 1` node is visually highlighted with a terracotta glow. This is a soft suggestion; the user can still freely replay the plateau level.
- **Why:** This prevents user stagnation without forcing them to advance, and elegantly reuses the existing UI architecture.

---

## 🟢 P2 — Medium priority (v1.1)

- **2.1 Export/import progress** — fix serialization (parse-then-stringify, not double-stringify) and add UI buttons. *(`storage.js`, `app.js`)* --> done with differeent implementation (quick level)
- **2.2 Refactor globals into a `TrellisApp` class** in `app.js` for testability/maintainability. Optional — not urgent for this app's scope.
- **2.3 Implement Plateau Detection** — once 1.17's design is documented. *(Implementation only; design work is P1.)*. --> DONE
- **2.4 Recent-history body-focus balancing** — design the lookback window and deprioritization mechanism, then implement. Not yet designed — no external review pushback on this one staying deferred. --> done with a silently decided formula. to be reviewed;
- **2.5 Session-to-session carryover** (favor re-including a pose or two from the immediately preceding session) — separate, smaller feature from the new-pose cap (which moved to 1.16). Not yet implemented. --> deferred
- **2.6 Virtualized/windowed rendering** for the level list — not urgent at 200 levels on a modern iPhone, but `renderTrellis()` currently rebuilds all nodes from scratch on every state change; worth addressing if it ever feels sluggish. --> rejected
- **2.7 Wake Lock re-acquisition on `visibilitychange`** — currently only re-requested on each new pose; a very long single hold (e.g. a 5-minute Savasana) combined with briefly backgrounding the app could lose the lock until the next pose transition.
- **2.8 Fix double-render on load** — `loadPoses()` already calls `renderTrellis()`/`renderNudge()` internally; the `DOMContentLoaded` handler calls `renderTrellis()` again immediately after. Harmless but wasteful. --> done
- **2.9 Responsive layout pass** for tablet/desktop widths — flagged since this is now expected to be shared beyond iOS. -- defered for when gross wireframe layout is final.

---

## 🔵 P3 — Low priority / polish

- **3.1 Real visual design pass** — palette, typography, vine graphics. Deliberately deferred (see README.md §8); current colors are a placeholder, not a decision.
- **3.2 Skip-pose confirmation dialog.**
- **3.3 Level-completion celebration** (toast/animation on frontier advance).
- **3.4 Pose ID renumbering** — the gap at #2 is inherited from the original source data, not a bug introduced here. Low value relative to the risk of touching the many hardcoded ID references (Savasana=11, Cat=7, etc.) scattered through the generator — recommend leaving as-is unless it actually causes confusion.
- **3.5 Linting/formatting (ESLint/Prettier)** — reconsider: this tooling implies an npm-based workflow, which cuts against the explicit no-build-step/fast-iteration priority for this project. Skip unless you specifically want it.

---

## Next concrete step

Items **0.2, 1.2, and 1.3** (array-ify `sequence_role`, add `intensity`, add `hip_rotation`) should be done together as one data-tagging pass across all 48 poses, since they touch the same file and the same review process — this was already flagged as the next deliverable in `README.md` §11. Item **0.10** (poses.json location) should happen in the same pass, since it touches the same file.