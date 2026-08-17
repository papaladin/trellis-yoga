# Trellis

A guided yoga journey app, in English and French. Levels 1–200, three focuses (Relax / Strengthen / Mobility & Flexibility), three durations, algorithmically generated sessions following real yoga sequencing principles. Runs as an installable app with no App Store, no account, and no server — built primarily for iOS but works as a plain website or PWA on Android and desktop too. Multi-user by construction: each person's progress lives independently in their own browser's local storage.

This file covers what it is, how to run/deploy it, and the full design record. See **[TASKS.md](./TASKS.md)** for what's still genuinely open.

---

## Quick start

### Repo layout

```
index.html             Entry point — loading, home, session, and completion screens, plus safety disclaimer modal
main.css                Styling
app.js                   Main controller (TrellisApp class) — state, timer, screen transitions, i18n
session-generator.js     Session generation algorithm
storage.js               localStorage read/write + schema versioning (schema v2)
nudge.js                 Focus-balance and plateau nudge logic
locales.js               EN/FR UI string dictionary
poses.json               48-pose dataset (see §4)
manifest.json             PWA manifest
sw.js                     Service worker (offline caching) — registered for real deployments only, see §2
tests/tests.html, tests/session-generator.test.js, tests/nudge.test.js   Browser-run test suite (no build step, no Node)
icon-192.png, icon-512.png   App icons
```

`poses.json` lives at the repo root, not in a `data/` subfolder — settled decision.

### Running locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Open `tests/tests.html` the same way to run the test suite in-browser. The service worker deliberately does **not** register on `localhost`/local-network addresses (see §2) — no cache-clearing dance needed while iterating.

To test on a phone before deploying, find your computer's local network IP and open `http://<your-ip>:8000` on the phone (same WiFi network) — this also skips service worker registration, for the same reason.

### Deploying

```bash
git push
```

GitHub Pages redeploys automatically. Live at `https://<username>.github.io/trellis-yoga/`.

### Installing

- **iOS (primary target):** Safari → Share → "Add to Home Screen" → runs full-screen, no browser chrome, own icon, offline-capable.
- **Android:** Chrome will typically offer an "Install app" prompt, or Menu → "Add to Home screen."
- **Desktop:** Chrome/Edge can install via the omnibox install icon. Safari desktop has no install step, but the site works fine as a regular tab.
- **Anyone without installing:** it's a normal website — works in any modern browser, just without the full-screen/offline benefits of installing.

### Data & attribution

Pose text data originates from [`alexcumplido/yoga-api`](https://github.com/alexcumplido/yoga-api) (MIT license). Pose illustrations are real per-pose Cloudinary SVGs pulled from that same source (see §4). Flaticon-sourced assets (where used) are attributed in the footer.

### License

**Open question, not yet decided.** A `LICENSE` file (GNU AGPLv3) exists in the repo, but this was never actually discussed or chosen deliberately — it appeared during implementation. Worth a real decision before this goes further: AGPL is a strong copyleft license built around network-service source-disclosure obligations, which is a mismatch for a static personal app shared with friends. A permissive license (MIT, matching the source data) or no license at all are both more typical choices for this kind of project — but this needs an explicit answer, not an assumption.

### Status

Active development. Core generator, safety rules, bilingual UI, nudge system, and test suite are implemented and — as of this pass — verified working. See TASKS.md for what's left.

---

## Architecture & design decisions

*Status: core architecture stable. This section reflects what's actually true today — verified by reading the code, not by trusting prior task-list claims.*

### 1. What we're building

A guided yoga session app structured as a long-term journey rather than a single class. Guided sessions show, per pose: **posture name (EN/FR), illustration, hold timer, and a short description**. Sessions are organized into **200 levels**, flavored by a **focus** (Relax / Strengthen / Mobility & Flexibility) and a **duration** (short/medium/long), with progress saved between visits.

**Multi-user, by construction, with no extra work.** Because progress lives in `localStorage`, scoped per-browser-per-device, every person who opens the app gets their own independent journey automatically — no accounts, no login, no backend.

### 2. Tech stack & hosting

**Static HTML/CSS/JS, no build step, hosted on GitHub Pages, installed as a PWA.**

- **No framework/build step.** The test suite runs in-browser via `tests/tests.html`, not through Node/Jest — the whole project stays buildless.
- **GitHub Pages:** free static hosting, `git push` deploy. Repo: `trellis-yoga` (public).
- **PWA over native:** ruled out native iOS/React Native/Capacitor early — all require an Xcode build+signing step, more friction than a PWA for no benefit at this stage.
- **Service worker registration is environment-gated.** It registers normally for real deployed users, but deliberately skips itself on `localhost`, `127.0.0.1`, and local-network addresses (`192.168.x.x`, `10.x.x.x`) — its cache-first strategy was causing stale-cache problems during local development (edits not showing up after refresh, notably on macOS Safari). This preserves offline support for actual users while keeping local iteration friction-free.
- **Deployment path constraint:** GitHub Pages project sites serve from `username.github.io/trellis-yoga/`, not domain root — all internal references are relative (`./sw.js`, `./icon-192.png`, etc.), including in `manifest.json`.

### 3. Platform-specific technical constraints

**iOS Safari is the primary, most-constrained target**, but the app works as a plain website, Android PWA, or desktop tab too.

- **Screen sleep:** mitigated with the **Wake Lock API** (iOS Safari 16.4+, Android/desktop Chrome/Edge), feature-detected, degrades gracefully elsewhere, and re-acquired on `visibilitychange`.
- **Timer accuracy when backgrounded:** timestamp-based, not interval counting.
- **Audio cues:** a Web Audio API chime plays on pose completion — implemented (there is no Vibration API on iOS/desktop, so this is the universal cue).
- **Notifications:** none implemented — a scope decision, not a limitation; push would need a server this static architecture doesn't have.
- **Layout:** still mobile-first only; no responsive pass yet for tablet/desktop widths.

### 4. Data source

**Pose text data originates from `alexcumplido/yoga-api` (MIT license).**

- 48 poses across 12 categories, difficulty-tagged (Beginner/Intermediate/Expert).
- **Illustrations: resolved.** 47 of 48 poses now use their real per-pose Cloudinary SVG URL, pulled directly from the source database and verified reachable. The one exception is pose id 2.
- **Pose id 2 — a correction worth understanding.** Earlier in this project, id 2 was believed to be a gap in the original source, and an invented pose ("Cobra") was added to fill it. That belief was **wrong** — id 2 in the real source is "Half Boat" (Ardha Navasana), a genuine pose with a real illustration and real description text. The correct data for it (matching schema, tagged consistently with the rest of the set) has been prepared and handed over; swapping it in for the current Cobra entry is a small manual edit to `poses.json`, not yet applied as of this document.
- Flaticon-sourced assets (where still used) require attribution, implemented in the footer.
- **Schema, as implemented:**
  - `sequence_role` (array) — which arc stage(s) a pose is eligible for.
  - `body_focus` — backbend / forward-bend / twist / hip-opener / standing-strength / balance / inversion / core / arm-balance / restorative.
  - `intensity` — `mild` / `moderate` / `intense`.
  - `hip_rotation` — `external` / `internal` / `neutral`.
  - `load` — `{ neck, wrists }`, each `low`/`high` — drives neck-prep and wrist-release safety rules.
  - `unilateral` — boolean; if true, the generator splits the pose into Left/Right entries with the hold time divided between them. **Now works in procedurally-generated sessions (levels 11–200), not just the handcrafted onboarding levels — this was a real bug, fixed this pass.**
  - `translations`, `description_en`, `description_fr` — bilingual display text.
  - `image_url` — real per-pose illustration (see above).

### 5. Session generation architecture

#### 5.1 The session arc: five stages, always ending in Savasana

Centering (5%) → Warming (20%) → Pathway to the Peak (25%) → Peak (30%) → Cooldown (20%), always followed by Savasana as a mandatory final pose. Handcrafted onboarding sessions (levels 1–10) are exempt from the stage-presence check.

#### 5.2 Focus model: 3 focuses

Relax / Strengthen / Mobility & Flexibility. Implemented via `FOCUS_MODIFIERS` (a hold-time multiplier per `body_focus` tag) **and** a selection-weight bonus for matching tags in `selectWeightedPose`. **Still open:** the hold-time multipliers were rebalanced (reduced) to mitigate possible double-reinforcement with the selection-weight bonus, but both mechanisms still coexist — not fully resolved, just less extreme. Tracked in TASKS.md.

#### 5.3 Level structure: 200 levels, 5 macro-blocks

| Block | Levels | Difficulty pool |
|---|---|---|
| Onboarding | 1–10 | Beginner only, handcrafted fixed sequences |
| Foundation | 11–40 | Beginner + Intermediate |
| Building | 41–100 | + Expert (Peak/Cooldown only, above level 41 — also where Shoulder Stand/Plow unlock) |
| Advancing | 101–170 | Full pool, hold time scaling to its cap at 170 |
| Integration | 171–200 | Full pool, hold time plateaus — deliberately, a refinement phase |

Hold-time formula: `baseHold = min(60, max(20, 20 + (level − 10) × 0.25))`, then Focus modifier, then capped at 90s (long) / 60s (short/medium), floored at 20s.

**Pose count: ranges, not fixed numbers** — short 8–10 distinct poses, medium 12–15, long 16–20. A minimum-enforcement pass backfills from the Cooldown-appropriate pool if generation would otherwise fall short. **Important clarification, fixed this pass:** these ranges count *distinct* poses (a Set of pose ids), not raw session-array entries — a bilateral pose's Left+Right split correctly counts as one pose toward this range, not two. (Note: the raw entry count can still exceed the range slightly in rare cases where the safety-repair pass injects extra poses after the count check already ran — see TASKS.md for the minor known edge case.)

#### 5.4 Sequencing safety rules

- **Counterpose rule:** the pose immediately following an `intensity: "intense"` pose is constrained to Twist/Hip-Opener/Forward-Bend/Restorative, with a Child's Pose fallback.
- **Rotation-transition rule:** consecutive poses with opposite non-neutral `hip_rotation` get Downward-Facing Dog inserted between them.
- **Warm-the-spine-first / neck-prep / wrist-release:** driven by the `load` field and a shared six-pose warm-up set — **Cat, Cow, Downward-Facing Dog, Dolphin, Bridge, Plank** — any of which satisfies the "properly warmed up" requirement before a Backbend or a `load.neck: "high"` pose (Shoulder Stand, Plow). This is the originally-intended six-pose set; it was already correctly implemented in code, even though an earlier version of this document incorrectly described it as narrowed to just Cat/Cow.
- **Shoulder Stand / Plow gating:** restricted to level 41+.
- **Backbend → Forward-Bend rule:** Child's Pose inserted between them if they'd otherwise land adjacent.
- A one-time bilingual safety disclaimer is shown on first launch.

#### 5.5 Cross-session continuity

- **Rolling focus-balance nudge:** 14-day window; if one focus leads another by at least 2 completed sessions, surfaces a soft suggestion.
- **Plateau nudge:** if the user's last 3 completed sessions were all the exact same level, a soft nudge suggests the next level up, with that node visually highlighted. This is intentionally simple — it's "you've done this exact session 3 times, here's a nudge to try the next one," with no concept of being "stuck" or any frontier-relative logic. Works the same whether the repeated level is the current frontier or an old level being replayed.
- **New-pose cap:** at most 2 never-before-seen *distinct* poses per session. **Fixed this pass, two bugs at once:** the counting logic was reading the wrong property (`p.id` on a `{pose, holdTime, side}` wrapper, always `undefined`) so it was actually counting every pose added so far rather than new ones specifically; and it wasn't deduplicating by id, so a bilateral pose's Left+Right entries were counting as two new poses instead of one. Both fixed together, verified with tests.
- **Body-focus history:** a real 14-day rolling window, computed fresh from `recentSessions` each time a session starts (`computeRecentBodyFocusHistory`) — a pose family used heavily recently gets a selection-weight penalty; older usage doesn't count against it. The separate lifetime cumulative counter that used to exist alongside this (unused, dead weight, growing forever in `localStorage`) has been removed — see §6.

### 6. Progress & persistence

- `localStorage`, on-device only, schema **v2**. `loadState()` merges saved state onto current defaults, and migrates v1 saves by stripping the now-removed `bodyFocusHistory` field (see §5.5).
- **Frontier vs. current play are distinct:** frontier only advances on completing the current frontier level; any past level can be freely replayed without affecting it.
- **"Completing" a level:** every pose finished or skipped, session not exited early — applies uniformly to frontier sessions and replays.
- **No file-based export/import**, by deliberate decision — managing a downloaded JSON file is a bad experience for a non-technical iPhone user, the actual target audience. Progress lives on one device/browser; if it's lost, it's an accepted trade-off.
- **"Quick Unlock" utility:** a 🔓 button prompts for a level number, then requires explicit confirmation (since it resets `recentSessions` and `seenPoses`) before jumping there. A deliberate utility/debug tool, not a replacement for export/import.

### 7. Screens

- **Loading screen:** spinner while `poses.json` loads.
- **Home screen:** plant/vine level-select (locked/available/completed node states, plus a highlighted "suggested" node during a plateau nudge). Persistent bottom HUD: focus selector, duration selector, nudge message, language toggle (EN/FR), Quick Unlock, attribution.
- **Session screen:** pose illustration, bilingual name (with Left/Right suffix for unilateral poses), description, progress counter, timer, skip/pause/exit controls, completion chime.
- **Completion screen:** shown after finishing/skipping through all poses; user manually continues.
- **Safety disclaimer modal:** shown once, first launch.

### 8. Visual & design identity

**Status: still open, deliberately.** Current placeholder: sage green `#8DB580`, terracotta `#D98866`, Georgia serif. A real design pass remains a future decision.

### 9. Naming

App/site name: **Trellis**. Repo: **`trellis-yoga`**.

### 10. Open items remaining

See TASKS.md — kept there rather than duplicated here, since this list churns faster than the architecture does.

### 11. Next concrete deliverable

Apply the Half Boat swap to `poses.json` (§4), and get an explicit decision on the license (see "License" above). Neither requires further design work — both are just waiting on action.