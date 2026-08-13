Here is a comprehensive, technical **Specification Document** describing exactly how the Trellis generator works today, including all its rules, limits, formulas, and the end-to-end data flow.

---

# Trellis Session Generator — Technical Specification

**Document Version:** v1.0 (Reflects the codebase after all P0 and P1 fixes).
**Last Updated:** August 2026
**Target System:** `session-generator.js`, invoked by `app.js`.

---

## 1. Introduction & High-Level Flow
The session generator is a pure JavaScript function `generateSession()` that transforms user input (level, focus, duration) into a structured, safe, and pedagogically sound sequence of yoga poses. 

It operates on a **"Generate → Validate → Repair"** pipeline. It does not mutate the input `poseLibrary`; it creates a new array of step objects every time it is called.

### The End-to-End User Journey:
1. **User Action:** On the Home screen, the user sets the `Duration` (Short/Medium/Long) and `Focus` (Relax/Strengthen/Mobility), then clicks an unlocked level node (1-200).
2. **`app.js` Controller:** Collects the current state (`focus`, `duration`, `seenPoses`, `bodyFocusHistory`) and the `level`.
3. **Generator Invocation:** Calls `generateSession(poseLibrary, level, focus, duration, seenPoses, bodyFocusHistory)`.
4. **Return Flow:** The generator returns an array of `{ pose, holdTime, side }` objects. `app.js` takes this array and starts the session timer using the first item.

---

## 2. Inputs & Pre-Processing (The Setup Phase)

Before generating any poses, the generator performs mathematical constraints and validations.

### 2.1 Input Validation
- **`poseLibrary`**: Must be a non-empty array. Throws error if invalid.
- **`level`**: Must be an integer between `1` and `200`. Throws error if out of bounds.
- **`focus`**: Must be one of `'relax'`, `'strengthen'`, `'mobility'`.
- **`duration`**: Must be one of `'short'`, `'medium'`, `'long'`.

### 2.2 Level Progression Mapping (The 5 Macro-Blocks)
The generator maps the user's `level` to a specific difficulty pool (`Beginner`, `Intermediate`, `Expert`) based on the agreed 5-block progression system:

| Level Range | Block Name | Max Difficulty Available |
| :--- | :--- | :--- |
| **1 – 10** | Onboarding (Handcrafted) | Beginner |
| **11 – 40** | Foundation | Beginner + Intermediate |
| **41 – 100** | Building | Beginner + Intermediate + Expert |
| **101 – 170** | Advancing | Beginner + Intermediate + Expert |
| **171 – 200** | Integration | Beginner + Intermediate + Expert |

*(Note: In levels 101–200, while the pool contains Expert poses, the generator intentionally prioritizes them less frequently to prevent high-level burnout).*

### 2.3 Duration & Pose Limits
The `duration` parameter sets the "hard cap" for the session time and the maximum number of poses that can be generated. The generator aims to fill **90% to 100%** of the target time.

| Duration | Target Time | Max Poses (excl. Savasana) |
| :--- | :--- | :--- |
| **Short** | 15 minutes (900s) | 10 |
| **Medium** | 25 minutes (1500s) | 15 |
| **Long** | 45 minutes (2700s) | 20 |

*(Savasana is reserved as the absolute final slot, taking `60s`, `180s`, or `300s` depending on duration).*

### 2.4 The 5-Stage Arc (Time Allocation)
The generator divides the generated time (Target Time - Savasana) across 5 specific stages using fixed percentage weights:

| Stage | Weight | Function |
| :--- | :--- | :--- |
| **Centering** | 5% | Seated, still, breath-focused opening. |
| **Warming** | 20% | Dynamic, flowing movement to raise body temperature. |
| **Pathway** | 25% | Progressive, standing preparation building toward the Peak. |
| **Peak** | 30% | The most challenging poses where the Focus is realized. |
| **Cooldown** | 20% | Descending into stillness, preparing for Savasana. |

---

## 3. Core Generation Logic (The Pose Selection Loop)

The generator iterates through the 5 stages sequentially. For each stage, it builds a pool of eligible poses, applies context-aware constraints, and selects poses via a weighted random algorithm.

### 3.1 Stage Pool Filtering
For each stage, poses are filtered by:
1. **`sequence_role`**: The pose must contain the current stage's role (`Centering`, `Warming`, etc.).
2. **Difficulty Pool**: The pose's `difficulty` must be allowed by the current Level Block.
3. **Safety Gating (Level 41+ only)**: If the stage is `Peak` or `Cooldown` AND the `level < 41`, **Shoulder Stand (id 33)** and **Plow (id 27)** are actively excluded from the pool.
4. **Focus Filter**: If the stage is `Pathway` or `Peak`, the pose's `body_focus` must match the user's Focus map.
    - *`relax`:* `Forward-Bend`, `Hip-Opener`, `Twist`, `Inversion`, `Restorative`.
    - *`strengthen`:* `Standing-Strength`, `Core`, `Arm-Balance`, `Backbend`.
    - *`mobility`:* `Hip-Opener`, `Backbend`, `Twist`, `Balance`, `Forward-Bend`.
   *(Centering, Warming, and Cooldown stages ignore the Focus filter to maintain their physiological intent).*

### 3.2 Pathway Specific Grouping (External -> Internal)
The `Pathway` stage is unique. It is split into two sub-stages to enforce the anatomical standing-pose grouping rule:
1. **External Rotation First:** The loop first selects from poses that are `Hip-Opener` (which also have `hip_rotation: external`).
2. **Internal Rotation Second:** Once the time budget for external poses is met, the loop switches to `Standing-Strength` poses with `hip_rotation: internal`.

### 3.3 The Selection Helper (`selectWeightedPose`)
This helper picks a random pose from the candidate pool using a weighted algorithm. The weight of a pose is calculated as follows:

1. **Base Weight:** `1.0`
2. **Focus Bonus:** Adds `+2.0` for *every* `body_focus` tag that matches the user's `focusMap`. (This makes highly relevant poses significantly more likely to be selected).
3. **Body-Focus Penalty:** Loops through the pose's `body_focus` tags. If `bodyFocusHistory` shows heavy prior usage, it subtracts `0.15` per previous usage (capped at a `0.8` total penalty). Weight cannot drop below `0.2`.
4. **Novelty Cap:** If the session has already introduced `2` new poses (poses not in the `seenPoses` array), the candidate pool is strictly filtered to only allow poses from `seenPoses` (previously practiced). This ensures the user gradually learns new poses, avoiding overwhelming them.

### 3.4 Mid-Selection Safety Rules
While the loop is running, several "do not cross" rules are evaluated *before* a pose is committed to the session:

- **Rotation-Transition Rule:** If the `lastPose` has `hip_rotation: "external"` and the new `randomPose` has `hip_rotation: "internal"` (or vice versa), the algorithm **forcefully inserts** a `Downward-Facing Dog` (id 15) between them before adding the new pose.
- **Intensity Counterpose Rule:** If the `lastPose` has `intensity: "intense"`, the algorithm forces the `randomPose` to have a `body_focus` of `Twist`, `Hip-Opener`, `Forward-Bend`, or `Restorative`. If no valid pose fits, it **forcefully falls back to `Child's Pose`** (id 10) immediately.

---

## 4. Safety & Structural Checks (Post-Generation Repair)

After the loops finish filling the session, the generator runs a final validation pipeline: `needsRepair()` and `repairSession()`.

### 4.1 Validator (`needsRepair` - Pure Check)
This function scans the generated sequence for specific gaps. If it finds any, it returns `true`, triggering the repair function.
- Checks for an existing Peak pose.
- Checks for all 5 stages (skipped for handcrafted Levels 1-10).
- Checks for Cat/Cow in the Warming stage if *any* Backbend exists.
- Checks for neck-prep (Cat/Cow) before `load.neck: "high"` poses (Plow/Shoulder Stand).
- Checks for immediate wrist-release (Child's Pose/Dolphin) after `load.wrists: "high"` poses.

### 4.2 Repairer (`repairSession` - Mutation)
If the validator returns `true`, the repairer mutates the existing session array to inject the missing elements:
- Inserts missing Peak/stage poses directly into the sequence.
- Injects `Cat` + `Cow` at the start of the Warming stage.
- Injects `Child's Pose` immediately after a `load.neck: "high"` pose if neck-prep is missing.
- Injects `Child's Pose` immediately after a `load.wrists: "high"` pose if a wrist-release is missing.
- Injects `Child's Pose` between `Backbend` and `Forward-Bend` if the rule is violated.

---

## 5. The Mathematical Formulas (The Engine's Constants)

### 5.1 Base Hold Time Calculation
The hold time for each pose is calculated dynamically based on the `level` and `duration`.
- **Level Contribution:** `20 + (level - 10) * 0.25`
- **Focus Multiplier:** The calculated time is multiplied by the `FOCUS_MODIFIERS` (e.g., 1.4 for Strengthen poses, 0.8 for Relax poses).
- **Final Cap:** 
  - If `duration === 'long'`, the final hold time is capped at **90 seconds**.
  - If `duration === 'short' or 'medium'`, the final hold time is capped at **60 seconds**.
- **Minimum:** All hold times are floored at **20 seconds**.

### 5.2 Savasana (Mandatory Final Pose)
The generator calculates Savasana's hold time separately, *outside* the 5-stage loop. Savasana is appended to the *end* of the session array after the maximum pose count trim. 

---

## 6. Output & Integration

### The Session Data Structure
The generator returns an array of "Step" objects. Each object follows this schema:
```javascript
[
  { 
    pose: { ...full pose object from poses.json... }, 
    holdTime: 30, // In seconds
    side: undefined // Only populated for unilateral poses
  },
  { 
    pose: { ... }, 
    holdTime: 20,
    side: 'left' // Indicates the left side of a bilateral pose
  },
  { 
    pose: { ... }, 
    holdTime: 20,
    side: 'right' // Indicates the right side of a bilateral pose
  },
  { 
    pose: { id: 11, ... }, // Savasana
    holdTime: 300, // 5 minutes for Long session
    side: undefined 
  }
]
```
**Integration:** `app.js` receives this array. It uses the `holdTime` to drive the timer and uses the `side` property to append `(Left)` or `(Right)` to the display name. It also updates the `seenPoses` and `bodyFocusHistory` arrays *after* the entire session is successfully completed.