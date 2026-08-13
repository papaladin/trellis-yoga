/**
 * nudge.js
 * ---------
 * Purpose: Analyzes session history for Focus imbalances and repeated Frontier plateaus.
 */

const NUDGE_WINDOW_DAYS = 14;
const MIN_GAP = 2; // Must be ahead by at least 2 sessions to trigger an imbalance

export function evaluateNudge(state) {
    if (!state.recentSessions || state.recentSessions.length < 5) return null;

    const now = Date.now();
    const cutoff = now - (NUDGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentSessions = state.recentSessions.filter(s => 
        new Date(s.timestamp).getTime() > cutoff
    );
    if (recentSessions.length < 3) return null;

    const focusCounts = { relax: 0, strengthen: 0, mobility: 0 };
    recentSessions.forEach(s => {
        if (s.completed && focusCounts[s.focus] !== undefined) focusCounts[s.focus]++;
    });

    const sorted = Object.entries(focusCounts).sort((a, b) => b[1] - a[1]);
    const mostUsed = sorted[0];
    const secondMost = sorted[1];

    const conditionMet = mostUsed[1] >= MIN_GAP && (mostUsed[1] - secondMost[1] >= MIN_GAP);
    if (conditionMet) {
        const primary = mostUsed[0];
        let suggested = 'relax';
        if (primary === 'relax') suggested = 'strengthen';
        else if (primary === 'strengthen') suggested = 'mobility';
        else suggested = 'relax';

        return {
            message: `Notice: You've been focusing on ${primary} a lot lately. Try a ${suggested} session today for balance.`,
            suggested: suggested,
            primary: primary
        };
    }
    return null;
}

// Plateau Detection checking the last 3 completed sessions
export function evaluatePlateau(state) {
    if (!state.recentSessions || state.recentSessions.length < 3) return null;

    const last3 = state.recentSessions.slice(-3);
    const allCompleted = last3.every(s => s.completed === true);
    const allSameLevel = last3.every(s => s.level === last3[0].level);

    // A plateau is simply playing the exact same level 3 times, regardless of whether it is the frontier.
    if (allCompleted && allSameLevel) {
        const repeatedLevel = last3[0].level;
        const suggestedLevel = repeatedLevel + 1;
        return {
            message: `You've mastered Level ${repeatedLevel} several times! Ready to try Level ${suggestedLevel}?`,
            suggested: suggestedLevel,
            repeatedLevel: repeatedLevel
        };
    }
    return null;
}