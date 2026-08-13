/**
 * locales.js
 * ------
 * Purpose: Centralized dictionary for all UI text strings in English and French.
 */

export const LOCALES = {
  en: {
    // General
    appName: 'Trellis',
    loadingText: 'Loading your practice...',

    // HUD Labels
    focusLabel: 'Focus',
    durationLabel: 'Duration',
    relaxBtn: 'Relax',
    strengthenBtn: 'Strengthen',
    mobilityBtn: 'Mobility',
    shortBtn: 'Short',
    mediumBtn: 'Medium',
    longBtn: 'Long',

    // Session Screen
    poseProgress: '{current} / {total} poses',
    exitBtn: '← Exit',
    skipBtn: 'Skip',
    pauseBtn: 'Pause',
    resumeBtn: 'Resume',

    // Completion Screen
    completeTitle: '🎉 Session Complete!',
    completeMsg: 'Great job finishing Level {level}',
    returnHomeBtn: 'Return to Trellis',

    // Safety Disclaimer Modal
    disclaimerTitle: '⚠️ Safety First',
    disclaimerBody: 'Some poses, like Shoulder Stand and Plow, place significant weight on the neck. Please consult a qualified professional before attempting them if you have neck, back, or spinal conditions. If anything hurts, stop immediately.',
    disclaimerBtn: 'I Understand',

    // Quick Unlock Button
    unlockTitle: 'Quick Unlock',

    // Nudge Messages
    nudgePlateauMessage: "You've mastered Level {level} several times! Ready to try Level {suggested}?",
    nudgeFocusMessage: "Notice: You've been focusing on {focus} a lot lately. Try a {suggested} session today for balance."
  },

  fr: {
    // General
    appName: 'Trellis',
    loadingText: 'Chargement de votre pratique...',

    // HUD Labels
    focusLabel: 'Focus',
    durationLabel: 'Durée',
    relaxBtn: 'Détente',
    strengthenBtn: 'Renforcement',
    mobilityBtn: 'Mobilité',
    shortBtn: 'Court',
    mediumBtn: 'Moyen',
    longBtn: 'Long',

    // Session Screen
    poseProgress: '{current} / {total} postures',
    exitBtn: '← Sortir',
    skipBtn: 'Passer',
    pauseBtn: 'Pause',
    resumeBtn: 'Reprendre',

    // Completion Screen
    completeTitle: '🎉 Séance terminée !',
    completeMsg: 'Excellent travail pour le niveau {level}',
    returnHomeBtn: 'Retour au Treillis',

    // Safety Disclaimer Modal
    disclaimerTitle: '⚠️ La sécurité d\'abord',
    disclaimerBody: 'Certaines postures, comme la Chandelle et la Charrue, placent un poids important sur le cou. Consultez un professionnel qualifié avant de les pratiquer si vous avez des problèmes de cou, de dos ou de colonne vertébrale. Si quelque chose fait mal, arrêtez-vous immédiatement.',
    disclaimerBtn: 'J\'ai compris',

    // Quick Unlock Button
    unlockTitle: 'Déverrouillage rapide',

    // Nudge Messages
    nudgePlateauMessage: "Vous avez maîtrisé le niveau {level} plusieurs fois ! Prêt à essayer le niveau {suggested} ?",
    nudgeFocusMessage: "Remarque : vous vous êtes beaucoup concentré sur {focus} ces derniers temps. Essayez une séance {suggested} aujourd'hui pour varier."
  }
};