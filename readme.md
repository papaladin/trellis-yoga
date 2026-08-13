# Trellis

A guided yoga journey app. Levels 1–200, three focuses (Relax / Strengthen / Mobility & Flexibility), three durations, algorithmically generated sessions following real yoga sequencing principles. Runs as an installable app with no App Store, no account, and no server — built primarily for iOS but works as a plain website or PWA on Android and desktop too.

This file covers what it is, how to run/deploy it, and the full design record (goals, decisions, architecture). See **[TASKS.md](./TASKS.md)** for the current implementation task list.

---

## Quick start

### Repo layout

```
index.html             Entry point — all three screens (home, session, completion)
main.css                Styling
app.js                   Main controller — state, timer, screen transitions
session-generator.js     Session generation algorithm
storage.js               localStorage read/write + schema versioning
nudge.js                 Soft focus-balance suggestion logic
data/poses.json          48-pose dataset (snapshot from alexcumplido/yoga-api, MIT), hand-tagged for sequencing
manifest.json             PWA manifest
sw.js                     Service worker (offline caching)
icon-192.png, icon-512.png   App icons
```

### Running locally

No build step — just serve the folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. To test on a phone before deploying, find your computer's local network IP and open `http://<your-ip>:8000` on the phone (same WiFi network).

### Deploying

```bash
git push
```

GitHub Pages redeploys automatically. Live at `https://<username>.github.io/trellis-yoga/`.

**Note:** all internal paths (script src, manifest link, service worker registration, icon links) must be **relative**, not absolute (`./sw.js`, not `/sw.js`) — GitHub Pages serves this repo under a subpath, not domain root.

### Installing

- **iOS (primary target):** Safari → Share → "Add to Home Screen" → runs full-screen, no browser chrome, own icon.
- **Android:** Chrome will typically offer an "Install app" prompt, or Menu → "Add to Home screen" — similar standalone result.
- **Desktop:** Chrome/Edge can install via the omnibox install icon. Safari desktop has no install step, but the site works fine as a regular tab.
- **Anyone without installing:** it's a normal website — works in any modern browser, just without the full-screen/offline benefits of installing.

### Data & attribution

Pose text data is a one-time snapshot from [`alexcumplido/yoga-api`](https://github.com/alexcumplido/yoga-api) (MIT license). Some pose illustrations are Flaticon-sourced and require attribution — see TASKS.md for the pending attribution-footer task.

### Status

Active development — first implementation pass complete, currently working through a reconciliation/bugfix pass. See TASKS.md for current priorities.

---

## Architecture & design decisions

*Status: core architecture decided, first implementation pass complete and reviewed. Anything not explicitly decided is marked **Open**.*

### 1. What we're building

A guided yoga session app structured as a long-term journey rather than a single class. Guided sessions show, per pose: **posture name, illustration, and hold timer**. Sessions are organized into **200 levels**, flavored by a **focus** (Relax / Strengthen / Mobility & Flexibility) and a **duration** (short/medium/long), with progress saved between visits.

**Multi-user, by construction, with no extra work.** This started as a personal project but is intended to be shared with friends. Because progress lives in `localStorage`, which is scoped per-browser-per-device, every person who opens the app gets their own fully independent journey automatically — no accounts, no login, no backend changes needed to support this. Worth knowing: progress is tied to a specific browser on a specific device, not to a "person" in any global sense — the same person using two different browsers or phones will see two separate journeys unless they use the export/import feature (see §6).

### 2. Tech stack & hosting

**Static HTML/CSS/JS, no build step, hosted on GitHub Pages, installed as a PWA.**

- **No framework/build step:** matches the fast-iteration priority — edit, refresh, see the result. Reconsider only if complexity later demands it.
- **GitHub Pages:** free static hosting, `git push` deploy. Repo: `trellis-yoga` (public, required for free Pages on a personal account).
- **PWA over native:** native iOS requires Xcode + a Mac + an Apple Developer Program membership ($99/yr) for a permanent install — ruled out. React Native/Capacitor/Expo still require an Xcode build+signing step — same problem, more friction than a PWA for no benefit at this stage.
- A PWA needs: `manifest.json` with `"display": "standalone"`, Apple meta tags (`apple-mobile-web-app-capable`, status bar style) + `apple-touch-icon`, and a service worker. Done correctly, this gets a real standalone app on iOS/Android — own icon, no browser chrome, own app-switcher entry.
- **Deployment path constraint:** GitHub Pages project sites serve from `username.github.io/trellis-yoga/`, not domain root. All internal references must use relative paths, not absolute (`/...`) paths.

### 3. Platform-specific technical constraints

**iOS Safari is the primary, most-constrained target** — the technical choices below are driven by it — but the app is expected to also be used as a plain website, an Android PWA, and a desktop browser tab, so platform differences are noted explicitly rather than assumed away.

- **Screen sleep during a session:** mitigated with the **Wake Lock API**, supported on iOS Safari 16.4+, and on Android/desktop Chrome and Edge. The code already feature-detects it (`if ('wakeLock' in navigator)`) and degrades gracefully where unsupported — the screen may simply sleep on unsupported browsers, an acceptable degradation rather than a hard blocker.
- **Timer accuracy when backgrounded:** timestamp-based (start time + elapsed), not interval counting — correct and platform-agnostic regardless of how aggressively a given browser throttles backgrounded tabs.
- **Haptic/audio cues:** the Vibration API exists on Android Chrome but not iOS Safari or desktop browsers — rather than fork behavior per platform, an audio chime (Web Audio API) is used as the universal baseline across all platforms. Vibration on Android remains a possible future enhancement, not required.
- **Notifications:** no scheduled/background notifications are implemented. This isn't strictly an iOS limitation anymore (iOS 16.4+ actually does support Web Push for installed home-screen apps) — it's a scope decision: implementing push notifications on any platform would require a push-notification server or third-party push service, which is out of scope for this static, backend-free architecture.
- **Layout, still open:** the UI (bottom HUD, vine node sizing, touch targets) was designed mobile-first for an iPhone screen. It hasn't yet had a pass to ensure it looks intentional (not just "not broken") at tablet or desktop widths — see TASKS.md.

### 4. Data source

**Pose text data is a one-time snapshot from `alexcumplido/yoga-api` (MIT license), baked into `data/poses.json`. Images are linked to their original hosted URLs, not copied into the repo.**

- Source: SQLite database of **48 poses** across 12 categories, tagged with difficulty (Beginner/Intermediate/Expert). Per pose: English name, Sanskrit name, translation, description, benefits.
- **Illustrations:** originally hosted on Cloudinary; some CC0, some Flaticon-sourced (requiring attribution — see TASKS.md). AI-regeneration of Flaticon assets into a new style is prohibited by their terms.
- **Why a snapshot, not live API calls:** the live API runs on Render's free tier (30–50s cold-start delays when idle) — unreliable for "open app, start session."
- **Other sources considered and rejected:** `rebeccaestes/yoga_api` (same underlying source), `LunaticPrakash/yoga-api` (incomplete), stock/icon sites (not open/bulk-friendly/consistent), Wikimedia Commons (inconsistent style), the "2,100 Asanas" book (commercial). Growing the pose library beyond 48 remains a future project, not a launch blocker.
- **Data cleanup done:** poses #20/#38 (originally sharing a Sanskrit name) now have distinct, corrected names.
- **Data cleanup still needed:** pose #4 (Bridge) had no category tags in the original source — manually tagged, worth a final sanity check.
- **Schema flexibility:** `poses.json` is read-only reference data — new fields can be appended without migration. Only on-device progress data needs schema versioning (§6).

### 5. Session generation architecture

**Sequencing principles are drawn from general, widely-taught yoga pedagogy** — arc structure, counterposes, progressive overload — expressed in our own words and numbers rather than reproduced from any single source.

#### 5.1 The session arc: five stages, always ending in Savasana

1. **Centering** — short, still, breath-focused opening.
2. **Warming** — dynamic movement to raise body temperature and prepare joints.
3. **Pathway to the Peak** — progression from simple to complex, preparing the specific muscles/joints the Peak will demand.
4. **Peak** — the session's most challenging poses, where Focus is realized.
5. **Integration & Cool-down** — descending into stillness, always ending in Savasana (Corpse Pose, id 11).

Stage time-allocation (% of total session time, excluding Savasana): Centering 5% / Warming 20% / Pathway 25% / Peak 30% / Integration 20%.

#### 5.2 Focus model: 3 focuses

**Relax / Strengthen / Mobility & Flexibility.** "Balance"-oriented poses aren't a separate focus — folded in by what the balance is *for*: standing-balance-as-strength (Warrior III, Half-Moon) counts toward Strengthen; hip-opening balance work (Eagle) counts toward Mobility. A pose isn't restricted to one focus.

#### 5.3 Level structure: 200 levels, macro-blocks + continuous scaling

**Maximum level: 200.**

| Block | Levels | % of range | Behavior |
|---|---|---|---|
| Onboarding | 1–10 | 5% | Handcrafted, fixed pose sequences — guarantees a good first-run experience. Beginner poses only. |
| Foundation | 11–40 | 15% | Algorithmic generation begins. Beginner + Intermediate pool. Hold time scales ~20s → 35s. |
| Building | 41–100 | 30% | Intermediate is the norm; Expert-difficulty poses begin appearing (Peak stage only). Also where Shoulder Stand and Plow become eligible (§5.5). Hold time scales ~35s → 50s. |
| Advancing | 101–170 | 35% | Full Expert pool available across all stages. Hold time scales ~50s → 60s, reaching the cap at level 170. |
| Integration | 171–200 | 15% | Hold time plateaus at the 60s cap — deliberately: this phase is about refinement and variety at full difficulty, not further unlocks. |

Pose count caps per duration (data model doesn't repeat poses bilaterally the way a real class does, so kept lower than a real class's raw shape-count): **short 8–10 poses / 90–100% of 15 min; medium 12–15 poses / 90–100% of 25 min; long 16–20 poses / 90–100% of 45 min.**

The precise continuous formula for hold-time-vs-level within each block is 
`baseHold = Math.min(60, Math.max(20, 20 + (level - 10) * 0.25))`

#### 5.4 Pose tagging schema

Beyond the source data (category, difficulty), each pose carries:
- **`sequence_role`** — which arc stage(s) a pose is eligible for. Stored as an **array** (e.g. `["Pathway", "Peak"]`).
- **`body_focus`** — backbend / forward-bend / twist / hip-opener / standing-strength / balance / inversion / core / arm-balance / restorative.
- **`intensity`** — `mild` / `moderate` / `intense`. Needed because `body_focus` alone conflates movement *family* with *severity* (e.g. Bridge and Wheel both tagged `Backbend` despite very different intensity) — the counterpose rule keys off `intensity`, not just family.
- **`hip_rotation`** — `external` / `internal` / `neutral`. Needed for standing-pose-grouping and balance-transition-safety rules — inferring rotation from the `Hip-Opener` tag alone is anatomically unreliable (e.g. Warrior I vs. Warrior II).

#### 5.5 Sequencing safety rules

- **Counterpose rule:** every *intense* peak pose must be followed by a neutralizing pose.
- **Standing-pose grouping:** externally-rotated-hip standing poses grouped together, separately from internally-rotated ones.
- **Balance-transition safety:** avoid transitioning directly between an internally- and externally-rotated single-leg balance pose — return to neutral in between.
- **Warm-the-spine-first:** backbends at the Peak require dynamic spine-warming (Cat/Cow) during Warming.
- **Neck-safety gating for inversions:** Shoulder Stand and Plow (neck-loading, real injury risk without live correction) are gated to level 41+ and require a suitable warm-up pose earlier in the session. A one-time in-app safety disclaimer is shown on first launch.

#### 5.6 Cross-session continuity

- **Rolling focus-balance nudge:** tracks focus selection over a 14-day rolling window; if one focus is used **3 times** without the others appearing, surfaces a soft on-screen suggestion (not a restriction — free focus selection is preserved).
- **New-pose cap per session / carryover:** concept agreed, not yet implemented.
- **Plateau Nudge:** If the user completes the exact same level 3 times in a row (verified via `recentSessions` history), a soft nudge appears in the bottom HUD suggesting they try the next level. The node for `Level + 1` is visually highlighted. This is a *soft suggestion*, not a restriction—replaying the same level remains freely allowed.
- **Recent-history body-focus balancing:** deprioritize an overworked `body_focus` category based on recent sessions. Mechanism not yet decided — non-blocking for v1.

### 6. Progress & persistence

- `localStorage`, on-device only, no account, no sync — `schemaVersion` field for future migrations.
- State migration merges parsed saved state with current defaults, so users with older saved state don't get `undefined` for newly-added fields.
- **Frontier vs. current play are distinct:** frontier only advances when the *current frontier level* is completed. Any previously-passed level can be freely replayed without moving the frontier.
- **"Completing" a level:** every pose finished or explicitly skipped, session not exited early. This applies to replays too, not just frontier-advancing sessions.
- Completion screen shown after finishing; user manually continues (no auto-advance).
- Export/import progress as a file — planned as insurance against a browser clearing inactive site data, and as the way to carry progress between two browsers/devices for the same person; not yet implemented.

### 7. Screens

- **Home screen:** plant/vine ("Trellis") level-select — each level a small circular node, tappable. Three visual states: locked / available / completed. Scrolls vertically. A persistent bottom HUD (stays visible while scrolling) holds the focus and duration selectors (pill-style buttons).
- **Session screen:** current pose illustration, name, hold timer, progress through session. Controls: skip pose, pause/resume, exit (exit tracks completion status per §6).
- **Completion screen:** shown after finishing/skipping through all poses; user manually continues.

### 8. Visual & design identity

**Status: still open, deliberately.** Current placeholder: sage green `#8DB580`, terracotta `#D98866`, Georgia serif, and a single generic icon shared by all 48 poses. A real design pass — palette, typography, the plant/vine visual treatment, distinct pose illustrations, app icon — remains a deliberate future decision.

### 9. Naming

- **App/site name:** Trellis.
- **Repo name:** `trellis-yoga`.

### 10. Open items remaining

1. Real visual design pass (palette, typography, plant/vine treatment, app icon).
2. Unique pose illustrations per pose.
3. Precise continuous hold-time-vs-level formula.
4. `intensity` and `hip_rotation` tagging across all 48 poses.
5. Plateau detection ("Variation Mode") — trigger and behavior.
6. Recent-history body-focus balancing — mechanism.
7. `localStorage` schema extension to support the above two.
8. Flaticon attribution — exact placement and required credit lines.
9. Export/import progress feature.
10. New-pose-cap / session-carryover continuity logic.
11. Responsive layout pass for tablet/desktop widths.

### 11. Next concrete deliverable

Tag all 48 poses with `intensity` and `hip_rotation`, and convert `sequence_role` from a slash-separated string to an array — the prerequisite for correctly implementing the counterpose and balance-transition safety rules (§5.5). See TASKS.md for the full prioritized list.