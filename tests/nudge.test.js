/**
 * nudge.test.js
 * ------
 * Purpose: Unit tests for the Nudge logic (Focus imbalance + Plateau detection).
 * Run by tests.html which imports and executes this.
 */

import { evaluateNudge, evaluatePlateau } from '../nudge.js';

// --- TEST HARNESS ---
const output = document.getElementById('test-output');

function createLog(msg, isPass = true, counters) {
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.color = isPass ? 'green' : 'red';
    div.style.fontWeight = isPass ? 'normal' : 'bold';
    output.appendChild(div);
    isPass ? counters.pass++ : counters.fail++;
}

function runTest(name, condition, counters) {
    condition ? createLog(`✅ PASS: ${name}`, true, counters) : createLog(`❌ FAIL: ${name}`, false, counters);
}

// --- MOCK HELPER ---
function createMockSession(level, focus, completed = true, daysAgo = 0) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
        level: level,
        focus: focus,
        completed: completed,
        timestamp: date.toISOString()
    };
}

// --- MAIN EXPORTED FUNCTION ---
export function runNudgeTests() {
    const counters = { pass: 0, fail: 0 };

    createLog('\n--- Starting Nudge Logic Tests ---', true, counters);

    // --- SUITE 1: Focus Nudge Thresholds ---
    createLog('--- SUITE 1: Focus Imbalance Thresholds ---', true, counters);

    const mockBalanced = {
        recentSessions: [
            createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'),
            createMockSession(1, 'mobility'), createMockSession(1, 'mobility'), createMockSession(1, 'mobility')
        ]
    };
    runTest('Balanced focus (3-3) does NOT trigger nudge', evaluateNudge(mockBalanced) === null, counters);

    const mockImbalanced = {
        recentSessions: [
            createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'),
            createMockSession(1, 'mobility'), createMockSession(1, 'mobility')
        ]
    };
    const nudgeResult = evaluateNudge(mockImbalanced);
    runTest('Imbalanced focus (4-2) triggers nudge', nudgeResult !== null, counters);
    runTest('Imbalanced nudge suggests opposite focus', nudgeResult && nudgeResult.suggested === 'mobility', counters);

    const mockOldData = {
        recentSessions: [
            createMockSession(1, 'strengthen', true, 20),
            createMockSession(1, 'strengthen', true, 20),
            createMockSession(1, 'strengthen', true, 20),
            createMockSession(1, 'strengthen', true, 20),
            createMockSession(1, 'mobility', true, 20)
        ]
    };
    runTest('Sessions older than 14 days do NOT trigger nudge', evaluateNudge(mockOldData) === null, counters);

    // --- SUITE 2: Plateau Nudge Thresholds ---
    createLog('--- SUITE 2: Plateau Detection Thresholds ---', true, counters);

    // 2a. 3 identical completed sessions at the frontier -> Should trigger
    const mockPlateau = {
        frontierLevel: 1,
        recentSessions: [
            createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen')
        ]
    };
    const plateauResult = evaluatePlateau(mockPlateau);
    runTest('3 identical completed sessions triggers plateau', plateauResult !== null, counters);
    runTest('Plateau suggests level + 1', plateauResult && plateauResult.suggested === 2, counters);

    // 2b. 3 sessions, but only 2 are completed -> Should NOT trigger
    const mockIncomplete = {
        frontierLevel: 1,
        recentSessions: [
            createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen', false)
        ]
    };
    runTest('Incomplete sessions do NOT trigger plateau', evaluatePlateau(mockIncomplete) === null, counters);

    // 2c. 3 sessions of different levels -> Should NOT trigger
    const mockDifferentLevels = {
        frontierLevel: 3,
        recentSessions: [
            createMockSession(1, 'strengthen'), createMockSession(2, 'strengthen'), createMockSession(3, 'strengthen')
        ]
    };
    runTest('Different levels do NOT trigger plateau', evaluatePlateau(mockDifferentLevels) === null, counters);

    // 2d. 3 identical sessions, but frontier is already higher -> Should STILL trigger (we removed the frontier restriction)
    const mockFrontierHigher = {
        frontierLevel: 3,
        recentSessions: [
            createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen'), createMockSession(1, 'strengthen')
        ]
    };
    const frontierHigherResult = evaluatePlateau(mockFrontierHigher);
    runTest('Replaying an old level DOES trigger plateau', frontierHigherResult !== null, counters);
    runTest('Replayed plateau suggests level + 1', frontierHigherResult && frontierHigherResult.suggested === 2, counters);

    // --- FINAL RESULTS ---
    createLog('\n--- Nudge Tests Complete ---', true, counters);
    createLog(`Nudge Results: Passed: ${counters.pass} / ${counters.pass + counters.fail}`, counters.fail === 0, counters);
    return { passed: counters.pass, failed: counters.fail };
}