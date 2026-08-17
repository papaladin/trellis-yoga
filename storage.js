/**
 * storage.js
 * ------
 * Purpose: Handles persistence (localStorage), schema versioning, state migration, 
 * and tracking of seen poses for continuity features.
 * 
 * Updates in this version:
 * - Removed `focusHistory` (redundant, nudge is calculated from `recentSessions`).
 * - REMOVED `bodyFocusHistory` (schema v1->v2). It was a lifetime cumulative counter
 *   that had already been superseded by the 14-day rolling window computed fresh
 *   from `recentSessions` in app.js (`computeRecentBodyFocusHistory`) — nothing read
 *   this field anymore, it just grew forever. `recentSessions` already contains
 *   everything needed (posesUsed per session + timestamp) to derive it, so there's
 *   no separate persisted counter to maintain.
 * - Migration: existing saved state from schema v1 gets `bodyFocusHistory` stripped
 *   on next load, since Object.assign would otherwise carry it over from old saves
 *   even after removing it from the defaults here.
 */

const STATE_KEY = 'trellis_progress';
const CURRENT_SCHEMA_VERSION = 2;

export function getDefaultState() {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        frontierLevel: 1,
        lastPlayedLevel: 1,
        recentSessions: [], // Array of { level, focus, duration, posesUsed, completed, timestamp }
        focus: 'strengthen',
        duration: 'medium',
        seenPoses: [],
        lang: 'en'
    };
}

export function saveState(state) {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save state:', e);
    }
}

export function loadState() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw) return getDefaultState();
        const parsed = JSON.parse(raw);
        // Merge onto defaults so newly-added fields exist for older saved state.
        const merged = Object.assign({}, getDefaultState(), parsed);
        // Migration v1 -> v2: strip the now-removed bodyFocusHistory field, since
        // Object.assign would otherwise carry it over from an old save.
        if (parsed.schemaVersion === undefined || parsed.schemaVersion < 2) {
            delete merged.bodyFocusHistory;
        }
        merged.schemaVersion = CURRENT_SCHEMA_VERSION;
        return merged;
    } catch (e) {
        console.warn('Failed to load state, using defaults:', e);
        return getDefaultState();
    }
}