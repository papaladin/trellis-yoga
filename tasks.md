# Trellis — Task List

Grouped by block. Each block's implementation tasks are followed by **one** combined documentation + test task covering that whole block, rather than repeating "update docs" per item.

---

## Block A — Pose Illustrations (Priority 1)

### A.1 Retrieve and verify real per-pose image URLs
**Why:** all 48 poses currently share one placeholder icon. The "original URLs are broken" claim doesn't hold up against the source SQLite database — the URLs found there (Cloudinary, `res.cloudinary.com/dko1be2jy/...`) are well-formed and match what's live in the source repo's own README.
**How:** Query `url_svg` (or `url_png`) per pose from the source database, compile the full 48-entry list, and verify a sample actually load in a browser before trusting the whole set.
**Files:** none yet — this is a data-gathering step.

### A.2 Wire verified URLs into `poses.json`
**How:** Once A.1 is confirmed, replace the placeholder `image_url` for all 48 poses (including the added Cobra pose — see Block B) with real URLs. If any pose's URL is genuinely dead, flag it individually rather than assuming the whole set is bad.
**Files:** `poses.json`

### A.3 Docs & tests for Block A
- **README:** update §4 to reflect real image sourcing (remove the "known issue" framing once resolved); remove item #2 from §10's open list.
- **Tests:** add a basic sanity check to `session-generator.test.js` (or a new lightweight check) confirming no two poses share the same `image_url` except intentionally.

---

## Block B — Data Schema Cleanup

### B.1 Resolve the Cobra pose question
**Decision so far:** keep for now, revisit later. No action required this pass beyond documenting it clearly (already done in README §4). Leave as a standing decision point, not a task with a deadline.

### B.2 Convert pose-count caps from fixed numbers to ranges
**Why:** currently `MAX_POSES_TOTAL = { short: 10, medium: 15, long: 20 }` — single ceilings, not the ranges (short 8–10 / medium 12–15 / long 16–20) originally intended. This defeats part of the point of duration affecting pose count as well as hold time.
**How:** Change to `{ short: {min: 8, max: 10}, medium: {min: 12, max: 15}, long: {min: 16, max: 20} }`. Keep `max` as the existing hard ceiling on the generation loop. Add a floor: after the stage loop and before Savasana is appended, if `sessionPoses.length < min − 1`, keep generating additional poses (drawing from the same eligible pools used during Cooldown) until the minimum is met, respecting the existing safety rules rather than bypassing them.
**Files:** `session-generator.js`

### B.4 Docs & tests for Block B
- **README:** update §5.3's "known issue" note to reflect the fix; update §10 item #4.
- **Tests:** add assertions to `session-generator.test.js` confirming generated sessions (levels > 10) fall within `[min, max]` pose count for each duration, not just under the max.

---

## Block C — Shoulder Stand / Plow Safety

### C.1 Restore the six-pose warm-up set
**Why:** the current `hasNeckPrep` check only recognizes Cat/Cow; the originally-specified set was broader (Cat, Cow, Downward-Facing Dog, Dolphin, Bridge, Plank) — restoring it, per your call to roll back.
**How:** In both `needsRepair` and `repairSession`, change the neck-prep check from `['Cat', 'Cow'].includes(sp.pose.english_name)` to checking pose id membership in the full six-pose set (use ids, not English names, to avoid locale/rename fragility — English names get swapped for display but ids are stable).
**Files:** `session-generator.js`

### C.2 Docs & tests for Block C
- **README:** update §5.4's "known narrowing" note to confirm the restored set; update §10 item #5.
- **Tests:** extend the Shoulder Stand/Plow gating suite in `session-generator.test.js` to confirm sessions containing either pose also contain at least one of the six warm-up poses earlier in the sequence.

---

## Block D — Progress Safety UX

### D.1 Add a confirmation step to Quick Unlock
**Why:** it currently resets `recentSessions`, `focusHistory`/`bodyFocusHistory`, and `seenPoses` immediately on entering a valid level number — no confirmation before destroying history.
**How:** After the `prompt()` returns a valid level, show a second confirmation (`confirm()` is fine, or a styled modal matching the disclaimer's pattern if you want it to feel less jarring) explicitly stating that history/progress tracking will be reset. Proceed only on explicit confirmation.
**Files:** `app.js`

### D.2 Docs & tests for Block D
- **README:** update §6's Quick Unlock note to reflect the confirmation step; remove §10 item #6.
- **Tests:** no automated test needed (this is a `confirm()` dialog, not generator logic) — manual verification step, note it as such in the PR/commit description when implemented.

---

## Block E — Deployment Path Cleanup

### E.1 Fix `manifest.json` absolute icon paths
**How:** Change `"src": "/icon-192.png"` and `"/icon-512.png"` to `"./icon-192.png"` / `"./icon-512.png"`, matching the relative-path fix already applied everywhere else.
**Files:** `manifest.json`

### E.2 Docs & tests for Block E
- **README:** remove the "known issue" callout in Quick Start once fixed.
- **Tests:** no automated test applicable — verify manually by loading the manifest under a non-root path (e.g. serve locally from a subfolder to simulate the GitHub Pages path structure) before considering this closed.

---

## Block F — Bilateral Pose Handling Refinement

### F.1 Review pose-count semantics for Left/Right splits
**Why:** each side of a unilateral pose currently counts as a separate entry toward both the pose-count cap (Block B) and the new-pose cap, which may not match how a user perceives "how many poses" they practiced, and could cause a session to hit its pose-count ceiling faster than intended when it includes several unilateral poses.
**How:** Decide whether pose-count and new-pose-cap logic should count *distinct poses* (Left+Right = 1) or *entries* (Left+Right = 2), and make the implementation consistent with that choice. Leaning toward counting distinct poses for the cap logic, since that better matches user perception — but flagging as a decision point rather than dictating it outright, since it changes session pacing.
**Files:** `session-generator.js`

### F.2 Docs & tests for Block F
- **README:** update §5.5 (new-pose cap) and §10 item #14 once resolved.
- **Tests:** add a case to `session-generator.test.js` using a level/duration combo likely to include unilateral poses, asserting pose-count-cap behavior matches whichever semantics were chosen.

---

## Block G — Known Backlog (carried over, not yet scheduled)

These were self-identified as open during the last implementation pass and remain open. No new information changes their priority — listed here so they don't get lost, not because they're being worked this pass.

- **G.1 Resolve Focus double-weighting** — decide whether to keep both the selection-weight bonus and the hold-time multiplier for matching Focus tags, or drop one.
- **G.2 Time-decay the body-focus history penalty** — replace the lifetime cumulative counter with a rolling/recency-weighted version.
- **G.3 Discrete-slot generator refactor** — replace time-budget-based stage filling with guaranteed reserved slots per stage. Flagged as the single biggest remaining architectural question if bugs keep surfacing around thin/empty stages.
- **G.4 Deterministic RNG for tests** — accept an `rng` parameter in `generateSession()` so failing tests can be reproduced exactly.
- **G.5 Audio chime for pose transitions** — not yet implemented at all.
- **G.6 Responsive layout pass** — tablet/desktop widths, deferred pending the visual design pass (Block H doesn't cover this — it's still genuinely just backlog).

### G.7 Docs & tests for Block G
- **README:** no change needed until any of G.1–G.6 actually gets scheduled — §10 already lists all of these accurately.
- **Tests:** N/A until implementation begins on a specific item.

---

## Next concrete step

Block A (image URLs) first — it's both the highest-visibility unfinished feature and the one with a concrete, checkable answer, unlike the design-judgment-call blocks (B, C, F) that follow it.