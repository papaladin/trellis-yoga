/**
 * storage.js
 * ------
 * Purpose: Handles persistence (localStorage), schema versioning, state migration, 
 * and tracking of seen poses for continuity features.
 * 
 * Updates in this version:
 * - Removed `focusHistory` (redundant, nudge is calculated from `recentSessions`).
 */

const STATE_KEY = 'trellis_progress';

export function getDefaultState() {
    return {
        schemaVersion: 1,
        frontierLevel: 1,
        lastPlayedLevel: 1,
        recentSessions: [], // Array of { level, focus, duration, posesUsed, completed, timestamp }
        bodyFocusHistory: {}, // Tracks usage of body_focus tags (e.g., { 'backbend': 2, 'hip-opener': 4 })
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
        // Automatically merges missing fields with defaults
        return Object.assign({}, getDefaultState(), parsed);
    } catch (e) {
        console.warn('Failed to load state, using defaults:', e);
        return getDefaultState();
    }
}