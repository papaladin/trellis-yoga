  # Trellis — Project Documentation (v2)

  *Status: architecture agreed, design & implementation not yet started. Supersedes the first version of this document — this revision folds in the session-generation architecture worked out afterward. As before: anything not explicitly decided is marked **Open / TBD**, nothing is invented.*

  ---

  ## 1. What we're building

  A personal, guided yoga session app, usable easily on an iPhone, structured as a long-term "journey" or program rather than a single class:

  - Guided sessions show, per pose: **posture name, an illustration, and a hold timer**.
  - Sessions are organized into **levels** (a journey/program feel — "get back in shape / flexibility / core strength"), rather than a flat list of unrelated classes.
  - Each session can be flavored by a **focus** (relax / strengthen / mobility & flexibility) and a **duration** (shorter/longer).
  - Progress (which level you've reached) is **saved** between visits.

  This is a single-user, personal-use app (not a product for others), built and iterated on quickly.

  ---

  ## 2. Tech stack & hosting

  ### Decision: static HTML/CSS/JS, no build step, hosted on GitHub Pages, installed as a PWA.

  **Why no framework / no build step:**
  - Matches the stated preference for fast iteration — edit a file, refresh, see the result immediately.
  - The app's scope doesn't need the complexity a bundler or framework solves for.
  - GitHub Pages serves plain files as-is with zero configuration.
  - A build step was explicitly considered and rejected *for now* — would only be justified if complexity grows enough to need it later.

  **Why GitHub Pages specifically:**
  - Free static hosting tied directly to a `git push` deploy.
  - User confirmed a GitHub account is already ready. Repo will be public (required for free Pages hosting on a personal account).

  **Why a PWA instead of a native app:**
  - Native iOS (Swift/Xcode) requires a Mac, Xcode, and an Apple Developer Program membership ($99/yr) for a permanent install — ruled out as too much friction.
  - React Native / Capacitor / Expo were considered and rejected for the same reason — still require an Xcode build + signing step. More friction than a PWA for no real benefit at this stage.
  - A PWA needs only: `manifest.json` with `"display": "standalone"`, Apple-specific meta tags (`apple-mobile-web-app-capable`, status bar style) + `apple-touch-icon`, and a service worker.
  - With these in place, "Add to Home Screen" produces a **real standalone app experience** on iOS — own icon, no Safari chrome, own App Switcher entry. Without this setup it's just a bookmark.
  - Known, accepted limitation: **no background notifications or background audio** once the app isn't in the foreground.
  - Capacitor noted as a possible *future* path if native features are ever wanted — not needed now.

  **Not yet decided:**
  - Exact repo name — working idea is `trellis-yoga` or similar. Not finalized.
  - Whether a custom domain is wanted (not discussed).

  ---

  ## 3. iOS-specific technical constraints (engineering decisions, not open questions)

  - **Screen sleep during a session:** mitigated with the **Wake Lock API** (iOS Safari 16.4+), keeping the screen awake during an active session.
  - **Timer accuracy when backgrounded:** timers will be based on actual timestamps (start time + elapsed), not interval counting, so they stay accurate through backgrounding.
  - **No Vibration API on iOS Safari:** an audio chime (Web Audio API) will be used instead for pose-transition/session-end cues.
  - **No background audio/notifications:** accepted as a genuine limitation of the PWA approach.

  ---

  ## 4. Data source

  ### Decision: pose data is a one-time snapshot from the open-source `alexcumplido/yoga-api` project, baked into the repo. Images are linked live, not copied.

  - Source: GitHub project `alexcumplido/yoga-api` (MIT license) — a small SQLite database of **48 yoga poses** across **12 categories**, each tagged with a difficulty (Beginner / Intermediate / Expert).
  - Per pose: English name, Sanskrit name (adapted + original), translation, description, benefits, difficulty, category tags.
  - **Illustrations** (SVG/PNG) are hosted on Cloudinary, not copied into the repo. Some are CC0, some are Flaticon-sourced and **require an attribution line** in the app (two specific credit lines). Placement of this attribution is not yet decided. AI-regeneration of the Flaticon assets into a new style is prohibited by their terms — a hard constraint on any future illustration work.
  - **Why a baked-in snapshot instead of live API calls:** the live API runs on Render's free tier (30–50s cold-start delays when idle) and is an unnecessary external dependency. The 48-pose text dataset is instead copied once into `data/poses.json`, becoming part of the site itself. **Trade-off accepted:** frozen snapshot, won't auto-update if the source project changes; can be manually re-pulled later.
  - **Other sources considered and rejected** (final check done before settling): `rebeccaestes/yoga_api` (same underlying source, not additional), `LunaticPrakash/yoga-api` (incomplete), stock/icon sites (not open/bulk-friendly/consistent), Wikimedia Commons (inconsistent style), the "2,100 Asanas" book (commercial). Growing the library beyond 48 is a slow-burn side project (Wikipedia names + hand-illustrated originals later), not a launch blocker.
  - **Known data issues to fix when baking `poses.json`:** pose id 4 ("Bridge") has no category tags in the source data; pose id 43 ("Upward-Facing Dog") has a typo'd Sanskrit name; ids 20 and 38 share a Sanskrit name (`Uttanasana`) that appears to actually belong to #38 — needs a sanity check on whether these are genuinely two distinct poses.
  - **Schema flexibility:** `poses.json` is read-only reference data — adding new fields later requires no migration, just appending to the file. The only data that changes on-device over time is progress (see Section 8), which does carry a version field for exactly this reason.

  **Full 48-pose list** has been shared and reviewed (see chat history) — not repeated here to keep this document focused on architecture.

  ---

  ## 5. Session generation architecture

  This is the most substantial addition to this document. It was developed by researching general yoga-sequencing pedagogy (see note on sourcing below), reconciling it against our specific 48-pose dataset and prior decisions, and resolving conflicts between sources.

  ### 5.1 A note on sourcing

  Three sets of external "guidelines" were reviewed during this process:
  - One (`deepseek-guidelines.md`) was **explicitly excluded** — it stated it was distilled directly from a specific copyrighted book obtained from an unauthorized source, and was not used as input to any decision here.
  - Two others (`vibe-reaserarch.md` and `gpt-guideline.md`) were reviewed and used, but treated as **general, widely-taught yoga pedagogy** (arc structure, counterposes, progressive overload) rather than as proprietary content — these are standard concepts taught broadly in yoga teacher training, not exclusive to any one source. Specific rules and examples were **reconciled and re-expressed in our own words** below, not copied.

  ### 5.2 The session arc: five stages, not three

  **Decision: every generated session follows a five-stage arc, always ending in Savasana (Corpse Pose, #11).**

  An earlier three-bucket version (warm-up/peak/cool-down as fixed percentages) was reconsidered as too flattened. The agreed structure:

  1. **Centering** — a short, still, breath-focused opening.
  2. **Warming** — dynamic, flowing movement to raise body temperature and prepare joints.
  3. **Pathway to the Peak** — a progression from simple to more complex poses, specifically preparing the muscles/joints the Peak stage will demand.
  4. **Peak** — the session's most challenging poses, where the selected Focus is realized.
  5. **Integration & Cool-down** — gradually descending into stillness, always concluding in Savasana.

  **Not yet decided:** the exact time/pose-count allocation across these five stages (the earlier 20/60/20 split applied to three buckets, not five — needs to be redefined).

  ### 5.3 Focus reconciliation: confirmed as our 3-focus model

  Source material referenced five focus areas (Mobility, Strength, Relaxation, Flexibility, Balance). **Our model remains the three focuses already decided: Relax / Strengthen / Mobility & Flexibility.** "Balance"-oriented poses (Tree, Half-Moon, Warrior III, Eagle) aren't a separate focus — they're folded in based on what the balance is *for*: standing-balance-as-strength poses (Warrior III, Half-Moon) count toward **Strengthen**; hip-opening balance work (Eagle) counts toward **Mobility**. A pose is not restricted to a single focus.

  **Not yet decided:** the final, complete focus → pose mapping — this is part of the still-pending pose-tagging pass (Section 5.6).

  ### 5.4 Level structure: macro-blocks + continuous scaling within them

  **Decision (shape adopted, exact numbers pending):** the full level range is divided into a small number of named macro-blocks, each representing a distinct phase of the overall journey — analogous to blocks in a running training program. A four-block shape (roughly: Foundation → building breath/flow → building strength/endurance → high-level integration) was proposed and is a reasonable starting shape.

  - Block boundaries will be expressed as **percentages of the total level range** (not fixed level numbers), since the exact maximum level (100/500/1000/other) is still undecided — this keeps the block shape valid regardless of which number is chosen.
  - **Within** a block, parameters (hold time, pose count, difficulty ceiling) scale **smoothly and continuously** with level — no jarring jumps.
  - **At** block boundaries, new pose families/difficulty tiers unlock — these should feel like real milestones.

  **Not yet decided:**
  - The exact maximum level number.
  - The exact percentage boundaries between blocks, and final names/themes for each block.
  - The precise formula for how hold time, pose count, and difficulty mix scale continuously within a block.
  - The exact number and length of duration tiers (short/medium/long was suggested by source material but not yet confirmed as final).
  - The exact widget type for selecting focus/duration on the Home screen (buttons/picker/slider — undecided).

  ### 5.5 Sequencing safety principles (to encode as general rules, not copied text)

  These are standard, widely-taught biomechanical sequencing principles, to be implemented as rules the generator checks, expressed in our own logic rather than any source's specific wording:

  - **Counterpose rule:** every intense peak pose must be followed by a neutralizing pose (e.g., an intense backbend should be followed by a gentle twist or gentle forward bend — never by another intense stretch of a different-but-equally-intense type).
  - **Standing-pose grouping:** externally-rotated-hip standing poses should be grouped together, separately from internally-rotated-hip standing poses, rather than interleaved.
  - **Balance-transition safety:** avoid transitioning directly between an internally-rotated and externally-rotated single-leg balance pose — return to a neutral stance in between.
  - **Warm-the-spine-first:** any session including backbends at the Peak stage must first include dynamic spine-warming movement (e.g., Cat/Cow) during the Warming stage.

  These will be implemented as a rule-checking layer the generator applies when assembling a sequence, not as hardcoded pose chains.

  ### 5.6 Pose tagging (still the pending next deliverable)

  To support all of the above, each pose needs two additional hand-authored tags beyond what the source data provides (category, difficulty):
  - **`sequence_role`**: which of the five arc stages a pose is eligible for.
  - **`body_focus`**: backbend / forward-bend / twist / hip-opener / standing-strength / balance / inversion — used by the sequencing-safety rules above.

  This tagging pass has not been done yet. It is the agreed next concrete deliverable, to be presented as a reviewable table (now informed by the reconciliation in this section) before being wired into code.

  ### 5.7 Cross-session continuity

  Beyond a single session, several mechanisms are intended to make the app feel like a continuous program rather than a reshuffled slot machine each time:

  - **New-pose cap per session:** limit how many genuinely new (never-seen-by-this-user) poses appear in one session, so progression feels gradual.
  - **Session-to-session carryover:** lightly favor re-including a pose or two from the immediately preceding session for familiarity/mastery.
  - **Rolling focus-balance:** track which focus (Relax/Strengthen/Mobility) has been selected over a recent rolling window (e.g. the last two weeks), to encourage variety across focuses over time.
    - **Not yet decided:** whether this should be a **soft suggestion** on the Home screen (e.g. "you've done a lot of Strengthen lately") or a **hard restriction** on what can be selected. A hard restriction would conflict with the earlier, explicit decision that focus is freely selectable at any time — a soft nudge was proposed to preserve that, but **this has not been confirmed**.
  - **Plateau handling:** if a user replays the same frontier level many times without advancing, the generator could shift into a noticeably different variation (e.g. a very different pose selection, or an inverted duration profile) to break staleness. Concept agreed as worth having; the exact trigger threshold (e.g. "after N non-advancing sessions") and the exact nature of the variation are **not yet decided**.
  - **Recent-history body-focus balancing:** track which `body_focus` categories (e.g. arm-intensive vs. hip-intensive) have been emphasized in recent sessions, and deprioritize an overworked category in the next generated session. Concept agreed as worth having; exact mechanism (lookback window, deprioritization strength) **not yet decided**.

  **Implication for progress storage:** supporting the above means the app needs to track more than just "current level" in `localStorage` — likely a rolling history of recent sessions (focus chosen, poses used, date) rather than a single snapshot. This wasn't part of the original progress-storage design (Section 8) and needs to be folded into the `localStorage` schema once the above mechanisms are finalized.

  ### 5.8 Session generator task list

  1. Finish pose tagging (`sequence_role`, `body_focus`) per Section 5.6, including fixing the known data gaps from Section 4.
  2. Define the finalized 3-focus → pose/category weighting map (Section 5.3).
  3. Define the level-block table: boundaries (as percentages), and per-block envelopes for difficulty ceiling, hold-time range, pose-count range, new-pose introduction cap.
  4. Define the continuous scaling formula within a block (level + duration tier → hold time, pose count).
  5. Define the five-stage arc filler: given per-stage allocation, select poses per stage from the eligible pool, applying the Section 5.5 safety rules.
  6. Define the selection/fallback algorithm: weighted random without replacement; graceful fallback when a strict focus+level filter leaves too few eligible poses (controlled repeats rather than failure) — a real risk given only 48 poses total.
  7. Define session-continuity logic: new-pose cap per session, carryover preference from the prior session.
  8. Define rolling focus-balance logic (mechanism TBD — soft nudge vs. restriction, per Section 5.7).
  9. Define plateau detection and its "variation" response (trigger + behavior TBD).
  10. Define recent-history body-focus balancing (mechanism TBD).
  11. Define a validation checklist the generator runs against its own output: arc respected, Savasana present, focus-ratio met, no illegal difficulty for the level, every intense pose has a counterpose, no over-repeated poses.
  12. Update the `localStorage` progress schema to support the history tracking the above mechanisms need (Section 5.7 implication).

  ---

  ## 6. Progress & persistence

  **Confirmed:**
  - Progress is stored in **`localStorage`**, on-device only — no account, no login, no cross-device sync (single iPhone use only, prioritizing simplicity and full offline capability over sync).
  - Progress data will include a **`schemaVersion`** field for future migrations.
  - **Frontier vs. current play are distinct:** the frontier (furthest level reached) only advances when the current frontier level is completed. Any previously-passed level can be freely replayed without affecting the frontier position.
  - **What counts as "completing" a level:** every pose must be either finished or explicitly skipped, and the session must not be exited early. Skipping doesn't count as failure; exiting early does not unlock the next level.
  - After finishing all poses, a **completion screen** is shown; the user manually continues (no auto-advance).
  - An **export/import progress as a file** feature is planned as insurance against iOS clearing inactive site data — not yet designed in detail.
  - **New, from Section 5.7:** the schema will likely need to track a rolling window of recent session history (not just current level), to support focus-balance nudges, plateau detection, and body-focus-aware balancing. Exact schema shape not yet decided.

  ---

  ## 7. Screens

  **Confirmed structure:**

  - **Home screen** — combines:
    - The **level-select visualization**, styled as a plant/vine ("Trellis"): each level a small circular node with its number, tappable to enter that level's session. Locked levels greyed out; reached/available levels green. Scrolls vertically (no more than ~10 levels visible at a time).
    - A **persistent bottom HUD** (stays visible while scrolling) containing the **focus selector** and **duration selector**.
  - **Session screen** — current pose illustration, name, hold timer, progress through the session, and controls.
    - **In-session controls:** skip pose, pause/resume (play/pause toggle), exit session. Exiting tracks whether the session was completed before deciding whether the next level unlocks.
  - **Completion screen** — shown after finishing/skipping through all poses; user manually continues from here.

  Level selection is **not** a separate screen — it lives on the Home screen as part of the plant visualization.

  ---

  ## 8. Visual & design identity

  **Status: not yet decided.** Design direction (palette, typography, iconography, the visual treatment of the plant/vine metaphor, app icon) was intentionally paused before being agreed, and has not been revisited. Only the plant/vine level-select concept and persistent bottom HUD (Section 7) are confirmed structurally — colors, type, and specific visual style remain open.

  ---

  ## 9. Naming

  - **App/site name: "Trellis"** — confirmed.
  - **Repo name:** not finalized — working idea is `trellis-yoga` or similar, chosen to stand out from existing "trellis" repos and be more searchable.

  ---

  ## 10. Open questions for Round 2

  1. Maximum level number (100 / 500 / 1000 / other)?
  2. Exact percentage boundaries between the level macro-blocks, and their final names/themes.
  3. Exact continuous scaling formula within a block (hold time / pose count / difficulty mix vs. level).
  4. Exact time/pose-count allocation across the five arc stages (replacing the old 20/60/20 three-bucket split).
  5. Number and length of duration tiers (short/medium/long assumed but not confirmed).
  6. Widget type for focus/duration selectors (buttons, picker, or sliders)?
  7. Final focus → pose/category mapping (part of the upcoming pose-tagging pass).
  8. Rolling focus-balance: soft nudge vs. hard restriction? (Leaning soft nudge to preserve free focus selection, but not confirmed.)
  9. Plateau detection: exact trigger threshold and the nature of the "variation" response.
  10. Recent-history body-focus balancing: exact mechanism (lookback window, deprioritization strength).
  11. Updated `localStorage` schema shape to support session-history tracking.
  12. Visual design identity: palette, typography, iconography, app icon.
  13. Where exactly the required Flaticon attribution text is displayed in the app.
  14. Final repo name.
  15. Export/import progress feature — how much detail in v1 vs. later?
  16. Data cleanup: are poses #20/#38 genuinely distinct, and how should the Bridge (#4) category gap be filled?

  ---

  ## 11. Next concrete deliverable (agreed)

  The **pose tagging table** — `sequence_role` and `body_focus` for each of the 48 poses — now informed by the reconciliation in Section 5, to be presented as a reviewable table before being wired into any generation code.