# Trellis

A guided yoga journey app, in English and French. Levels 1–200, three focuses (Relax / Strengthen / Mobility & Flexibility), three durations, algorithmically generated sessions following real yoga sequencing principles. Runs as an installable app with no App Store, no account, and no server — built primarily for iOS but works as a plain website or PWA on Android and desktop too. Multi-user by construction: each person's progress lives independently in their own browser's local storage.

This file covers what it is, how to run/deploy it, and the full design record. See **[TASKS.md](./TASKS.md)** for the current implementation task list — that's where anything marked "known issue" or "pending" below gets tracked to resolution.

---

## Quick start

### Repo layout

```
index.html             Entry point — loading, home, session, and completion screens, plus safety disclaimer modal
main.css                Styling
app.js                   Main controller (TrellisApp class) — state, timer, screen transitions, i18n
session-generator.js     Session generation algorithm
storage.js               localStorage read/write + schema versioning
nudge.js                 Focus-balance and plateau nudge logic
locales.js               EN/FR UI string dictionary
poses.json               48-pose dataset (see §4 — currently a mix of the original source snapshot plus one added pose, see known issue)
manifest.json             PWA manifest
sw.js                     Service worker (offline caching)
tests/
--- tests.html, session-generator.test.js, nudge.test.js   Browser-run test suite (no build step, no Node)
icon-192.png, icon-512.png   App icons
```

**Note:** `poses.json` lives at the repo root, not in a `data/` subfolder — this was reconsidered and settled on root as the final decision.

### Running locally

No build step — just serve the folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. To test on a phone before deploying, find your computer's local network IP and open `http://<your-ip>:8000` on the phone (same WiFi network). Open `tests.html` the same way to run the test suite in-browser.

### Deploying

```bash
git push
```

GitHub Pages redeploys automatically. Live at `https://<username>.github.io/trellis-yoga/`.

**Known issue:** `manifest.json`'s icon paths (`/icon-192.png`, `/icon-512.png`) are still absolute. Every other file was correctly switched to relative paths (`./sw.js`, etc.) — this one was missed, and will 404 once deployed under a subpath. See TASKS.md.

### Installing

- **iOS (primary target):** Safari → Share → "Add to Home Screen" → runs full-screen, no browser chrome, own icon.
- **Android:** Chrome will typically offer an "Install app" prompt, or Menu → "Add to Home screen" — similar standalone result.
- **Desktop:** Chrome/Edge can install via the omnibox install icon. Safari desktop has no install step, but the site works fine as a regular tab.
- **Anyone without installing:** it's a normal website — works in any modern browser, just without the full-screen/offline benefits of installing.

### Data & attribution

Pose text data originates from [`alexcumplido/yoga-api`](https://github.com/alexcumplido/yoga-api) (MIT license) — see §4 for the current state of this, including a known deviation. Some pose illustrations are Flaticon-sourced and require attribution — implemented in the Home screen footer.

### Status

Active development. Core generator, safety rules, bilingual UI, and nudge system are implemented and tested. A cluster of known issues and pending decisions remain — see TASKS.md.

---

## Architecture & design decisions

*Status: core architecture stable, first full implementation pass complete. This section reflects what's actually built today, including things we know are wrong or still undecided — those are called out explicitly rather than smoothed over.*

### 1. What we're building

A guided yoga session app structured as a long-term journey rather than a single class. Guided sessions show, per pose: **posture name (EN/FR), illustration, hold timer, and a short description**. Sessions are organized into **200 levels**, flavored by a **focus** (Relax / Strengthen / Mobility & Flexibility) and a **duration** (short/medium/long), with progress saved between visits.

**Multi-user, by construction, with no extra work.** Because progress lives in `localStorage`, scoped per-browser-per-device, every person who opens the app gets their own independent journey automatically — no accounts, no login, no backend. Progress is tied to a specific browser on a specific device, not to a "person" globally — this is an accepted trade-off, not a bug (see §6 on why we're not building export/import).

### 2. Tech stack & hosting

**Static HTML/CSS/JS, no build step, hosted on GitHub Pages, installed as a PWA.**

- **No framework/build step:** matches the fast-iteration priority. Even the test suite runs in-browser via `tests.html` rather than through Node/Jest, keeping the whole project buildless.
- **GitHub Pages:** free static hosting, `git push` deploy. Repo: `trellis-yoga` (public).
- **PWA over native:** ruled out native iOS/React Native/Capacitor early on — all require an Xcode build+signing step, more friction than a PWA for no benefit at this stage.
- A PWA needs: `manifest.json` with `"display": "standalone"`, Apple meta tags + `apple-touch-icon`, and a service worker. Done correctly, this gets a real standalone app on iOS/Android.
- **Deployment path constraint:** GitHub Pages project sites serve from `username.github.io/trellis-yoga/`, not domain root — internal references must be relative. (Mostly done — see the `manifest.json` known issue above.)

### 3. Platform-specific technical constraints

**iOS Safari is the primary, most-constrained target**, but the app works as a plain website, Android PWA, or desktop tab too.

- **Screen sleep:** mitigated with the **Wake Lock API** (iOS Safari 16.4+, Android/desktop Chrome/Edge), feature-detected, degrades gracefully elsewhere. Also re-acquired on `visibilitychange`, so briefly backgrounding the app mid-session doesn't lose the lock permanently.
- **Timer accuracy when backgrounded:** timestamp-based (start time + elapsed), not interval counting.
- **Haptic/audio cues:** no Vibration API on iOS/desktop — an audio chime is the planned universal baseline (not yet implemented — see TASKS.md).
- **Notifications:** none implemented. Not strictly an iOS limitation (iOS 16.4+ supports Web Push for home-screen apps) — a scope decision, since push requires a server this static architecture doesn't have.
- **Layout:** still mobile-first only; no responsive pass yet for tablet/desktop widths (deferred, tracked in TASKS.md).

### 4. Data source

**Pose text data originates from `alexcumplido/yoga-api` (MIT license). Known deviation from the original plan below.**

- Original source: 48 poses across 12 categories, difficulty-tagged (Beginner/Intermediate/Expert).
- **Known deviation, accepted for now:** the original source has a gap at pose id 2. The current `poses.json` fills that gap with an added pose ("Cobra") that wasn't part of the original 48 — original text/description authored fresh, not sourced. This means we're no longer running an unmodified snapshot. Decision: **keep it for now, revisit later** — not reverted, but flagged so it's a known, intentional state rather than an accident.
- **Illustrations — known issue, actively being re-investigated:** every pose currently displays the same single placeholder Flaticon icon. This was previously believed to be because "the original Cloudinary URLs are broken," but that claim doesn't hold up under a direct check against the source database — the URLs found there are well-formed and appear live. Retrieving and verifying the real per-pose URLs is the top item in TASKS.md.
- Flaticon-sourced assets require attribution (implemented in the footer); AI-regeneration of Flaticon assets into a new style is prohibited by their terms.
- **Schema, as actually implemented today** — more fields than originally planned, all additions kept because they're useful:
  - `sequence_role` (array) — which arc stage(s) a pose is eligible for.
  - `body_focus` — backbend / forward-bend / twist / hip-opener / standing-strength / balance / inversion / core / arm-balance / restorative.
  - `intensity` — `mild` / `moderate` / `intense`.
  - `hip_rotation` — `external` / `internal` / `neutral`.
  - `load` *(added during implementation, not originally planned, kept — useful for designing sessions and knowing where relief/counter moments are needed)* — `{ neck, wrists }`, each `low`/`high`, driving the neck-prep and wrist-release safety rules.
  - `unilateral` *(added during implementation, kept — genuinely how real practice works)* — boolean; if true, the generator splits the pose into Left/Right entries with the hold time divided between them.
  - `translations`, `description_en`, `description_fr` — bilingual display text.
  - `image_url` — currently the placeholder (see known issue above).

### 5. Session generation architecture

#### 5.1 The session arc: five stages, always ending in Savasana

Centering (5%) → Warming (20%) → Pathway to the Peak (25%) → Peak (30%) → Cooldown (20%), always followed by Savasana as a mandatory final pose outside the percentage allocation. Handcrafted onboarding sessions (levels 1–10) are exempt from the stage-presence check — too short to meaningfully fill five stages, but still end in Savasana.

#### 5.2 Focus model: 3 focuses

Relax / Strengthen / Mobility & Flexibility, as originally decided. Implemented via `FOCUS_MODIFIERS` (a hold-time multiplier per `body_focus` tag) **and** a selection-weight bonus for matching tags in `selectWeightedPose`. **Known open question:** applying both a selection bonus and a hold-time multiplier for the same match may be double-reinforcing Focus more than intended — not yet resolved, tracked in TASKS.md.

#### 5.3 Level structure: 200 levels, 5 macro-blocks

| Block | Levels | Difficulty pool |
|---|---|---|
| Onboarding | 1–10 | Beginner only, handcrafted fixed sequences |
| Foundation | 11–40 | Beginner + Intermediate |
| Building | 41–100 | + Expert (Peak/Cooldown only, and only above level 41 — this is also where Shoulder Stand/Plow unlock) |
| Advancing | 101–170 | Full pool, hold time scaling to its cap at 170 |
| Integration | 171–200 | Full pool, hold time plateaus — deliberately, a refinement phase rather than further unlocks |

Hold-time formula, as implemented: `baseHold = min(60, max(20, 20 + (level − 10) × 0.25))`, then multiplied by the Focus modifier, then capped at 90s (long duration) or 60s (short/medium), floored at 20s.

**Pose count — known issue, agreed to fix:** currently fixed single numbers (short 10 / medium 15 / long 20) rather than the ranges originally intended (short 8–10 / medium 12–15 / long 16–20). This defeated part of the original point of duration affecting pose count, not just hold time. Fix tracked in TASKS.md.

#### 5.4 Sequencing safety rules, as implemented

- **Counterpose rule:** the pose immediately following an `intensity: "intense"` pose is constrained to Twist/Hip-Opener/Forward-Bend/Restorative, with a Child's Pose fallback if nothing fits. Confirmed immediate, not deferred to general Cooldown mixing.
- **Rotation-transition rule:** consecutive poses with opposite non-neutral `hip_rotation` get Downward-Facing Dog inserted between them.
- **Warm-the-spine-first:** Cat/Cow injected if a Backbend appears without prior spine warm-up.
- **Neck/wrist load rules:** driven by the `load` field — a `neck: "high"` pose (Shoulder Stand, Plow) requires prior neck-prep; a `wrists: "high"` pose requires an immediate wrist-release pose after it.
- **Shoulder Stand / Plow gating:** restricted to level 41+. **Known narrowing, under review:** the "suitable warm-up" check currently only recognizes Cat/Cow, narrower than the six-pose set (Cat, Cow, Downward-Facing Dog, Dolphin, Bridge, Plank) originally specified. Decision: **restore the full six-pose set** — tracked in TASKS.md.
- **Backbend → Forward-Bend rule:** Child's Pose inserted between them if they'd otherwise land adjacent.
- A one-time safety disclaimer (bilingual) is shown on first launch, covering Shoulder Stand/Plow neck risk.

#### 5.5 Cross-session continuity, as implemented

- **Rolling focus-balance nudge:** 14-day window; if one focus leads another by at least 2 completed sessions, surfaces a soft suggestion (not a restriction).
- **Plateau nudge:** if the user's last 3 completed sessions were all the exact same level, a soft nudge suggests trying the next level up, and that node is visually highlighted on the Trellis. **This is intentionally simple** — there's no "stuck" or frontier-relative concept here. It doesn't matter whether the repeated level is the current frontier or an old level being replayed; the point is purely "you've done this exact session three times in a row, here's a nudge to mix it up." (An earlier version of this document mischaracterized this as a gap — it isn't; this is the intended design.)
- **New-pose cap:** at most 2 never-before-seen poses per session; once the cap is hit, selection is restricted to previously-seen poses.
- **Body-focus history penalty:** poses whose `body_focus` tags have been used heavily get a selection-weight penalty (capped at −0.8, floor weight 0.2). **Known issue, under review:** this is a lifetime cumulative counter with no time decay — a pose family used heavily months ago is penalized exactly as much as one used heavily this week. A rolling/recency-weighted version was proposed but not implemented.

### 6. Progress & persistence

- `localStorage`, on-device only, `schemaVersion` field, defaults-merge on load so older saved state doesn't break on new fields.
- **Frontier vs. current play are distinct**, exactly as decided: frontier only advances on completing the current frontier level; any past level can be freely replayed without affecting it.
- **"Completing" a level:** every pose finished or skipped, session not exited early — applies uniformly to frontier sessions and replays.
- **Decision: no file-based export/import.** This was originally planned, but reconsidered — managing a downloaded JSON file (finding it, re-uploading it) is a bad experience for a non-technical iPhone user, which is the actual target audience now that this is shared with friends. Accepted trade-off: progress lives on one device/browser, and if it's lost, it's lost. If iOS clears inactive site data, that's a real (if currently unmitigated) risk we're choosing to accept rather than solve with a file-based workaround.
- **"Quick Unlock" utility:** a 🔓 button prompts for a level number and jumps the frontier there, resetting session history, focus history, and seen-poses in the process. This is a deliberate utility/debug tool, not a replacement for export/import — it solves a different problem (quickly getting to a level to test or explore) and is being kept as such. **Known gap, agreed to fix:** it currently performs the reset immediately on entering a valid number, with no confirmation step — given it destroys history, a confirmation step is being added.

### 7. Screens

- **Loading screen:** spinner while `poses.json` loads.
- **Home screen:** plant/vine level-select (locked/available/completed node states, plus a visually highlighted "suggested" node when a plateau nudge is active). Persistent bottom HUD: focus selector, duration selector, nudge message, language toggle (EN/FR), Quick Unlock, Flaticon attribution.
- **Session screen:** pose illustration, bilingual name (with Left/Right suffix for unilateral poses), description, progress counter, timer, skip/pause/exit controls.
- **Completion screen:** shown after finishing/skipping through all poses; user manually continues.
- **Safety disclaimer modal:** shown once, first launch.

### 8. Visual & design identity

**Status: still open, deliberately.** Current placeholder: sage green `#8DB580`, terracotta `#D98866`, Georgia serif, single generic pose icon. A real design pass remains a deliberate future decision, not yet made.

### 9. Naming

App/site name: **Trellis**. Repo: **`trellis-yoga`**.

### 10. Open items remaining

1. Real visual design pass.
2. Verify and restore real per-pose illustrations (top priority — see §4).
3. Resolve the Cobra-pose question (keep permanently / find a real replacement / remove).
4. Convert pose-count caps from fixed numbers to ranges.
5. Restore the six-pose Shoulder Stand/Plow warm-up set.
6. Add a confirmation step to Quick Unlock.
7. Fix `manifest.json`'s absolute icon paths.
8. Resolve Focus double-weighting (selection bonus vs. hold-time multiplier).
9. Time-decay the body-focus history penalty.
10. Consider replacing time-budget-based stage filling with guaranteed discrete slots per stage (the biggest remaining architectural question).
11. Deterministic RNG for tests (currently non-reproducible on failure).
12. Audio chime for pose transitions (not yet implemented).
13. Responsive layout pass for tablet/desktop.
14. Review bilateral (Left/Right) pose counting — currently each side counts as a separate entry toward pose-count and new-pose caps, which may not match how a user perceives "how many poses" they did.

### 11. Next concrete deliverable

Retrieve and verify the real per-pose image URLs from the source database, and hand them over for a final check before wiring them into `poses.json` — see TASKS.md Block A.