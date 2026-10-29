/**
 * Cat Puzzle - Application Controller
 * Handles screen transitions, DOM events, UI rendering, keyboard shortcuts,
 * confetti celebration, and integrates all subsystems.
 */

import { LevelManager } from './level-manager.js';
import { GameEngine, REGION_COLORS } from './game.js';
import { ScoringSystem } from './scoring.js';
import { StorageManager } from './storage.js';
import { AudioManager } from './audio.js';
import { PuzzleGenerator } from './generator.js';
import { RULE_TYPES } from './rules.js';

export class AppController {
  constructor() {
    this.storage = StorageManager.load();
    this.audio = new AudioManager(this.storage.settings.soundEnabled);
    this.scoring = new ScoringSystem();
    this.levelManager = new LevelManager();
    this.game = null;

    this.activeScreen = 'menu'; // 'menu' | 'game' | 'levels'
    this.currentLevel = null;
    this.activeHint = null;

    this.confettiCanvas = null;
    this.confettiCtx = null;
    this.confettiParticles = [];
    this.confettiAnimId = null;

    this.errorToastTimeout = null;
  }

  async init() {
    // Apply initial settings
    this.applySettings(this.storage.settings);

    // Initialize LevelManager
    await this.levelManager.init();

    // Initialize Game Engine
    this.game = new GameEngine({
      audio: this.audio,
      onStateChange: (state) => this.handleGameStateChange(state),
      onCompletion: (result) => this.handleGameCompletion(result),
      onInvalidPlacement: (detail) => this.handleInvalidPlacement(detail),
      onGameOver: (detail) => this.handleGameOver(detail)
    });

    this.setupDOMReferences();
    this.bindEvents();
    this.setupConfetti();

    // Check if there is an in-progress game to resume
    this.updateMenuQuickStats();

    // If URL has level param, load it directly
    const urlParams = new URLSearchParams(window.location.search);
    const requestedLevel = urlParams.get('level');
    if (requestedLevel) {
      this.startLevel(requestedLevel);
    } else {
      this.showScreen('menu');
      // Show How-to-Play dialogue popup on page load / refresh unless user chose to hide it
      const hideStartup = localStorage.getItem('purrfect_hide_welcome_popup') === 'true';
      if (!hideStartup) {
        this.openModal(this.modalHowToPlay);
      }
    }
  }

  setupDOMReferences() {
    // Screens
    this.screenMenu = document.getElementById('screen-menu');
    this.screenGame = document.getElementById('screen-game');
    this.screenLevels = document.getElementById('screen-levels');

    // Menu elements
    this.btnMenuContinue = document.getElementById('btn-menu-continue');
    this.btnMenuPlay = document.getElementById('btn-menu-play');
    this.btnMenuLevels = document.getElementById('btn-menu-levels');
    this.btnMenuGenerator = document.getElementById('btn-menu-generator');
    this.btnMenuHowToPlay = document.getElementById('btn-menu-how-to-play');
    this.btnMenuSettings = document.getElementById('btn-menu-settings');
    this.menuTotalScore = document.getElementById('menu-total-score');
    this.menuCompletedCount = document.getElementById('menu-completed-count');

    // Game HUD
    this.hudLevelTitle = document.getElementById('hud-level-title');
    this.hudLevelDiff = document.getElementById('hud-level-difficulty');
    this.hudCatCount = document.getElementById('hud-cat-count');
    this.hudLives = document.getElementById('hud-lives');
    this.hudTimer = document.getElementById('hud-timer');
    this.hudScore = document.getElementById('hud-score');
    this.boardGrid = document.getElementById('puzzle-grid');
    this.rowHeaders = document.getElementById('row-headers');
    this.colHeaders = document.getElementById('col-headers');

    // Game Controls
    this.btnGameBack = document.getElementById('btn-game-back');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.btnModeCat = document.getElementById('btn-mode-cat');
    this.btnModeMark = document.getElementById('btn-mode-mark');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnHint = document.getElementById('btn-hint');

    // Error Feedback Toast
    this.feedbackToast = document.getElementById('feedback-toast');

    // Hint Banner
    this.hintBanner = document.getElementById('hint-banner');
    this.hintTitle = document.getElementById('hint-title');
    this.hintText = document.getElementById('hint-text');
    this.btnHintAutoPlace = document.getElementById('btn-hint-auto-place');
    this.btnHintDismiss = document.getElementById('btn-hint-dismiss');

    // Modals
    this.modalWin = document.getElementById('modal-win');
    this.modalGameOver = document.getElementById('modal-game-over');
    this.modalHowToPlay = document.getElementById('modal-how-to-play');
    this.modalGenerator = document.getElementById('modal-generator');
    this.modalSettings = document.getElementById('modal-settings');
    this.modalConfirm = document.getElementById('modal-confirm');

    // Level select list
    this.levelGridContainer = document.getElementById('level-grid');
    this.levelFilterTabs = document.getElementById('level-filter-tabs');

    // Confetti canvas
    this.confettiCanvas = document.getElementById('confetti-canvas');
    if (this.confettiCanvas) {
      this.confettiCtx = this.confettiCanvas.getContext('2d');
    }
  }

  bindEvents() {
    // Menu navigation
    this.btnMenuPlay.addEventListener('click', () => {
      // Find lowest uncompleted level or level 1
      const uncompleted = this.levelManager.levels.find(
        lvl => !this.storage.completedLevels.includes(String(lvl.levelId))
      );
      const targetId = uncompleted ? uncompleted.levelId : 1;
      this.startLevel(targetId);
    });  

    this.btnMenuContinue.addEventListener('click', () => {
      if (this.storage.savedProgress) {
        this.startLevel(this.storage.savedProgress.levelId, this.storage.savedProgress);
      } else {
        this.startLevel(1);
      }
    });

    this.btnMenuLevels.addEventListener('click', () => {
      this.showScreen('levels');
      this.renderLevelSelect('All');
    });

    this.btnMenuGenerator.addEventListener('click', () => {
      this.openModal(this.modalGenerator);
    });

    this.btnMenuHowToPlay.addEventListener('click', () => {
      this.openModal(this.modalHowToPlay);
    });

    const chkDontShow = document.getElementById('chk-dont-show-startup');
    if (chkDontShow) {
      chkDontShow.checked = localStorage.getItem('purrfect_hide_welcome_popup') === 'true';
      chkDontShow.addEventListener('change', () => {
        if (chkDontShow.checked) {
          localStorage.setItem('purrfect_hide_welcome_popup', 'true');
        } else {
          localStorage.removeItem('purrfect_hide_welcome_popup');
        }
      });
    }

    const btnHowToPlayPlay = document.getElementById('btn-how-to-play-play');
    if (btnHowToPlayPlay) {
      btnHowToPlayPlay.addEventListener('click', () => {
        if (chkDontShow && chkDontShow.checked) {
          localStorage.setItem('purrfect_hide_welcome_popup', 'true');
        }
        this.closeModal(this.modalHowToPlay);
        this.btnMenuPlay.click();
      });
    }

    this.btnMenuSettings.addEventListener('click', () => {
      this.openModal(this.modalSettings);
    });

    // Game screen buttons
    this.btnGameBack.addEventListener('click', () => {
      this.saveCurrentInProgress();
      this.game.pauseTimer();
      this.showScreen('menu');
    });

    this.btnSoundToggle.addEventListener('click', () => {
      const enabled = !this.audio.soundEnabled;
      this.audio.setSoundEnabled(enabled);
      this.storage.settings.soundEnabled = enabled;
      StorageManager.save(this.storage);
      this.updateSoundButtonUI();
    });

    this.btnModeCat.addEventListener('click', () => {
      this.game.interactionMode = 'cat';
      this.btnModeCat.classList.add('active');
      this.btnModeMark.classList.remove('active');
    });

    this.btnModeMark.addEventListener('click', () => {
      this.game.interactionMode = 'mark';
      this.btnModeMark.classList.add('active');
      this.btnModeCat.classList.remove('active');
    });

    this.btnUndo.addEventListener('click', () => {
      this.game.undo();
      this.dismissHint();
    });

    this.btnRestart.addEventListener('click', () => {
      this.showConfirmDialog(
        'Restart Level?',
        'Clear all placed cats and reset the timer for this puzzle?',
        () => {
          this.game.restart();
          this.dismissHint();
          StorageManager.clearInProgress();
        }
      );
    });

    this.btnHint.addEventListener('click', () => {
      this.triggerHint();
    });

    this.btnHintAutoPlace.addEventListener('click', () => {
      if (this.activeHint) {
        this.game.applyHintPlacement(this.activeHint);
        this.dismissHint();
      }
    });

    this.btnHintDismiss.addEventListener('click', () => {
      this.dismissHint();
    });

    // Level select screen buttons
    document.getElementById('btn-levels-back').addEventListener('click', () => {
      this.showScreen('menu');
    });

    this.levelFilterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      this.levelFilterTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.renderLevelSelect(btn.getAttribute('data-filter'));
    });

    // Modals close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) this.closeModal(modal);
      });
    });

    // Win Modal action buttons
    document.getElementById('btn-win-next').addEventListener('click', () => {
      this.closeModal(this.modalWin);
      this.stopConfetti();
      const next = this.levelManager.getNextLevel(this.currentLevel.levelId);
      if (next) {
        this.startLevel(next.levelId);
      } else {
        this.showScreen('levels');
        this.renderLevelSelect('All');
      }
    });

    document.getElementById('btn-win-replay').addEventListener('click', () => {
      this.closeModal(this.modalWin);
      this.stopConfetti();
      this.startLevel(this.currentLevel.levelId);
    });

    document.getElementById('btn-win-levels').addEventListener('click', () => {
      this.closeModal(this.modalWin);
      this.stopConfetti();
      this.showScreen('levels');
      this.renderLevelSelect('All');
    });

    // Game Over Modal action buttons
    document.getElementById('btn-game-over-retry').addEventListener('click', () => {
      this.closeModal(this.modalGameOver);
      this.game.restart();
    });

    document.getElementById('btn-game-over-levels').addEventListener('click', () => {
      this.closeModal(this.modalGameOver);
      this.showScreen('levels');
      this.renderLevelSelect('All');
    });

    // Generator Form
    document.getElementById('btn-generate-submit').addEventListener('click', () => {
      const sizeInput = parseInt(document.getElementById('gen-size-select').value, 10);
      const seedInput = document.getElementById('gen-seed-input').value.trim();
      const btn = document.getElementById('btn-generate-submit');
      const originalText = btn.innerHTML;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Generating...';

      setTimeout(() => {
        try {
          const generated = PuzzleGenerator.generatePuzzle({
            gridSize: sizeInput,
            seed: seedInput || null,
            fallbackLevels: this.levelManager.levels
          });

          this.closeModal(this.modalGenerator);
          this.levelManager.setCustomLevel(generated);
          this.startLevel(generated.levelId, null, generated);
        } catch (err) {
          alert('Could not generate puzzle: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      }, 50);
    });

    // Settings
    const chkHighContrast = document.getElementById('setting-high-contrast');
    const chkSound = document.getElementById('setting-sound');
    const chkReducedMotion = document.getElementById('setting-reduced-motion');
    const btnResetProgress = document.getElementById('btn-reset-progress');

    chkHighContrast.checked = Boolean(this.storage.settings.highContrast);
    chkSound.checked = Boolean(this.storage.settings.soundEnabled);
    chkReducedMotion.checked = Boolean(this.storage.settings.reducedMotion);

    chkHighContrast.addEventListener('change', () => {
      this.storage.settings.highContrast = chkHighContrast.checked;
      StorageManager.save(this.storage);
      this.applySettings(this.storage.settings);
      if (this.currentLevel) this.renderBoardGrid();
    });

    chkSound.addEventListener('change', () => {
      this.storage.settings.soundEnabled = chkSound.checked;
      this.audio.setSoundEnabled(chkSound.checked);
      StorageManager.save(this.storage);
      this.updateSoundButtonUI();
    });

    chkReducedMotion.addEventListener('change', () => {
      this.storage.settings.reducedMotion = chkReducedMotion.checked;
      StorageManager.save(this.storage);
      this.applySettings(this.storage.settings);
    });

    btnResetProgress.addEventListener('click', () => {
      this.showConfirmDialog(
        'Reset All Progress?',
        'This will erase all completed levels, high scores, and saved games! This cannot be undone.',
        () => {
          this.storage = StorageManager.resetAllProgress();
          this.updateMenuQuickStats();
          this.closeModal(this.modalSettings);
          this.showScreen('menu');
        }
      );
    });

    // Global keyboard navigation
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Window resize handler for confetti
    window.addEventListener('resize', () => {
      if (this.confettiCanvas) {
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;
      }
    });
  }

  showScreen(screenName) {
    this.activeScreen = screenName;
    this.screenMenu.classList.toggle('active', screenName === 'menu');
    this.screenGame.classList.toggle('active', screenName === 'game');
    this.screenLevels.classList.toggle('active', screenName === 'levels');

    if (screenName === 'menu') {
      this.updateMenuQuickStats();
    }
  }

  updateMenuQuickStats() {
    this.storage = StorageManager.load();
    const hasSaved = this.storage.savedProgress && this.storage.savedProgress.cats.length > 0;
    this.btnMenuContinue.style.display = hasSaved ? 'inline-flex' : 'none';

    this.menuTotalScore.textContent = this.storage.totalScore.toLocaleString();
    this.menuCompletedCount.textContent = `${this.storage.completedLevels.length} / ${this.levelManager.levels.length}`;
    this.updateSoundButtonUI();
  }

  updateSoundButtonUI() {
    const isMuted = !this.audio.soundEnabled;
    this.btnSoundToggle.setAttribute('aria-label', isMuted ? 'Unmute Sound' : 'Mute Sound');
    this.btnSoundToggle.innerHTML = isMuted
      ? '<span class="icon">🔇</span>'
      : '<span class="icon">🔊</span>';
  }

  applySettings(settings) {
    document.body.classList.toggle('high-contrast', Boolean(settings.highContrast));
    document.body.classList.toggle('reduced-motion', Boolean(settings.reducedMotion));
  }

  startLevel(levelId, savedProgress = null, customLevelData = null) {
    const level = customLevelData || this.levelManager.getLevel(levelId);
    if (!level) {
      alert(`Level ${levelId} could not be found.`);
      return;
    }

    this.currentLevel = level;
    this.activeHint = null;
    this.dismissHint();

    // Check saved progress from storage if not explicitly provided
    if (!savedProgress && this.storage.savedProgress && String(this.storage.savedProgress.levelId) === String(level.levelId)) {
      savedProgress = this.storage.savedProgress;
    }

    this.hudLevelTitle.textContent = level.name || `Level ${level.levelId}`;
    this.hudLevelDiff.textContent = level.difficulty;
    this.hudLevelDiff.className = `badge badge-${level.difficulty.toLowerCase()}`;

    this.game.loadLevel(level, savedProgress);
    this.renderBoardGrid();
    this.showScreen('game');
  }

  renderBoardGrid() {
    const n = this.game.gridSize;
    const regions = this.currentLevel.regions;

    // Set CSS grid column count
    this.boardGrid.style.setProperty('--grid-dim', n);
    this.boardGrid.innerHTML = '';
    this.rowHeaders.innerHTML = '';
    this.colHeaders.innerHTML = '';

    // Region color assignment map
    const uniqueRegions = Array.from(new Set(regions.flat()));
    const regionColorMap = new Map();
    uniqueRegions.forEach((regId, idx) => {
      regionColorMap.set(String(regId), REGION_COLORS[idx % REGION_COLORS.length]);
    });

    // Create column headers (top)
    for (let c = 0; c < n; c++) {
      const colHead = document.createElement('div');
      colHead.className = 'grid-header col-header';
      colHead.id = `col-head-${c}`;
      colHead.textContent = String(c + 1);
      this.colHeaders.appendChild(colHead);
    }

    // Create row headers (left)
    for (let r = 0; r < n; r++) {
      const rowHead = document.createElement('div');
      rowHead.className = 'grid-header row-header';
      rowHead.id = `row-head-${r}`;
      rowHead.textContent = String(r + 1);
      this.rowHeaders.appendChild(rowHead);
    }

    // Create cells
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = document.createElement('button');
        cell.className = 'puzzle-cell';
        cell.id = `cell-${r}-${c}`;
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        cell.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);

        const regId = String(regions[r][c]);
        const color = regionColorMap.get(regId);
        cell.style.setProperty('--cell-bg', color.bg);
        cell.style.setProperty('--cell-border', color.border);

        // Region boundary detection for bold borders
        if (r === 0 || String(regions[r - 1][c]) !== regId) cell.classList.add('border-top');
        if (r === n - 1 || String(regions[r + 1][c]) !== regId) cell.classList.add('border-bottom');
        if (c === 0 || String(regions[r][c - 1]) !== regId) cell.classList.add('border-left');
        if (c === n - 1 || String(regions[r][c + 1]) !== regId) cell.classList.add('border-right');

        // Region label watermark (especially helpful for colorblindness and high contrast)
        const watermark = document.createElement('span');
        watermark.className = 'region-watermark';
        watermark.textContent = regId;
        cell.appendChild(watermark);

        // Content wrapper for cat icon or cross
        const content = document.createElement('span');
        content.className = 'cell-content';
        cell.appendChild(content);

        // Click debouncing to prevent accidental conflicts between single-click (cross) and double-click (cat)
        let clickTimeout = null;
        let clickCount = 0;

        cell.addEventListener('click', (e) => {
          e.preventDefault();
          clickCount++;

          if (clickCount === 1) {
            clickTimeout = setTimeout(() => {
              // Single-click confirmed: mark or unmark cross (✕)
              clickCount = 0;
              clickTimeout = null;
              this.game.handleSingleClick(r, c);
              this.dismissHint();
            }, 240);
          } else if (clickCount >= 2) {
            // Double-click confirmed: cancel single-click and identify cat
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              clickTimeout = null;
            }
            clickCount = 0;
            const res = this.game.handleDoubleClick(r, c);
            if (res && res.action === 'ALREADY_VALIDATED_WRONG') {
              this.showToast('⚠️ This cell was already validated as incorrect.');
            } else if (res && res.action === 'ALREADY_IDENTIFIED') {
              this.showToast('🐾 Cat already identified here!');
            }
            this.dismissHint();
          }
        });

        cell.addEventListener('dblclick', (e) => {
          e.preventDefault();
          if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
          }
          clickCount = 0;
          const res = this.game.handleDoubleClick(r, c);
          if (res && res.action === 'ALREADY_VALIDATED_WRONG') {
            this.showToast('⚠️ This cell was already validated as incorrect.');
          } else if (res && res.action === 'ALREADY_IDENTIFIED') {
            this.showToast('🐾 Cat already identified here!');
          }
          this.dismissHint();
        });

        // Secondary right-click / contextmenu handler
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.game.handleSingleClick(r, c);
        });

        this.boardGrid.appendChild(cell);
      }
    }

    this.syncBoardDisplay();
  }

  syncBoardDisplay() {
    const n = this.game.gridSize;
    const placedSet = new Map();
    this.game.placedCats.forEach(cat => placedSet.set(`${cat.row},${cat.col}`, cat));

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = document.getElementById(`cell-${r}-${c}`);
        if (!cell) continue;

        const content = cell.querySelector('.cell-content');
        const key = `${r},${c}`;
        const hasCat = placedSet.has(key);
        const hasCross = this.game.markedCrosses.has(key);
        const hasWrongMark = this.game.wrongMarks && this.game.wrongMarks.has(key);
        const isFocused = this.game.focusedRow === r && this.game.focusedCol === c;

        cell.classList.toggle('has-cat', hasCat);
        cell.classList.toggle('has-cross', hasCross);
        cell.classList.toggle('has-wrong-mark', Boolean(hasWrongMark));
        cell.classList.toggle('is-focused', isFocused);

        if (hasCat) {
          content.innerHTML = this.getCatSvg();
        } else if (hasWrongMark) {
          content.innerHTML = '<span class="wrong-red-x" title="Wrong Place!">✕</span>';
        } else if (hasCross) {
          content.innerHTML = '<span class="mark-cross">✕</span>';
        } else {
          content.innerHTML = '';
        }
      }
    }

    // Update HUD Lives (3 lives per level)
    if (this.hudLives) {
      let heartsHtml = '';
      const maxL = this.game.maxLives || 3;
      const currL = typeof this.game.lives === 'number' ? this.game.lives : maxL;
      for (let i = 1; i <= maxL; i++) {
        const isAlive = i <= currL;
        heartsHtml += `<span class="heart-icon ${isAlive ? 'active' : 'lost'}">${isAlive ? '❤️' : '🖤'}</span>`;
      }
      this.hudLives.innerHTML = heartsHtml;
      this.hudLives.setAttribute('aria-label', `${currL} of ${maxL} lives remaining`);
    }

    // Update HUD counters
    this.hudCatCount.textContent = `🐾 ${this.game.placedCats.length} / ${n}`;
    this.btnUndo.disabled = !this.game.history.length || this.game.isCompleted || this.game.isGameOver;

    this.saveCurrentInProgress();
  }

  getCatSvg() {
    return `
      <svg class="cat-svg" viewBox="0 0 100 100" aria-hidden="true">
        <!-- Ears -->
        <polygon points="20,42 12,14 42,26" fill="#f97316"/>
        <polygon points="22,38 16,20 38,27" fill="#fed7aa"/>
        <polygon points="80,42 88,14 58,26" fill="#f97316"/>
        <polygon points="78,38 84,20 62,27" fill="#fed7aa"/>
        <!-- Face -->
        <ellipse cx="50" cy="56" rx="36" ry="32" fill="#ea580c"/>
        <ellipse cx="50" cy="56" rx="34" ry="30" fill="#f97316"/>
        <!-- Cute Eyes -->
        <ellipse cx="37" cy="52" rx="4.5" ry="6" fill="#1e293b"/>
        <ellipse cx="63" cy="52" rx="4.5" ry="6" fill="#1e293b"/>
        <circle cx="38" cy="50" r="1.8" fill="#ffffff"/>
        <circle cx="64" cy="50" r="1.8" fill="#ffffff"/>
        <!-- Nose and Mouth -->
        <polygon points="50,62 46,58 54,58" fill="#fda4af"/>
        <path d="M46,64 Q50,68 54,64" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Whiskers -->
        <line x1="24" y1="58" x2="6" y2="54" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
        <line x1="24" y1="64" x2="8" y2="66" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
        <line x1="76" y1="58" x2="94" y2="54" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
        <line x1="76" y1="64" x2="92" y2="66" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  handleGameStateChange(state) {
    if (state.type === 'TIMER_TICK') {
      this.hudTimer.textContent = ScoringSystem.formatTime(state.elapsedSeconds);
      return;
    }

    this.syncBoardDisplay();

    // Update row/col header completed classes
    if (state.analysis) {
      const n = this.game.gridSize;
      for (let r = 0; r < n; r++) {
        const head = document.getElementById(`row-head-${r}`);
        if (head) head.classList.toggle('completed', state.analysis.completedRows.has(r));
      }
      for (let c = 0; c < n; c++) {
        const head = document.getElementById(`col-head-${c}`);
        if (head) head.classList.toggle('completed', state.analysis.completedCols.has(c));
      }
    }
  }

  handleInvalidPlacement(detail) {
    const { row, col, ruleViolated, message, conflictingCats, livesRemaining } = detail;

    // Shake and highlight clicked cell with prominent red mark
    const targetCell = document.getElementById(`cell-${row}-${col}`);
    if (targetCell) {
      targetCell.classList.add('cell-invalid-shake', 'has-wrong-mark');
      setTimeout(() => targetCell.classList.remove('cell-invalid-shake'), 600);
    }

    // Highlight conflicting cats if any
    if (conflictingCats && conflictingCats.length > 0) {
      conflictingCats.forEach(cat => {
        const conflictEl = document.getElementById(`cell-${cat.row}-${cat.col}`);
        if (conflictEl) {
          conflictEl.classList.add('cell-conflict-pulse');
          setTimeout(() => conflictEl.classList.remove('cell-conflict-pulse'), 1200);
        }
      });
    }

    // Rule icon mapping
    let icon = '❌';
    if (ruleViolated === RULE_TYPES.ROW) icon = '↔️';
    else if (ruleViolated === RULE_TYPES.COLUMN) icon = '↕️';
    else if (ruleViolated === RULE_TYPES.REGION) icon = '🎨';
    else if (ruleViolated === RULE_TYPES.TOUCH) icon = '🐾';

    const livesText = typeof livesRemaining === 'number'
      ? (livesRemaining > 0 ? ` (❤️ ${livesRemaining} lives left)` : ` (0 ❤️ left - Game Over!)`)
      : '';
    this.showToast(`${icon} ${message}${livesText}`);
  }

  handleGameOver(detail) {
    this.dismissHint();
    this.openModal(this.modalGameOver);
  }

  showToast(message) {
    if (this.errorToastTimeout) {
      clearTimeout(this.errorToastTimeout);
    }
    this.feedbackToast.textContent = message;
    this.feedbackToast.classList.add('visible');

    this.errorToastTimeout = setTimeout(() => {
      this.feedbackToast.classList.remove('visible');
    }, 3200);
  }

  triggerHint() {
    const hint = this.game.requestHint();
    if (!hint) return;

    this.activeHint = hint;
    this.hintTitle.textContent = hint.title;
    this.hintText.textContent = hint.message;
    this.btnHintAutoPlace.style.display = hint.autoPlacable ? 'inline-block' : 'none';
    this.hintBanner.classList.add('visible');

    // Remove any previous hint highlights
    document.querySelectorAll('.cell-hint-highlight').forEach(el => el.classList.remove('cell-hint-highlight'));

    if (hint.cell) {
      const el = document.getElementById(`cell-${hint.cell.row}-${hint.cell.col}`);
      if (el) {
        el.classList.add('cell-hint-highlight');
      }
    }
  }

  dismissHint() {
    this.activeHint = null;
    this.hintBanner.classList.remove('visible');
    document.querySelectorAll('.cell-hint-highlight').forEach(el => el.classList.remove('cell-hint-highlight'));
  }

  handleGameCompletion(result) {
    const { level, timeElapsed, hintsUsed, mistakesCount } = result;

    // Prevent double scoring on multiple completion fires
    const sessionKey = `${level.levelId}-${Date.now()}`;
    const scoreResult = this.scoring.calculateScore(level, timeElapsed, hintsUsed, mistakesCount);

    // Save completion to storage
    const nextLevel = this.levelManager.getNextLevel(level.levelId);
    const nextId = nextLevel ? nextLevel.levelId : null;
    StorageManager.recordCompletion(
      level.levelId,
      scoreResult.finalScore,
      scoreResult.stars,
      timeElapsed,
      nextId
    );

    // Populate Win Modal
    document.getElementById('win-level-name').textContent = level.name || `Level ${level.levelId}`;
    document.getElementById('win-time').textContent = ScoringSystem.formatTime(timeElapsed);
    document.getElementById('win-par-time').textContent = ScoringSystem.formatTime(scoreResult.parTime);
    document.getElementById('win-score-total').textContent = scoreResult.finalScore.toLocaleString();
    document.getElementById('win-base-score').textContent = `+${scoreResult.baseScore}`;
    document.getElementById('win-time-bonus').textContent = `+${scoreResult.timeBonus}`;
    document.getElementById('win-no-hint-bonus').textContent = `+${scoreResult.noHintBonus}`;
    document.getElementById('win-deductions').textContent = `-${scoreResult.hintDeduction + scoreResult.mistakeDeduction}`;

    // Stars display
    const starContainer = document.getElementById('win-stars');
    starContainer.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      const star = document.createElement('span');
      star.className = `star-icon ${i <= scoreResult.stars ? 'earned' : 'empty'}`;
      star.textContent = '★';
      starContainer.appendChild(star);
    }

    // Show/hide Next button if at end of predefined levels
    document.getElementById('btn-win-next').style.display = nextLevel ? 'inline-flex' : 'none';

    this.openModal(this.modalWin);
    this.startConfetti();
  }

  renderLevelSelect(filter = 'All') {
    this.storage = StorageManager.load();
    const summary = this.levelManager.getLevelsSummary(
      this.storage.unlockedLevels,
      this.storage.completedLevels,
      this.storage.levelScores
    );

    const filtered = filter === 'All'
      ? summary
      : summary.filter(l => l.difficulty.toLowerCase() === filter.toLowerCase());

    this.levelGridContainer.innerHTML = '';

    filtered.forEach(lvl => {
      const card = document.createElement('div');
      card.className = `level-card ${lvl.isUnlocked ? 'unlocked' : 'locked'} ${lvl.isCompleted ? 'completed' : ''}`;

      let starsHtml = '';
      for (let s = 1; s <= 3; s++) {
        starsHtml += `<span class="card-star ${s <= lvl.stars ? 'active' : ''}">★</span>`;
      }

      card.innerHTML = `
        <div class="card-header">
          <span class="level-num">Level ${lvl.levelId}</span>
          <span class="badge badge-${lvl.difficulty.toLowerCase()}">${lvl.difficulty}</span>
        </div>
        <div class="card-title">${lvl.name}</div>
        <div class="card-meta">
          <span>Grid: ${lvl.gridSize}×${lvl.gridSize}</span>
          <span>Par: ${ScoringSystem.formatTime(lvl.parTime)}</span>
        </div>
        <div class="card-footer">
          <div class="card-stars">${starsHtml}</div>
          <span class="card-status">${lvl.isCompleted ? 'Completed' : (lvl.isUnlocked ? 'Play' : '🔒 Locked')}</span>
        </div>
      `;

      if (lvl.isUnlocked) {
        card.addEventListener('click', () => {
          this.startLevel(lvl.levelId);
        });
      }

      this.levelGridContainer.appendChild(card);
    });
  }

  saveCurrentInProgress() {
    if (this.game && !this.game.isCompleted && !this.game.isGameOver && this.currentLevel && !this.currentLevel.isGenerated) {
      if (this.game.placedCats.length > 0 || this.game.lives < this.game.maxLives) {
        StorageManager.saveInProgress(
          this.currentLevel.levelId,
          this.game.placedCats,
          this.game.elapsedSeconds,
          this.game.hintsUsed,
          this.game.lives
        );
      }
    }
  }

  openModal(modal) {
    if (modal) {
      modal.classList.add('visible');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  closeModal(modal) {
    if (modal) {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  showConfirmDialog(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const btnOk = document.getElementById('btn-confirm-yes');
    const newBtn = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtn, btnOk);

    newBtn.addEventListener('click', () => {
      this.closeModal(this.modalConfirm);
      onConfirm();
    });

    this.openModal(this.modalConfirm);
  }

  handleKeyDown(e) {
    // If inside modal, Escape closes it
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal-overlay.visible');
      openModals.forEach(m => this.closeModal(m));
      return;
    }

    if (this.activeScreen !== 'game' || this.game.isCompleted) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        this.game.moveFocus(-1, 0);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        this.game.moveFocus(1, 0);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        this.game.moveFocus(0, -1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        this.game.moveFocus(0, 1);
        break;
      case 'Enter':
      case 'c':
      case 'C':
        e.preventDefault();
        this.game.handleDoubleClick(this.game.focusedRow, this.game.focusedCol);
        break;
      case ' ':
      case 'x':
      case 'X':
      case 'm':
      case 'M':
        e.preventDefault();
        this.game.handleSingleClick(this.game.focusedRow, this.game.focusedCol);
        break;
      case 'u':
      case 'U':
        e.preventDefault();
        this.game.undo();
        break;
      case 'h':
      case 'H':
        e.preventDefault();
        this.triggerHint();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        this.btnRestart.click();
        break;
    }
  }

  // Confetti Particle System
  setupConfetti() {
    if (!this.confettiCanvas) return;
    this.confettiCanvas.width = window.innerWidth;
    this.confettiCanvas.height = window.innerHeight;
  }

  startConfetti() {
    if (!this.confettiCanvas || !this.confettiCtx) return;
    if (this.storage.settings.reducedMotion) return;

    this.confettiParticles = [];
    const colors = ['#f97316', '#38bdf8', '#4ade80', '#f472b6', '#a855f7', '#facc15'];

    for (let i = 0; i < 120; i++) {
      this.confettiParticles.push({
        x: Math.random() * this.confettiCanvas.width,
        y: Math.random() * this.confettiCanvas.height - this.confettiCanvas.height,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: (Math.random() - 0.5) * 4,
        speedY: Math.random() * 4 + 3,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 6
      });
    }

    const animate = () => {
      this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);

      this.confettiParticles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotSpeed;

        if (p.y > this.confettiCanvas.height) {
          p.y = -10;
          p.x = Math.random() * this.confettiCanvas.width;
        }

        this.confettiCtx.save();
        this.confettiCtx.translate(p.x, p.y);
        this.confettiCtx.rotate((p.rotation * Math.PI) / 180);
        this.confettiCtx.fillStyle = p.color;
        this.confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        this.confettiCtx.restore();
      });

      this.confettiAnimId = requestAnimationFrame(animate);
    };

    if (this.confettiAnimId) cancelAnimationFrame(this.confettiAnimId);
    animate();
  }

  stopConfetti() {
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
      this.confettiAnimId = null;
    }
    if (this.confettiCtx && this.confettiCanvas) {
      this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
    }
  }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  window.__catApp = app;
  app.init().catch(err => console.error('App init failed:', err));
});
