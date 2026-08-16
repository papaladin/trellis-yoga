/**
 * app.js
 * ------
 * Purpose: The main controller for the Trellis app.
 * 
 * Updates in this version (Block G.2 & G.5):
 * - Added sliding window (14 days) for body-focus history.
 * - Added soft gong chime using Web Audio API.
 */

import { loadState, saveState } from './storage.js';
import { evaluateNudge, evaluatePlateau } from './nudge.js';
import { generateSession } from './session-generator.js';
import { LOCALES } from './locales.js';

const MAX_LEVEL = 200;

class TrellisApp {
    constructor() {
        this.state = loadState();
        this.currentSession = [];
        this.sessionIndex = 0;
        this.isPaused = false;
        this.wakeLock = null;
        this.timerInterval = null;
        this.remainingSeconds = 0;
        this.lastTickTimestamp = 0;
        this.lastSuggestedFocus = null;
        this.lastSuggestedLevel = null;
        this.audioContext = null; // Will be initialized on first user interaction
    }

    // --- TRANSLATION HELPER ---
    t(key, replacements = {}) {
        if (!this.state) return key;
        const lang = this.state.lang || 'en';
        let str = LOCALES[lang][key] || key;
        for (const [placeholder, value] of Object.entries(replacements)) {
            str = str.replace(`{${placeholder}}`, value);
        }
        return str;
    }

    // --- INITIALIZATION ---
    async init() {
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('home-screen').style.display = 'none';
        try {
            const response = await fetch('poses.json');
            this.state.poses = await response.json();
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('home-screen').style.display = 'block';
            
            // Set initial language button visibility
            const lang = this.state.lang || 'en';
            document.getElementById('lang-en').style.display = lang === 'en' ? 'none' : 'inline-block';
            document.getElementById('lang-fr').style.display = lang === 'fr' ? 'none' : 'inline-block';

            this.renderStaticLabels();
            this.renderTrellis();
            this.renderNudge();
            this.checkDisclaimer();
            
            document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
            this.setupUI();
        } catch (error) {
            console.error('❌ Failed to load poses.json:', error);
            document.getElementById('loading-screen').innerHTML = 'Error loading data. Please refresh.';
        }
    }

    checkDisclaimer() {
        const disclaimerSeen = localStorage.getItem('trellis_disclaimer_seen');
        if (!disclaimerSeen) {
            document.getElementById('safety-disclaimer').style.display = 'flex';
        }
    }

    // --- STATIC LABELS RENDERER ---
    renderStaticLabels() {
        const t = (key, reps) => this.t(key, reps);

        document.querySelector('#loading-screen p').textContent = t('loadingText');
        document.getElementById('focus-label').textContent = t('focusLabel');
        document.getElementById('duration-label').textContent = t('durationLabel');

        document.querySelectorAll('.focus-btn').forEach(btn => {
            const focus = btn.dataset.focus;
            btn.textContent = t(focus + 'Btn');
        });
        document.querySelectorAll('.duration-btn').forEach(btn => {
            const dur = btn.dataset.duration;
            btn.textContent = t(dur + 'Btn');
        });

        document.getElementById('unlock-btn').title = t('unlockTitle');
        document.getElementById('exit-session').textContent = t('exitBtn');
        document.getElementById('skip-pose').textContent = t('skipBtn');
        document.getElementById('pause-timer').textContent = this.isPaused ? t('resumeBtn') : t('pauseBtn');

        document.querySelector('#completion-screen h2').textContent = t('completeTitle');
        document.getElementById('continue-home').textContent = t('returnHomeBtn');

        document.querySelector('#safety-disclaimer h2').textContent = t('disclaimerTitle');
        document.querySelector('#safety-disclaimer p').textContent = t('disclaimerBody');
        document.getElementById('disclaimer-acknowledge').textContent = t('disclaimerBtn');
    }

    // --- TRELLIS RENDERING ---
    renderTrellis() {
        const container = document.getElementById('vine-container');
        container.innerHTML = '';
        
        const plateau = evaluatePlateau(this.state);
        const suggestedLevel = plateau ? plateau.suggested : null;

        for (let i = MAX_LEVEL; i >= 1; i--) {
            const node = document.createElement('div');
            node.className = 'node';
            if (i < this.state.frontierLevel) node.classList.add('completed');
            else if (i === this.state.frontierLevel) node.classList.add('available');
            else node.classList.add('locked');
            
            if (suggestedLevel && i === suggestedLevel) {
                node.classList.add('suggested');
            }

            node.textContent = i;
            if (i <= this.state.frontierLevel) {
                node.addEventListener('click', () => this.startSession(i));
            }
            container.appendChild(node);
        }
        this.scrollToLastLevel();
    }

    scrollToLastLevel() {
        let targetLevel = this.state.lastPlayedLevel;
        if (!targetLevel || targetLevel > this.state.frontierLevel) {
            targetLevel = this.state.frontierLevel;
        }
        setTimeout(() => {
            const nodes = document.querySelectorAll('.node');
            for (let i = 0; i < nodes.length; i++) {
                if (parseInt(nodes[i].textContent) === targetLevel) {
                    nodes[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
                    break;
                }
            }
        }, 200);
    }

    // --- NUDGE SYSTEM ---
    renderNudge() {
        const msgBox = document.getElementById('nudge-message');
        const plateauNudge = evaluatePlateau(this.state);
        const focusNudge = evaluateNudge(this.state);

        if (plateauNudge) {
            this.lastSuggestedLevel = plateauNudge.suggested;
            this.lastSuggestedFocus = null;
            const t = this.t;
            msgBox.textContent = t('nudgePlateauMessage', { 
                level: plateauNudge.repeatedLevel, 
                suggested: plateauNudge.suggested 
            });
            document.querySelectorAll('.focus-btn').forEach(btn => btn.style.border = '1px solid #ccc');

            document.querySelectorAll('.node').forEach(n => n.classList.remove('suggested'));
            const targetNode = Array.from(document.querySelectorAll('.node')).find(n => parseInt(n.textContent) === plateauNudge.suggested);
            if (targetNode) targetNode.classList.add('suggested');
            return;
        } 
        
        if (focusNudge) {
            this.lastSuggestedFocus = focusNudge.suggested;
            this.lastSuggestedLevel = null;
            const t = this.t;
            msgBox.textContent = t('nudgeFocusMessage', { 
                focus: focusNudge.primary, 
                suggested: focusNudge.suggested 
            });
            document.querySelectorAll('.node').forEach(n => n.classList.remove('suggested'));
            document.querySelectorAll('.focus-btn').forEach(btn => {
                btn.style.border = btn.dataset.focus === focusNudge.suggested ? '2px solid #D98866' : '1px solid #ccc';
            });
            return;
        }

        this.lastSuggestedFocus = null;
        this.lastSuggestedLevel = null;
        msgBox.textContent = '';
        document.querySelectorAll('.focus-btn').forEach(btn => btn.style.border = '1px solid #ccc');
        document.querySelectorAll('.node').forEach(n => n.classList.remove('suggested'));
    }

    // --- WAKE LOCK ---
    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('✅ Wake Lock acquired');
            }
        } catch (err) { console.warn('⚠️ Wake Lock failed:', err); }
    }

    releaseWakeLock() {
        if (this.wakeLock) { this.wakeLock.release(); this.wakeLock = null; console.log('🔓 Wake Lock released'); }
    }

    handleVisibilityChange() {
        if (!document.hidden && this.currentSession && this.currentSession.length > 0) {
            console.log('📱 App returned to foreground, re-acquiring Wake Lock');
            this.requestWakeLock();
        }
    }

    // --- WEB AUDIO GONG (G.5) ---
    playGong() {
        try {
            // Initialize AudioContext on user interaction
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume if suspended (required by iOS)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            // Create a soft gong (sine wave, fading out)
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4

            gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.2);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start(this.audioContext.currentTime);
            osc.stop(this.audioContext.currentTime + 1.2);
        } catch (err) {
            console.warn('Audio chime failed:', err);
        }
    }

    // --- SESSION TIMER ---
    updateTimerDisplay() {
        const mins = Math.floor(Math.max(0, this.remainingSeconds) / 60);
        const secs = Math.floor(Math.max(0, this.remainingSeconds) % 60);
        document.getElementById('timer').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.isPaused) { this.lastTickTimestamp = Date.now(); return; }
            const now = Date.now();
            const elapsedSeconds = (now - this.lastTickTimestamp) / 1000;
            this.remainingSeconds -= elapsedSeconds;
            this.lastTickTimestamp = now;
            if (this.remainingSeconds <= 0) {
                this.remainingSeconds = 0;
                this.updateTimerDisplay();
                
                // G.5: Play the chime when the timer hits 0
                this.playGong();

                clearInterval(this.timerInterval);
                this.timerInterval = null;
                this.sessionIndex++;
                this.displayPose(this.sessionIndex);
            } else { this.updateTimerDisplay(); }
        }, 100);
    }

    // --- G.2: SLIDING WINDOW COMPUTER ---
    computeRecentBodyFocusHistory(state) {
        const now = Date.now();
        const cutoff = now - (14 * 24 * 60 * 60 * 1000); // 14 days ago
        const recentSessions = state.recentSessions.filter(s => 
            new Date(s.timestamp).getTime() > cutoff
        );
        let history = {};
        recentSessions.forEach(session => {
            session.posesUsed.forEach(poseId => {
                const pose = state.poses.find(p => p.id === poseId);
                if (pose) {
                    pose.body_focus.forEach(tag => {
                        history[tag] = (history[tag] || 0) + 1;
                    });
                }
            });
        });
        return history;
    }

    // --- SESSION FLOW ---
    startSession(level) {
        this.state.currentLevel = level;
        this.state.lastPlayedLevel = level;
        saveState(this.state);
        
        // G.2: Replace lifetime history with 14-day rolling history
        const recentBodyFocusHistory = this.computeRecentBodyFocusHistory(this.state);
        
        this.currentSession = generateSession(
            this.state.poses, 
            level, 
            this.state.focus, 
            this.state.duration, 
            this.state.seenPoses,
            recentBodyFocusHistory // Pass the computed window
        );
        this.sessionIndex = 0;
        
        document.getElementById('home-screen').style.display = 'none';
        document.getElementById('session-screen').style.display = 'block';
        
        this.displayPose(this.sessionIndex);
    }

    displayPose(index) {
        const sessionItem = this.currentSession[index];
        if (!sessionItem) {
            const completedLevel = this.state.currentLevel;
            this.displayCompletionScreen(completedLevel);
            return;
        }
        document.getElementById('pose-progress').textContent = `${index + 1} / ${this.currentSession.length}`;
        
        const pose = sessionItem.pose;
        const side = sessionItem.side;

        let poseName = pose.translations[this.state.lang] || pose.english_name;
        if (side === 'left') {
            poseName += this.t('sideLeft');
        } else if (side === 'right') {
            poseName += this.t('sideRight');
        }
        
        document.getElementById('pose-name').textContent = poseName;
        document.getElementById('pose-image').src = pose.image_url;
        
        const desc = this.state.lang === 'en' ? pose.description_en : pose.description_fr;
        document.getElementById('pose-description').textContent = desc || '';

        this.remainingSeconds = sessionItem.holdTime;
        this.isPaused = false;
        this.lastTickTimestamp = Date.now();
        document.getElementById('pause-timer').textContent = this.t('pauseBtn');
        this.updateTimerDisplay();
        this.startTimer();
        this.requestWakeLock();
    }

    displayCompletionScreen(level) {
        this.releaseWakeLock();
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        document.getElementById('session-screen').style.display = 'none';
        document.getElementById('completion-screen').style.display = 'block';
        document.getElementById('completed-level').textContent = level;
        document.querySelector('#completion-screen p').textContent = this.t('completeMsg', { level: level });
    }

    endSession(completed) {
        document.getElementById('pose-progress').textContent = '0 / 0';
        document.getElementById('pose-name').textContent = '';
        document.getElementById('pose-image').src = '';
        document.getElementById('timer').textContent = '00:00';
        document.getElementById('pose-description').textContent = '';
        
        document.getElementById('completion-screen').style.display = 'none';
        document.getElementById('session-screen').style.display = 'none';
        document.getElementById('home-screen').style.display = 'block';

        const sessionRecord = {
            level: this.state.currentLevel,
            focus: this.state.focus,
            duration: this.state.duration,
            posesUsed: this.currentSession.map(item => item.pose.id),
            completed: completed,
            timestamp: new Date().toISOString()
        };
        this.state.recentSessions.push(sessionRecord);
        if (this.state.recentSessions.length > 30) this.state.recentSessions.shift();

        if (completed) {
            const currentPoseIds = this.currentSession.map(item => item.pose.id);
            this.state.seenPoses = [...new Set([...this.state.seenPoses, ...currentPoseIds])];

            // We still update the persistent history, but it's now aggregated by the sliding window on next load
            this.currentSession.forEach(item => {
                item.pose.body_focus.forEach(tag => {
                    if (this.state.bodyFocusHistory[tag]) {
                        this.state.bodyFocusHistory[tag]++;
                    } else {
                        this.state.bodyFocusHistory[tag] = 1;
                    }
                });
            });
        }

        if (completed && this.state.currentLevel === this.state.frontierLevel) {
            this.state.frontierLevel++;
            this.state.lastPlayedLevel = this.state.frontierLevel;

            saveState(this.state);
            this.renderTrellis();
            this.renderNudge();
        } else {
            console.log('Session replayed or exited. No frontier progress saved.');
            saveState(this.state);
            this.renderTrellis();
            this.renderNudge();
        }
    }

    // --- UI SETUP ---
    setupUI() {
        const app = this;

        document.getElementById('disclaimer-acknowledge').addEventListener('click', () => {
            localStorage.setItem('trellis_disclaimer_seen', 'true');
            document.getElementById('safety-disclaimer').style.display = 'none';
        });

        // Language Buttons
        const toggleLang = (lang) => {
            if (app.state.lang === lang) return;
            app.state.lang = lang;
            saveState(app.state);
            
            document.getElementById('lang-en').style.display = lang === 'en' ? 'none' : 'inline-block';
            document.getElementById('lang-fr').style.display = lang === 'fr' ? 'none' : 'inline-block';
            
            app.renderStaticLabels();
            app.renderNudge();
            
            if (document.getElementById('session-screen').style.display !== 'none') {
                app.displayPose(app.sessionIndex);
            }
        };

        document.getElementById('lang-en').addEventListener('click', () => toggleLang('en'));
        document.getElementById('lang-fr').addEventListener('click', () => toggleLang('fr'));

        // Quick Unlock Button
        const unlockBtn = document.getElementById('unlock-btn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                const input = prompt('Enter the level to unlock (1-200):');
                if (input === null) return;

                const targetLevel = parseInt(input, 10);
                if (!isNaN(targetLevel) && targetLevel >= 1 && targetLevel <= MAX_LEVEL) {
                    const confirmed = confirm(
                        `This will reset your recent session history, focus tracking, and pose progress. Are you sure you want to jump to Level ${targetLevel}?`
                    );
                    if (!confirmed) return;

                    app.state.frontierLevel = targetLevel;
                    app.state.lastPlayedLevel = targetLevel;
                    app.state.recentSessions = [];
                    app.state.focusHistory = { relax: 0, strengthen: 0, mobility: 0 };
                    app.state.seenPoses = [];
                    
                    saveState(app.state);
                    app.renderTrellis();
                    app.renderNudge();
                    console.log(`🔓 Quick Unlock: Jumped to Level ${targetLevel}`);
                } else {
                    alert('Please enter a valid number between 1 and 200.');
                }
            });
        }

        // Focus Buttons
        document.querySelectorAll('.focus-btn').forEach(btn => {
            if (btn.dataset.focus === app.state.focus) btn.classList.add('active');
            else btn.classList.remove('active');
            btn.addEventListener('click', () => {
                const currentActive = document.querySelector('.focus-btn.active');
                if (currentActive) currentActive.classList.remove('active');
                btn.classList.add('active');
                app.state.focus = btn.dataset.focus;
                saveState(app.state);
                
                if (app.lastSuggestedFocus === app.state.focus) {
                    document.getElementById('nudge-message').textContent = '';
                    document.querySelectorAll('.focus-btn').forEach(b => b.style.border = '1px solid #ccc');
                    app.lastSuggestedFocus = null;
                    app.renderTrellis(); 
                } else { app.renderNudge(); }
            });
        });
        
        // Duration Buttons
        document.querySelectorAll('.duration-btn').forEach(btn => {
            if (btn.dataset.duration === app.state.duration) btn.classList.add('active');
            else btn.classList.remove('active');
            btn.addEventListener('click', () => {
                const currentActive = document.querySelector('.duration-btn.active');
                if (currentActive) currentActive.classList.remove('active');
                btn.classList.add('active');
                app.state.duration = btn.dataset.duration;
                saveState(app.state);
            });
        });

        // Session Controls via Event Delegation
        document.getElementById('session-screen').addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.id === 'exit-session') {
                console.log('Exit clicked');
                app.releaseWakeLock();
                if (app.timerInterval) {
                    clearInterval(app.timerInterval);
                    app.timerInterval = null;
                }
                app.endSession(false);
            }

            if (target.id === 'skip-pose') {
                clearInterval(app.timerInterval);
                app.timerInterval = null;
                app.sessionIndex++;
                app.displayPose(app.sessionIndex);
            }

            if (target.id === 'pause-timer') {
                app.isPaused = !app.isPaused;
                document.getElementById('pause-timer').textContent = app.isPaused ? app.t('resumeBtn') : app.t('pauseBtn');
                if (!app.isPaused) app.lastTickTimestamp = Date.now();
            }
        });

        document.getElementById('continue-home').addEventListener('click', () => {
            app.endSession(true);
        });
    }
}

// Initialize the App
document.addEventListener('DOMContentLoaded', () => {
    const app = new TrellisApp();
    app.init();
});