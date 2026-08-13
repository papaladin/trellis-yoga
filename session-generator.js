/**
 * session-generator.js
 * ------
 * Purpose: The core algorithmic "brain" of the app.
 * 
 * Updates in this version:
 * - Decoupled validation (`needsRepair`) from mutation (`repairSession`).
 * - Fixed infinite loop by filtering lastPoseId before weighting.
 * - Added 5‑block progression (Onboarding, Foundation, Building, Advancing, Integration).
 * - Added bilateral pose split (Left / Right).
 * - Added load‑based safety rules (neck and wrist).
 */

const DURATION_TARGETS = { short: 15 * 60, medium: 25 * 60, long: 45 * 60 };
const SAVASANA_TIME = { short: 60, medium: 180, long: 300 };
const STAGE_WEIGHTS = { centering: 0.05, warming: 0.20, pathway: 0.25, peak: 0.30, cooldown: 0.20 };
const MAX_POSES_TOTAL = { short: 10, medium: 15, long: 20 };

const FOCUS_MODIFIERS = {
    strengthen: { 'Standing-Strength': 1.4, 'Core': 1.4, 'Arm-Balance': 1.4, 'Backbend': 1.2, 'Forward-Bend': 0.8, 'Hip-Opener': 0.8, 'Twist': 0.8, 'Inversion': 0.8, 'Restorative': 0.6 },
    relax: { 'Standing-Strength': 0.6, 'Core': 0.6, 'Arm-Balance': 0.6, 'Backbend': 0.8, 'Forward-Bend': 1.4, 'Hip-Opener': 1.4, 'Twist': 1.4, 'Inversion': 1.2, 'Restorative': 1.4 },
    mobility: { 'Standing-Strength': 0.8, 'Core': 1.0, 'Arm-Balance': 1.0, 'Backbend': 1.0, 'Forward-Bend': 1.2, 'Hip-Opener': 1.4, 'Twist': 1.4, 'Inversion': 1.0, 'Restorative': 1.0, 'Balance': 1.3 }
};

// 5-block progression (README-aligned)
const LEVEL_RANGES = {
    onboarding: { min: 1, max: 10, poseDifficulties: ['Beginner'] },
    foundation: { min: 11, max: 40, poseDifficulties: ['Beginner', 'Intermediate'] },
    building:   { min: 41, max: 100, poseDifficulties: ['Beginner', 'Intermediate', 'Expert'] },
    advancing:  { min: 101, max: 170, poseDifficulties: ['Beginner', 'Intermediate', 'Expert'] },
    integration: { min: 171, max: 200, poseDifficulties: ['Beginner', 'Intermediate', 'Expert'] }
};

function getFocusMultiplier(focus, bodyFocus) {
    const modifiers = FOCUS_MODIFIERS[focus];
    if (!modifiers) return 1.0;
    let multiplier = 1.0;
    for (const tag of bodyFocus) {
        if (modifiers[tag] !== undefined && modifiers[tag] > multiplier) multiplier = modifiers[tag];
    }
    return multiplier;
}

function getLevelRange(level) {
    if (level <= 10) return LEVEL_RANGES.onboarding;
    if (level <= 40) return LEVEL_RANGES.foundation;
    if (level <= 100) return LEVEL_RANGES.building;
    if (level <= 170) return LEVEL_RANGES.advancing;
    return LEVEL_RANGES.integration;
}

const handcraftedSessions = {
    1: { poses: [38, 10] }, 2: { poses: [7, 8, 38, 10] }, 3: { poses: [7, 8, 38, 42, 10] },
    4: { poses: [7, 8, 15, 42, 10] }, 5: { poses: [7, 8, 15, 26, 42, 10] },
    6: { poses: [7, 8, 15, 41, 26, 10] }, 7: { poses: [7, 8, 15, 35, 41, 10] },
    8: { poses: [7, 8, 15, 32, 41, 10] }, 9: { poses: [7, 8, 15, 44, 41, 10] },
    10: { poses: [7, 8, 15, 44, 45, 10] }
};

// --- VALIDATOR (PURE CHECKS) ---
function needsRepair(sessionPoses, poseLibrary, level) {
    if (level > 10) {
        const hasPeak = sessionPoses.some(sp => sp.pose.sequence_role.includes('Peak'));
        if (!hasPeak) return true;

        const stageRoles = ['Centering', 'Warming', 'Pathway', 'Peak', 'Cooldown'];
        for (const role of stageRoles) {
            if (!sessionPoses.some(sp => sp.pose.sequence_role.includes(role))) return true;
        }
    }

    const hasBackbend = sessionPoses.some(sp => sp.pose.body_focus.includes('Backbend'));
    const hasSpineWarmup = sessionPoses.some(sp => ['Cat', 'Cow'].includes(sp.pose.english_name));
    if (hasBackbend && !hasSpineWarmup) return true;

    const highNeckIndex = sessionPoses.findIndex(sp => sp.pose.load && sp.pose.load.neck === 'high');
    if (highNeckIndex !== -1) {
        const warmingPoses = sessionPoses.slice(0, highNeckIndex);
        const hasNeckPrep = warmingPoses.some(sp => ['Cat', 'Cow'].includes(sp.pose.english_name));
        if (!hasNeckPrep) return true;
    }

    for (let i = 0; i < sessionPoses.length - 1; i++) {
        const current = sessionPoses[i].pose;
        if (current.load && current.load.wrists === 'high') {
            const next = sessionPoses[i + 1].pose;
            const isWristRelease = next.id === 10 || next.id === 14;
            if (!isWristRelease) return true;
        }
    }

    for (let i = 1; i < sessionPoses.length; i++) {
        const prev = sessionPoses[i-1].pose;
        const curr = sessionPoses[i].pose;
        if (prev.body_focus.includes('Backbend') && curr.body_focus.includes('Forward-Bend')) {
            return true;
        }
    }

    return false;
}

// --- REPAIRER (MUTATES SESSION) ---
function repairSession(sessionPoses, poseLibrary, level, focus, duration) {
    if (level > 10) {
        const hasPeak = sessionPoses.some(sp => sp.pose.sequence_role.includes('Peak'));
        if (!hasPeak) {
            const fallbackPeak = poseLibrary.find(p => p.sequence_role.includes('Peak') && p.difficulty !== 'Expert');
            if (fallbackPeak) {
                const insertIndex = Math.min(5, sessionPoses.length - 1);
                sessionPoses.splice(insertIndex, 0, { pose: fallbackPeak, holdTime: 30 });
            }
        }
        const stageRoles = ['Centering', 'Warming', 'Pathway', 'Peak', 'Cooldown'];
        for (const role of stageRoles) {
            const hasStage = sessionPoses.some(sp => sp.pose.sequence_role.includes(role));
            if (!hasStage) {
                const fallback = poseLibrary.find(p => p.sequence_role.includes(role) && p.difficulty !== 'Expert');
                if (fallback) sessionPoses.splice(1, 0, { pose: fallback, holdTime: 30 });
            }
        }
    }

    for (let i = 1; i < sessionPoses.length; i++) {
        const prev = sessionPoses[i-1].pose;
        const curr = sessionPoses[i].pose;
        if (prev.body_focus.includes('Backbend') && curr.body_focus.includes('Forward-Bend')) {
            const child = poseLibrary.find(p => p.id === 10);
            if (child) {
                sessionPoses.splice(i, 0, { pose: child, holdTime: 30 });
                i++;
            }
        }
    }
    
    const hasBackbend = sessionPoses.some(sp => sp.pose.body_focus.includes('Backbend'));
    const hasSpineWarmup = sessionPoses.some(sp => ['Cat', 'Cow'].includes(sp.pose.english_name));
    if (hasBackbend && !hasSpineWarmup) {
        const cat = poseLibrary.find(p => p.id === 7);
        const cow = poseLibrary.find(p => p.id === 8);
        if (cat && cow) {
            sessionPoses.splice(1, 0, { pose: cow, holdTime: 20 }, { pose: cat, holdTime: 20 });
        }
    }

    const highNeckIndex = sessionPoses.findIndex(sp => sp.pose.load && sp.pose.load.neck === 'high');
    if (highNeckIndex !== -1) {
        const warmingPoses = sessionPoses.slice(0, highNeckIndex);
        const hasNeckPrep = warmingPoses.some(sp => ['Cat', 'Cow'].includes(sp.pose.english_name));
        if (!hasNeckPrep) {
            const cat = poseLibrary.find(p => p.id === 7);
            const cow = poseLibrary.find(p => p.id === 8);
            if (cat && cow) {
                sessionPoses.splice(1, 0, { pose: cow, holdTime: 20 }, { pose: cat, holdTime: 20 });
            }
        }
    }

    for (let i = 0; i < sessionPoses.length - 1; i++) {
        const current = sessionPoses[i].pose;
        if (current.load && current.load.wrists === 'high') {
            const next = sessionPoses[i + 1].pose;
            const isWristRelease = next.id === 10 || next.id === 14;
            if (!isWristRelease) {
                const child = poseLibrary.find(p => p.id === 10);
                if (child) {
                    sessionPoses.splice(i + 1, 0, { pose: child, holdTime: 30 });
                    i++;
                }
            }
        }
    }

    return sessionPoses;
}

// --- SELECTION HELPER ---
function selectWeightedPose(allowedPoses, focus, focusMap, lastPoseId, currentSessionPoses, seenPoses, newPoseLimit, bodyFocusHistory) {
    if (!allowedPoses || allowedPoses.length === 0) return null;

    let candidatePool = allowedPoses;
    if (lastPoseId !== null) {
        candidatePool = allowedPoses.filter(p => p.id !== lastPoseId);
        if (candidatePool.length === 0) candidatePool = allowedPoses;
    }

    const existingNewPoses = currentSessionPoses.filter(p => !seenPoses.includes(p.id));
    const newPoseCount = existingNewPoses.length;

    if (newPoseCount >= newPoseLimit) {
        candidatePool = candidatePool.filter(p => seenPoses.includes(p.id));
        if (candidatePool.length === 0) candidatePool = allowedPoses.filter(p => p.id !== lastPoseId) || allowedPoses;
    }

    const weightedPoses = candidatePool.map(p => {
        let weight = 1.0;
        const matchedTags = p.body_focus.filter(tag => focusMap[focus].includes(tag));
        if (matchedTags.length > 0) weight += (matchedTags.length * 2.0);
        let totalPenalty = 0;
        for (const tag of p.body_focus) {
            if (bodyFocusHistory && bodyFocusHistory[tag] && bodyFocusHistory[tag] > 0) {
                totalPenalty += Math.min(0.8, bodyFocusHistory[tag] * 0.15);
            }
        }
        weight = Math.max(0.2, weight - totalPenalty);
        return { pose: p, weight: weight };
    });

    const totalWeight = weightedPoses.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return null;
    
    let randomNum = Math.random() * totalWeight;
    let selectedPose = weightedPoses[0].pose;
    for (const item of weightedPoses) {
        randomNum -= item.weight;
        if (randomNum <= 0) { selectedPose = item.pose; break; }
    }
    return selectedPose;
}

// ---- MAIN GENERATOR ----
export function generateSession(poseLibrary, level, focus, duration, seenPoses = [], bodyFocusHistory = {}) {
    if (!poseLibrary || !Array.isArray(poseLibrary)) {
        throw new Error('Invalid poseLibrary: must be an array');
    }
    if (typeof level !== 'number' || level < 1 || level > 200) {
        throw new Error('Invalid level: must be a number between 1 and 200');
    }
    if (!['relax', 'strengthen', 'mobility'].includes(focus)) {
        throw new Error('Invalid focus: must be relax, strengthen, or mobility');
    }
    if (!['short', 'medium', 'long'].includes(duration)) {
        throw new Error('Invalid duration: must be short, medium, or long');
    }

    const targetDuration = DURATION_TARGETS[duration];
    const savasanaDuration = SAVASANA_TIME[duration];
    const maxPoses = MAX_POSES_TOTAL[duration];
    const maxPosesWithoutSavasana = maxPoses - 1; 
    const NEW_POSE_LIMIT = 2; 
    
    const variance = 0.90 + (Math.random() * 0.10);
    const totalTargetTime = Math.round(targetDuration * variance);

    // ----- HANDCRAFTED LEVELS 1–10 (WITH BILATERAL SPLIT) -----
    if (level <= 10) {
        const ids = handcraftedSessions[level].poses;
        const holdTime = Math.min(60, Math.round((totalTargetTime - savasanaDuration) / ids.length));
        let session = [];
        ids.forEach(id => {
            const pose = poseLibrary.find(p => p.id === id);
            if (pose && pose.unilateral === true) {
                const halfHold = Math.floor(holdTime / 2);
                session.push({ pose: pose, holdTime: halfHold, side: 'left' });
                session.push({ pose: pose, holdTime: holdTime - halfHold, side: 'right' });
            } else if (pose) {
                session.push({ pose: pose, holdTime: Math.max(20, holdTime) });
            }
        });
        session.push({ pose: poseLibrary.find(p => p.id === 11), holdTime: savasanaDuration });
        return session;
    }

    // ----- PROCEDURAL LEVELS (11–200) -----
    const baseHold = Math.min(60, Math.max(20, 20 + (level - 10) * 0.25)); 
    const levelRange = getLevelRange(level);
    const focusMap = {
        relax: ['Forward-Bend', 'Hip-Opener', 'Twist', 'Inversion', 'Restorative'],
        strengthen: ['Standing-Strength', 'Core', 'Arm-Balance', 'Backbend'],
        mobility: ['Hip-Opener', 'Backbend', 'Twist', 'Balance', 'Forward-Bend']
    };

    const arcStages = [
        { role: 'Centering', weight: STAGE_WEIGHTS.centering },
        { role: 'Warming', weight: STAGE_WEIGHTS.warming },
        { role: 'Pathway', weight: STAGE_WEIGHTS.pathway },
        { role: 'Peak', weight: STAGE_WEIGHTS.peak },
        { role: 'Cooldown', weight: STAGE_WEIGHTS.cooldown }
    ];

    let sessionPoses = [], globalAccumulatedTime = 0, lastPose = null;

    for (const stage of arcStages) {
        const timeAllocPerStage = totalTargetTime - savasanaDuration;
        const stageTimeTarget = timeAllocPerStage * stage.weight;

        let eligiblePools = poseLibrary.filter(p => 
            p.sequence_role.includes(stage.role) && 
            levelRange.poseDifficulties.includes(p.difficulty)
        );

        if ((stage.role === 'Peak' || stage.role === 'Cooldown') && level < 41) {
            eligiblePools = eligiblePools.filter(p => p.id !== 27 && p.id !== 33);
        }

        if (stage.role === 'Pathway' || stage.role === 'Peak') {
            eligiblePools = eligiblePools.filter(p => 
                p.body_focus.some(tag => focusMap[focus].includes(tag))
            );
        }

        if (eligiblePools.length === 0) {
            eligiblePools = poseLibrary.filter(p => 
                p.sequence_role.includes(stage.role) && 
                levelRange.poseDifficulties.includes(p.difficulty)
            );
        }

        if (stage.role === 'Pathway') {
            const pathwaySubStages = [
                { filter: (p) => p.body_focus.includes('Hip-Opener') && !p.body_focus.includes('Forward-Bend') && !p.body_focus.includes('Core') },
                { filter: (p) => p.body_focus.includes('Standing-Strength') && (p.body_focus.includes('Forward-Bend') || p.body_focus.includes('Core') || p.body_focus.includes('Balance')) }
            ];
            for (const subStage of pathwaySubStages) {
                let subEligible = eligiblePools.filter(subStage.filter);
                if (subEligible.length === 0) continue;
                let subStageAccumulated = 0;
                let subTarget = stageTimeTarget * 0.5;

                while (subStageAccumulated < subTarget && sessionPoses.length < maxPosesWithoutSavasana) {
                    let allowedPoses = subEligible;
                    if (lastPose && lastPose.body_focus.some(tag => ['Backbend', 'Inversion'].includes(tag))) {
                        allowedPoses = subEligible.filter(p => p.body_focus.some(tag => ['Twist', 'Hip-Opener', 'Forward-Bend', 'Restorative'].includes(tag)));
                        if (allowedPoses.length === 0) allowedPoses = subEligible;
                    }
                    if (lastPose && lastPose.body_focus.some(tag => ['Arm-Balance'].includes(tag))) {
                        allowedPoses = subEligible.filter(p => p.body_focus.some(tag => ['Restorative', 'Forward-Bend'].includes(tag)));
                        if (allowedPoses.length === 0) allowedPoses = subEligible;
                    }
                    if (lastPose && lastPose.intensity === 'intense') {
                        allowedPoses = subEligible.filter(p => 
                            p.body_focus.some(tag => ['Twist', 'Hip-Opener', 'Forward-Bend', 'Restorative'].includes(tag))
                        );
                        if (allowedPoses.length === 0) {
                            const child = poseLibrary.find(p => p.id === 10);
                            allowedPoses = child ? [child] : subEligible;
                        }
                    }

                    const randomPose = selectWeightedPose(
                        allowedPoses, 
                        focus, 
                        focusMap, 
                        lastPose ? lastPose.id : null, 
                        sessionPoses, 
                        seenPoses, 
                        NEW_POSE_LIMIT, 
                        bodyFocusHistory
                    );
                    if (!randomPose) continue;

                    if (lastPose && lastPose.hip_rotation !== 'neutral' && randomPose.hip_rotation !== 'neutral' && lastPose.hip_rotation !== randomPose.hip_rotation) {
                        const downDog = poseLibrary.find(p => p.id === 15);
                        if (downDog) {
                            sessionPoses.push({ pose: downDog, holdTime: 30 });
                            globalAccumulatedTime += 30;
                            subStageAccumulated += 30;
                        }
                    }
                    
                    const modifier = getFocusMultiplier(focus, randomPose.body_focus);
                    let holdTime = Math.round(baseHold * modifier);
                    const cap = duration === 'long' ? 90 : 60;
                    holdTime = Math.min(cap, Math.max(20, holdTime));

                    if (globalAccumulatedTime + holdTime > totalTargetTime - savasanaDuration) break;

                    // --- BILATERAL SPLIT ---
                    if (randomPose.unilateral === true) {
                        const halfHold = Math.floor(holdTime / 2);
                        sessionPoses.push({ pose: randomPose, holdTime: halfHold, side: 'left' });
                        sessionPoses.push({ pose: randomPose, holdTime: holdTime - halfHold, side: 'right' });
                        subStageAccumulated += holdTime;
                        globalAccumulatedTime += holdTime;
                        lastPose = randomPose;
                    } else {
                        sessionPoses.push({ pose: randomPose, holdTime: holdTime });
                        subStageAccumulated += holdTime;
                        globalAccumulatedTime += holdTime;
                        lastPose = randomPose;
                    }
                }
            }
            continue;
        }

        let stageAccumulated = 0;
        while (stageAccumulated < stageTimeTarget && sessionPoses.length < maxPosesWithoutSavasana) {
            let allowedPoses = eligiblePools;
            if (lastPose && lastPose.body_focus.some(tag => ['Backbend', 'Inversion'].includes(tag))) {
                allowedPoses = eligiblePools.filter(p => p.body_focus.some(tag => ['Twist', 'Hip-Opener', 'Forward-Bend', 'Restorative'].includes(tag)));
                if (allowedPoses.length === 0) allowedPoses = eligiblePools;
            }
            if (lastPose && lastPose.body_focus.some(tag => ['Arm-Balance'].includes(tag))) {
                allowedPoses = eligiblePools.filter(p => p.body_focus.some(tag => ['Restorative', 'Forward-Bend'].includes(tag)));
                if (allowedPoses.length === 0) allowedPoses = eligiblePools;
            }
            if (lastPose && lastPose.intensity === 'intense') {
                allowedPoses = eligiblePools.filter(p => 
                    p.body_focus.some(tag => ['Twist', 'Hip-Opener', 'Forward-Bend', 'Restorative'].includes(tag))
                );
                if (allowedPoses.length === 0) {
                    const child = poseLibrary.find(p => p.id === 10);
                    allowedPoses = child ? [child] : eligiblePools;
                }
            }

            const randomPose = selectWeightedPose(
                allowedPoses, 
                focus, 
                focusMap, 
                lastPose ? lastPose.id : null, 
                sessionPoses, 
                seenPoses, 
                NEW_POSE_LIMIT, 
                bodyFocusHistory
            );
            if (!randomPose) continue;

            if (lastPose && lastPose.hip_rotation !== 'neutral' && randomPose.hip_rotation !== 'neutral' && lastPose.hip_rotation !== randomPose.hip_rotation) {
                const downDog = poseLibrary.find(p => p.id === 15);
                if (downDog) {
                    sessionPoses.push({ pose: downDog, holdTime: 30 });
                    globalAccumulatedTime += 30;
                    stageAccumulated += 30;
                }
            }
            
            const modifier = getFocusMultiplier(focus, randomPose.body_focus);
            let holdTime = Math.round(baseHold * modifier);
            const cap = duration === 'long' ? 90 : 60;
            holdTime = Math.min(cap, Math.max(20, holdTime));

            if (globalAccumulatedTime + holdTime > totalTargetTime - savasanaDuration) break;

            // --- BILATERAL SPLIT ---
            if (randomPose.unilateral === true) {
                const halfHold = Math.floor(holdTime / 2);
                sessionPoses.push({ pose: randomPose, holdTime: halfHold, side: 'left' });
                sessionPoses.push({ pose: randomPose, holdTime: holdTime - halfHold, side: 'right' });
                stageAccumulated += holdTime;
                globalAccumulatedTime += holdTime;
                lastPose = randomPose;
            } else {
                sessionPoses.push({ pose: randomPose, holdTime: holdTime });
                stageAccumulated += holdTime;
                globalAccumulatedTime += holdTime;
                lastPose = randomPose;
            }
        }
    }

    if (sessionPoses.length > maxPosesWithoutSavasana) {
        sessionPoses.splice(maxPosesWithoutSavasana, sessionPoses.length - maxPosesWithoutSavasana);
    }
    const savasana = poseLibrary.find(p => p.id === 11);
    sessionPoses.push({ pose: savasana, holdTime: savasanaDuration });

    // 1. Validate
    if (needsRepair(sessionPoses, poseLibrary, level)) {
        // 2. Repair if needed
        sessionPoses = repairSession(sessionPoses, poseLibrary, level, focus, duration);
    }

    return sessionPoses;
}