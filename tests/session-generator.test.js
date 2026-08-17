/**
 * session-generator.test.js
 * ------
 * Purpose: Comprehensive plain JS assertion tests for the generator.
 * Run by tests.html which imports and executes this.
 *
 * Fixes in this version:
 * - REMOVED: dead top-level code (`const rng = mulberry32(12345); const session =
 *   generateSession(poses, ...)`) that referenced `poses` before it was ever defined
 *   in scope — this threw a ReferenceError on module import and broke the entire
 *   test harness (both suites, since tests.html imports this file directly).
 * - The seeded RNG helper is now defined here properly and actually used in a new
 *   determinism suite (SUITE 11), instead of sitting unused in dead code.
 * - Added SUITE 12: bilateral (Left/Right) pose handling, now that it's implemented
 *   procedurally, not just in the handcrafted levels.
 * - Pose-count assertions updated to check DISTINCT pose count (a Set of ids,
 *   excluding Savasana), not raw array length — raw length can legitimately exceed
 *   the pose-count range now, since a bilateral pose contributes 2 entries for 1
 *   distinct pose, and safety-repair insertions (counterposes, warm-ups) add entries
 *   on top when triggered. Checking distinct count is what B.2/F actually intended.
 */

import { generateSession } from '../session-generator.js';

// --- SEEDED RNG (for SUITE 11 — determinism) ---
function mulberry32(a) {
    return function() {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// --- TEST HARNESS ---
const output = document.getElementById('test-output');

function createLog(msg, isPass = true, counterObj) {
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.color = isPass ? 'green' : 'red';
    div.style.fontWeight = isPass ? 'normal' : 'bold';
    output.appendChild(div);
    isPass ? counterObj.pass++ : counterObj.fail++;
}

function runTest(name, condition, counters) {
    condition ? createLog(`✅ PASS: ${name}`, true, counters) : createLog(`❌ FAIL: ${name}`, false, counters);
}

// Distinct pose count, excluding Savasana (id 11) — the semantically correct
// thing to check against the short/medium/long pose-count ranges.
function distinctPoseCount(session) {
    return new Set(session.filter(item => item.pose.id !== 11).map(item => item.pose.id)).size;
}

// --- MAIN EXPORTED FUNCTION ---
export async function runGeneratorTests() {
    const counters = { pass: 0, fail: 0 };

    createLog('\n--- Starting Comprehensive Generator Tests ---', true, counters);

    let poses;
    try {
        const res = await fetch('../poses.json');
        poses = await res.json();
        createLog('✅ Pose data loaded successfully', true, counters);
    } catch (e) {
        createLog(`❌ Failed to load poses.json: ${e.message}`, false, counters);
        return { passed: counters.pass, failed: counters.fail };
    }

    // --- SUITE 1: Input Validation ---
    createLog('\n--- SUITE 1: Input Validation ---', true, counters);
    try {
        generateSession(null, 20, 'strengthen', 'medium');
        runTest('Invalid poseLibrary (null) throws error', false, counters);
    } catch (e) { runTest('Invalid poseLibrary (null) throws error', true, counters); }

    try {
        generateSession(poses, 0, 'strengthen', 'medium');
        runTest('Invalid level (0) throws error', false, counters);
    } catch (e) { runTest('Invalid level (0) throws error', true, counters); }

    try {
        generateSession(poses, 201, 'strengthen', 'medium');
        runTest('Invalid level (>200) throws error', false, counters);
    } catch (e) { runTest('Invalid level (>200) throws error', true, counters); }

    try {
        generateSession(poses, 20, 'invalid', 'medium');
        runTest('Invalid focus throws error', false, counters);
    } catch (e) { runTest('Invalid focus throws error', true, counters); }

    try {
        generateSession(poses, 20, 'strengthen', 'xlong');
        runTest('Invalid duration throws error', false, counters);
    } catch (e) { runTest('Invalid duration throws error', true, counters); }

    // --- SUITE 2: Handcrafted Levels (1-10) ---
    createLog('\n--- SUITE 2: Handcrafted Levels 1-10 ---', true, counters);
    const sessionLvl1 = generateSession(poses, 1, 'strengthen', 'medium');
    runTest('Level 1 returns handcrafted session (3-4 poses + Savasana)', sessionLvl1.length >= 3 && sessionLvl1.length <= 5, counters);

    const sessionLvl10 = generateSession(poses, 10, 'strengthen', 'medium');
    runTest('Level 10 returns handcrafted session (6-9 poses + Savasana)', sessionLvl10.length >= 6 && sessionLvl10.length <= 10, counters);

    // --- SUITE 3: Procedural Levels > 10 ---
    createLog('\n--- SUITE 3: Procedural Generation (Level > 10) ---', true, counters);
    const sessionStandard = generateSession(poses, 20, 'strengthen', 'medium');
    runTest('Savasana is the last pose', sessionStandard[sessionStandard.length - 1].pose.id === 11, counters);
    runTest('No immediate duplicate pose ids (adjacent), except intentional L/R pairs',
        sessionStandard.every((item, idx) => {
            if (idx === 0) return true;
            const prev = sessionStandard[idx - 1];
            if (item.pose.id !== prev.pose.id) return true;
            // Same id adjacent is only OK if it's a Left->Right bilateral pair
            return prev.side === 'left' && item.side === 'right';
        }), counters
    );
    runTest('Session contains a valid Peak pose',
        sessionStandard.some(sp => sp.pose.sequence_role.includes('Peak')), counters
    );
    runTest('Session contains all 5 stages (Centering, Warming, Pathway, Peak, Cooldown)',
        ['Centering', 'Warming', 'Pathway', 'Peak', 'Cooldown'].every(role =>
            sessionStandard.some(sp => sp.pose.sequence_role.includes(role))
        ), counters
    );

    // --- SUITE 4: Safety Rules (Counterpose & Rotation) ---
    createLog('\n--- SUITE 4: Safety Rules (Counterpose & Rotation) ---', true, counters);
    let intenseIdx = sessionStandard.findIndex(s => s.pose.intensity === 'intense');
    let counterposeValid = true;
    if (intenseIdx !== -1 && intenseIdx < sessionStandard.length - 1) {
        const nextPose = sessionStandard[intenseIdx + 1].pose;
        const hasCounter = nextPose.body_focus.some(tag => ['Twist', 'Hip-Opener', 'Forward-Bend', 'Restorative'].includes(tag));
        if (!hasCounter) counterposeValid = false;
    }
    runTest('Intense pose forces immediate counterpose', counterposeValid, counters);

    // --- SUITE 5: Level Ranges & Gating (100 runs) ---
    createLog('\n--- SUITE 5: Level Ranges & Gating ---', true, counters);
    let plowAt40 = false, plowAt50 = false;
    for (let i = 0; i < 100; i++) {
        const s40 = generateSession(poses, 40, 'strengthen', 'medium');
        if (s40.some(sp => sp.pose.id === 27)) { plowAt40 = true; break; }
    }
    for (let i = 0; i < 100; i++) {
        const s50 = generateSession(poses, 50, 'strengthen', 'medium');
        if (s50.some(sp => sp.pose.id === 27)) { plowAt50 = true; break; }
    }
    runTest('Plow (id 27) is gated below Level 41 (never appears at 40)', !plowAt40, counters);
    runTest('Plow (id 27) is allowed at Level 50 (appears at least once in 100 runs)', plowAt50, counters);

    // --- SUITE 6: Duration Pose-Counts (DISTINCT count, per Block B.2/F) ---
    createLog('\n--- SUITE 6: Duration Pose-Counts (distinct poses, excl. Savasana) ---', true, counters);
    const shortSession = generateSession(poses, 20, 'relax', 'short');
    const shortDistinct = distinctPoseCount(shortSession);
    runTest(`Short session distinct pose count in [8,10] (got ${shortDistinct})`, shortDistinct >= 8 && shortDistinct <= 10, counters);

    const mediumSession = generateSession(poses, 20, 'strengthen', 'medium');
    const mediumDistinct = distinctPoseCount(mediumSession);
    runTest(`Medium session distinct pose count in [12,15] (got ${mediumDistinct})`, mediumDistinct >= 12 && mediumDistinct <= 15, counters);

    const longSession = generateSession(poses, 20, 'strengthen', 'long');
    const longDistinct = distinctPoseCount(longSession);
    runTest(`Long session distinct pose count in [16,20] (got ${longDistinct})`, longDistinct >= 16 && longDistinct <= 20, counters);

    // --- SUITE 7: Focus Filtering (100 runs each) ---
    createLog('\n--- SUITE 7: Focus Filtering ---', true, counters);
    let strengthTotal = 0, relaxTotal = 0;
    const isStrengthPose = (p) => p.body_focus.some(tag => ['Standing-Strength', 'Core', 'Arm-Balance', 'Backbend'].includes(tag));
    for (let i = 0; i < 100; i++) {
        const s = generateSession(poses, 20, 'strengthen', 'medium');
        strengthTotal += s.filter(sp => isStrengthPose(sp.pose)).length;
        const r = generateSession(poses, 20, 'relax', 'medium');
        relaxTotal += r.filter(sp => isStrengthPose(sp.pose)).length;
    }
    runTest('Strengthen focus prioritizes strength poses (avg over 100 runs)', strengthTotal > relaxTotal, counters);

    // --- SUITE 8: New-Pose Cap (Continuity) ---
    createLog('\n--- SUITE 8: New-Pose Cap (seenPoses) ---', true, counters);
    const seenPoses = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48];
    const sessionWithSeen = generateSession(poses, 20, 'strengthen', 'medium', seenPoses);
    const newDistinctPoses = new Set(sessionWithSeen.filter(sp => !seenPoses.includes(sp.pose.id)).map(sp => sp.pose.id));
    runTest('New-pose cap limits DISTINCT new poses to 2 (bug fix — was counting entries, not distinct ids)', newDistinctPoses.size <= 2, counters);

    // --- SUITE 9: Body-Focus Penalty (100 runs each) ---
    createLog('\n--- SUITE 9: Body-Focus Penalty (Silent Engine) ---', true, counters);
    const bodyFocusHistory = { 'backbend': 50 };
    let penBackbends = 0, normalBackbends = 0;
    for (let i = 0; i < 100; i++) {
        const penSession = generateSession(poses, 20, 'strengthen', 'medium', [], bodyFocusHistory);
        penBackbends += penSession.filter(sp => sp.pose.body_focus.includes('Backbend')).length;
        const normalSession = generateSession(poses, 20, 'strengthen', 'medium');
        normalBackbends += normalSession.filter(sp => sp.pose.body_focus.includes('Backbend')).length;
    }
    runTest('Body-Focus penalty reduces backbend selection (avg over 100 runs)', penBackbends < normalBackbends, counters);

    // --- SUITE 10: Hold Time Caps (Excluding Savasana) ---
    createLog('\n--- SUITE 10: Hold Time Caps ---', true, counters);
    let maxHoldOverall = 0;
    for (let i = 0; i < 30; i++) {
        const s = generateSession(poses, 20, 'strengthen', 'long');
        const maxHold = s
            .filter(item => item.pose.id !== 11)
            .reduce((max, item) => Math.max(max, item.holdTime), 0);
        if (maxHold > maxHoldOverall) maxHoldOverall = maxHold;
    }
    runTest('Long session hold time (excluding Savasana) does not exceed 90s', maxHoldOverall <= 90, counters);

    const maxHoldShort = shortSession
        .filter(item => item.pose.id !== 11)
        .reduce((max, item) => Math.max(max, item.holdTime), 0);
    runTest('Short session hold time (excluding Savasana) does not exceed 60s', maxHoldShort <= 60, counters);

    // --- SUITE 11: Deterministic RNG (NEW — was dead/unused code before) ---
    createLog('\n--- SUITE 11: Deterministic RNG (reproducibility) ---', true, counters);
    const rngA = mulberry32(42);
    const rngB = mulberry32(42);
    const seededSessionA = generateSession(poses, 60, 'strengthen', 'medium', [], {}, rngA);
    const seededSessionB = generateSession(poses, 60, 'strengthen', 'medium', [], {}, rngB);
    const sameSequence = JSON.stringify(seededSessionA.map(i => i.pose.id)) === JSON.stringify(seededSessionB.map(i => i.pose.id));
    runTest('Same seed produces an identical pose sequence (test failures are now reproducible)', sameSequence, counters);

    const rngC = mulberry32(999);
    const seededSessionC = generateSession(poses, 60, 'strengthen', 'medium', [], {}, rngC);
    const differentSequence = JSON.stringify(seededSessionA.map(i => i.pose.id)) !== JSON.stringify(seededSessionC.map(i => i.pose.id));
    runTest('Different seeds (usually) produce different sequences (sanity check the seed is actually used)', differentSequence, counters);

    // --- SUITE 12: Bilateral (Left/Right) Pose Handling (NEW) ---
    createLog('\n--- SUITE 12: Bilateral Pose Handling ---', true, counters);
    let foundBilateral = false;
    let leftRightAdjacentAndPaired = true;
    let bilateralHoldTimesSumCorrectly = true;
    for (let i = 0; i < 30; i++) {
        const s = generateSession(poses, 80, 'mobility', 'long');
        for (let j = 0; j < s.length; j++) {
            if (s[j].side === 'left') {
                foundBilateral = true;
                const next = s[j + 1];
                if (!next || next.side !== 'right' || next.pose.id !== s[j].pose.id) {
                    leftRightAdjacentAndPaired = false;
                }
            }
        }
    }
    runTest('Bilateral poses appear in procedurally-generated sessions (not just handcrafted levels)', foundBilateral, counters);
    runTest('Every Left entry is immediately followed by its matching Right entry', leftRightAdjacentAndPaired, counters);

    // A bilateral pose's L+R split should count as ONE distinct pose, not two,
    // for both the pose-count cap and the new-pose cap.
    const bilateralPoseIds = poses.filter(p => p.unilateral).map(p => p.id);
    let distinctCountRespectsBilateral = true;
    for (let i = 0; i < 20; i++) {
        const s = generateSession(poses, 80, 'mobility', 'medium');
        const distinct = distinctPoseCount(s);
        // distinct should never exceed the medium max (15) even if several bilateral poses were used
        if (distinct > 15) distinctCountRespectsBilateral = false;
    }
    runTest('Distinct pose count stays within the duration cap even with bilateral poses present', distinctCountRespectsBilateral, counters);

    // --- FINAL RESULTS ---
    createLog('\n--- Generator Tests Complete ---', true, counters);
    createLog(`Generator Results: Passed: ${counters.pass} / ${counters.pass + counters.fail}`, counters.fail === 0, counters);
    return { passed: counters.pass, failed: counters.fail };
}