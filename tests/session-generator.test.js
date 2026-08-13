/**
 * session-generator.test.js
 * ------
 * Purpose: Comprehensive plain JS assertion tests for the generator.
 * Run by tests.html which imports and executes this.
 */

import { generateSession } from '../session-generator.js';

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
    runTest('No immediate duplicates in sequence', 
        sessionStandard.every((item, idx) => idx === 0 || item.pose.id !== sessionStandard[idx-1].pose.id), counters
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
    const runsGating = 100;
    for (let i = 0; i < runsGating; i++) {
        const s40 = generateSession(poses, 40, 'strengthen', 'medium');
        if (s40.some(sp => sp.pose.id === 27)) { plowAt40 = true; break; }
        const s50 = generateSession(poses, 50, 'strengthen', 'medium');
        if (s50.some(sp => sp.pose.id === 27)) plowAt50 = true;
    }
    runTest('Plow (id 27) is gated below Level 41 (never appears at 40)', !plowAt40, counters);
    runTest('Plow (id 27) is allowed at Level 50 (appears at least once in 100 runs)', plowAt50, counters);

    // --- SUITE 6: Duration Pose-Counts ---
    createLog('\n--- SUITE 6: Duration Pose-Counts ---', true, counters);
    const shortSession = generateSession(poses, 20, 'relax', 'short');
    runTest('Short session respects total pose count (≤ 15)', shortSession.length <= 15, counters);

    const mediumSession = generateSession(poses, 20, 'strengthen', 'medium');
    runTest('Medium session respects total pose count (≤ 20)', mediumSession.length <= 20, counters);

    const longSession = generateSession(poses, 20, 'strengthen', 'long');
    runTest('Long session respects total pose count (≤ 25)', longSession.length <= 25, counters);

    // --- SUITE 7: Focus Filtering (100 runs each) ---
    createLog('\n--- SUITE 7: Focus Filtering ---', true, counters);
    let strengthTotal = 0, relaxTotal = 0;
    const isStrengthPose = (p) => p.body_focus.some(tag => ['Standing-Strength', 'Core', 'Arm-Balance', 'Backbend'].includes(tag));
    const runsFocus = 100;
    for (let i = 0; i < runsFocus; i++) {
        const s = generateSession(poses, 20, 'strengthen', 'medium');
        strengthTotal += s.filter(sp => isStrengthPose(sp.pose)).length;
        const r = generateSession(poses, 20, 'relax', 'medium');
        relaxTotal += r.filter(sp => isStrengthPose(sp.pose)).length;
    }
    runTest('Strengthen focus prioritizes strength poses (avg over 100 runs)', strengthTotal > relaxTotal, counters);

    // --- SUITE 8: New-Pose Cap (Continuity) ---
    createLog('\n--- SUITE 8: New-Pose Cap (seenPoses) ---', true, counters);
    // Use a comprehensive seenPoses list that covers most poses
    // We leave out only a few poses (e.g., 14, 19, 22, 36, 40) to test the cap
    const seenPoses = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48];
    const sessionWithSeen = generateSession(poses, 20, 'strengthen', 'medium', seenPoses);
    const newPoses = sessionWithSeen.filter(sp => !seenPoses.includes(sp.pose.id));
    // With a comprehensive seenPoses list, the cap should be respected; we allow at most 2 new poses.
    runTest('New-Pose cap limits new poses to 2 (with enough seen poses available)', newPoses.length <= 2, counters);

    // --- SUITE 9: Body-Focus Penalty (100 runs each) ---
    createLog('\n--- SUITE 9: Body-Focus Penalty (Silent Engine) ---', true, counters);
    const bodyFocusHistory = { 'backbend': 50 };
    let penBackbends = 0, normalBackbends = 0;
    const runsPenalty = 100;
    for (let i = 0; i < runsPenalty; i++) {
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
        // Exclude Savasana (id 11) from the max hold calculation
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

    // --- FINAL RESULTS ---
    createLog('\n--- Generator Tests Complete ---', true, counters);
    createLog(`Generator Results: Passed: ${counters.pass} / ${counters.pass + counters.fail}`, counters.fail === 0, counters);
    return { passed: counters.pass, failed: counters.fail };
}