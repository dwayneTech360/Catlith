/**
 * Cat Puzzle - Core Game Engine
 * Manages grid rendering, cell interactions, undo history, timers,
 * keyboard accessibility, and visual feedback for rule validation.
 */

import {
  validatePlacement,
  isPuzzleComplete,
  getBoardAnalysis,
  RULE_TYPES
} from './rules.js';
import { HintSystem } from './hints.js';

// 12 distinct, high-contrast, accessible pastel colors for regions
export const REGION_COLORS = [
  { bg: '#fed7aa', border: '#ea580c', text: '#7c2d12', name: 'Peach' },     // Orange-100
  { bg: '#bae6fd', border: '#0284c7', text: '#075985', name: 'Sky Blue' },  // Sky-200
  { bg: '#bbf7d0', border: '#16a34a', text: '#14532d', name: 'Mint' },      // Green-200
  { bg: '#fbcfe8', border: '#db2777', text: '#831843', name: 'Rose' },      // Pink-200
  { bg: '#e9d5ff', border: '#9333ea', text: '#581c87', name: 'Lavender' },  // Purple-200
  { bg: '#fef08a', border: '#ca8a04', text: '#713f12', name: 'Lemon' },     // Yellow-200
  { bg: '#a7f3d0', border: '#059669', text: '#064e3b', name: 'Teal' },      // Emerald-200
  { bg: '#fecdd3', border: '#e11d48', text: '#881337', name: 'Coral' },     // Rose-200
  { bg: '#ddd6fe', border: '#7c3aed', text: '#4c1d95', name: 'Violet' },    // Violet-200
  { bg: '#fde68a', border: '#d97706', text: '#78350f', name: 'Amber' },     // Amber-200
  { bg: '#c7d2fe', border: '#4f46e5', text: '#312e81', name: 'Indigo' },    // Indigo-200
  { bg: '#d9f99d', border: '#65a30d', text: '#365314', name: 'Lime' }       // Lime-200
];

export class GameEngine {
  constructor(options = {}) {
    this.audio = options.audio || null;
    this.onStateChange = options.onStateChange || (() => {});
    this.onCompletion = options.onCompletion || (() => {});
    this.onInvalidPlacement = options.onInvalidPlacement || (() => {});
    this.onGameOver = options.onGameOver || (() => {});

    this.level = null;
    this.gridSize = 0;
    this.placedCats = [];      // Array of { row, col, timestamp }
    this.markedCrosses = new Set(); // Set of "row,col" for note-taking
    this.wrongMarks = new Set();    // Set of "row,col" with red mistake mark
    this.history = [];         // Undo stack of actions: { type: 'PLACE'|'REMOVE'|'MARK', ... }
    
    this.maxLives = 3;
    this.lives = 3;
    this.isGameOver = false;

    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.isTimerRunning = false;

    this.hintsUsed = 0;
    this.mistakesCount = 0;
    this.isCompleted = false;

    this.focusedRow = 0;
    this.focusedCol = 0;

    this.interactionMode = 'cat'; // 'cat' or 'mark'
  }

  /**
   * Initializes or loads a level.
   *
   * @param {object} levelData Level schema object
   * @param {object} [savedProgress] Optional stored resume state
   */
  loadLevel(levelData, savedProgress = null) {
    this.pauseTimer();
    this.level = levelData;
    this.gridSize = levelData.gridSize || levelData.regions.length;
    this.placedCats = [];
    this.markedCrosses = new Set();
    this.wrongMarks = new Set();
    this.history = [];
    this.elapsedSeconds = 0;
    this.hintsUsed = 0;
    this.mistakesCount = 0;
    this.isCompleted = false;
    this.isGameOver = false;
    this.maxLives = 3;
    this.lives = (savedProgress && typeof savedProgress.lives === 'number') ? savedProgress.lives : this.maxLives;
    this.focusedRow = 0;
    this.focusedCol = 0;

    // Restore saved progress if matching this level
    if (savedProgress && String(savedProgress.levelId) === String(levelData.levelId)) {
      if (Array.isArray(savedProgress.cats)) {
        this.placedCats = savedProgress.cats.map(c => ({ row: c.row, col: c.col }));
      }
      this.elapsedSeconds = savedProgress.elapsedSeconds || 0;
      this.hintsUsed = savedProgress.hintsUsed || 0;
    }

    this.startTimer();
    this.notifyState();
  }

  /**
   * Single-click on a grid cell:
   * Marks it with a cross (✕) indicating the player believes it does NOT contain a cat,
   * or unmarks if already crossed.
   * Prevents interaction if the cell already contains an identified cat or was already validated as wrong.
   *
   * @param {number} row
   * @param {number} col
   * @returns {{ success: boolean, action: string }}
   */
  handleSingleClick(row, col) {
    if (this.isCompleted || this.isGameOver) return { success: false, action: 'GAME_OVER' };

    this.focusedRow = row;
    this.focusedCol = col;
    const key = `${row},${col}`;

    // If cell already has an identified cat, ignore single click
    if (this.placedCats.some(c => c.row === row && c.col === col)) {
      return { success: false, action: 'ALREADY_IDENTIFIED' };
    }

    // If cell was already validated as wrong, do not alter it or deduct lives
    if (this.wrongMarks.has(key)) {
      return { success: false, action: 'ALREADY_VALIDATED_WRONG' };
    }

    // Toggle cross mark
    this.toggleCross(row, col);
    return { success: true, action: 'TOGGLED_CROSS' };
  }

  /**
   * Double-click on a grid cell:
   * Identifies or marks it as a cat.
   * If correct, marks as correctly identified cat.
   * If wrong, triggers Wrong Placement Validation (displays red mark, deducts 1 life).
   * Prevents identifying the same cat multiple times.
   * Prevents repeated clicks on an already validated cell from deducting additional lives.
   *
   * @param {number} row
   * @param {number} col
   * @returns {{ success: boolean, action: string, detail?: object }}
   */
  handleDoubleClick(row, col) {
    if (this.isCompleted || this.isGameOver) return { success: false, action: 'GAME_OVER' };

    this.focusedRow = row;
    this.focusedCol = col;
    const key = `${row},${col}`;

    // 1. Prevent player from identifying the same cat multiple times
    const alreadyIdentified = this.placedCats.some(c => c.row === row && c.col === col);
    if (alreadyIdentified) {
      return {
        success: false,
        action: 'ALREADY_IDENTIFIED',
        message: 'This cat has already been identified!'
      };
    }

    // 2. Prevent repeated clicks on an already validated cell from deducting additional lives
    if (this.wrongMarks.has(key)) {
      return {
        success: false,
        action: 'ALREADY_VALIDATED_WRONG',
        message: 'This cell was already validated as incorrect.'
      };
    }

    // 3. Validate and identify cat
    return this.placeCat(row, col);
  }

  /**
   * General cell click entry point (delegates based on interaction mode or default).
   *
   * @param {number} row
   * @param {number} col
   * @returns {{ success: boolean, action: string, detail?: object }}
   */
  handleCellClick(row, col) {
    if (this.interactionMode === 'cat') {
      return this.handleDoubleClick(row, col);
    }
    return this.handleSingleClick(row, col);
  }

  /**
   * Secondary action (e.g. right-click, long-press, or mark tool):
   * Toggles empty mark / cross on cell.
   *
   * @param {number} row
   * @param {number} col
   */
  handleCellSecondaryClick(row, col) {
    if (this.isCompleted) return;
    // Don't mark on top of an existing cat
    if (this.placedCats.some(c => c.row === row && c.col === col)) return;
    this.toggleCross(row, col);
  }

  /**
   * Places a cat at (row, col) after validating all 4 rules and verifying level solution.
   * If wrong placement, marks with red mark, loses 1 of 3 lives, and triggers game over if lives reach 0.
   *
   * @param {number} row
   * @param {number} col
   * @param {boolean} isAssisted True if placed via Hint system
   */
  placeCat(row, col, isAssisted = false) {
    if (this.isGameOver || this.isCompleted) return { success: false, action: 'GAME_OVER' };

    const key = `${row},${col}`;

    // Prevent duplicate identification of the same cat
    if (this.placedCats.some(c => c.row === row && c.col === col)) {
      return { success: false, action: 'ALREADY_IDENTIFIED' };
    }

    // Prevent repeated clicks on already validated wrong cell from deducting additional lives
    if (this.wrongMarks.has(key)) {
      return { success: false, action: 'ALREADY_VALIDATED_WRONG' };
    }

    // 1. Validate with core 4-rules engine
    const validation = validatePlacement(
      row,
      col,
      this.level.regions,
      this.placedCats,
      this.gridSize
    );

    // 2. Validate against level's unique solution
    const isInSolution = this.level.solution && this.level.solution.some(([r, c]) => r === row && c === col);
    const isWrong = !validation.valid || !isInSolution;

    if (isWrong) {
      this.mistakesCount++;
      this.lives = Math.max(0, this.lives - 1);
      this.wrongMarks.add(`${row},${col}`);

      const ruleViolated = !validation.valid ? validation.ruleViolated : 'RULE_NOT_IN_SOLUTION';
      const message = !validation.valid
        ? validation.message
        : `Wrong place! A cat does not belong at Row ${row + 1}, Column ${col + 1} in this territory.`;

      if (this.audio) {
        if (this.lives === 0) {
          this.audio.playGameOver();
        } else {
          this.audio.playInvalid();
        }
      }

      this.onInvalidPlacement({
        row,
        col,
        ruleViolated,
        message,
        conflictingCats: validation.conflictingCats || [],
        livesRemaining: this.lives
      });

      this.notifyState();

      if (this.lives <= 0) {
        this.isGameOver = true;
        this.pauseTimer();
        this.onGameOver({
          level: this.level,
          timeElapsed: this.elapsedSeconds,
          mistakesCount: this.mistakesCount
        });
      }

      return {
        success: false,
        action: 'WRONG_PLACEMENT',
        livesRemaining: this.lives,
        detail: {
          ...validation,
          ruleViolated,
          message
        }
      };
    }

    // Valid placement: clear any cross or wrong mark here
    const hadCross = this.markedCrosses.has(key);
    if (hadCross) {
      this.markedCrosses.delete(key);
    }
    this.wrongMarks.delete(key);

    // Record action for undo
    this.history.push({
      type: 'PLACE',
      cat: { row, col },
      hadCross,
      isAssisted
    });

    this.placedCats.push({ row, col, timestamp: Date.now() });
    if (this.audio) this.audio.playPlace();

    this.notifyState();
    this.checkCompletion();

    return {
      success: true,
      action: 'PLACED_CAT'
    };
  }

  /**
   * Removes a placed cat from the board.
   *
   * @param {number} row
   * @param {number} col
   */
  removeCat(row, col) {
    const idx = this.placedCats.findIndex(c => c.row === row && c.col === col);
    if (idx === -1) return;

    const removed = this.placedCats.splice(idx, 1)[0];
    this.history.push({
      type: 'REMOVE',
      cat: removed
    });

    if (this.audio) this.audio.playRemove();
    this.notifyState();
  }

  /**
   * Toggles a cross / empty mark on a cell.
   *
   * @param {number} row
   * @param {number} col
   */
  toggleCross(row, col) {
    const key = `${row},${col}`;
    const exists = this.markedCrosses.has(key);

    if (exists) {
      this.markedCrosses.delete(key);
      this.history.push({ type: 'UNMARK', row, col });
    } else {
      this.markedCrosses.add(key);
      this.history.push({ type: 'MARK', row, col });
    }

    if (this.audio) this.audio.playRemove();
    this.notifyState();
  }

  /**
   * Undoes the last player action.
   */
  undo() {
    if (this.history.length === 0 || this.isCompleted) return false;

    const last = this.history.pop();
    if (last.type === 'PLACE') {
      const idx = this.placedCats.findIndex(c => c.row === last.cat.row && c.col === last.cat.col);
      if (idx !== -1) {
        this.placedCats.splice(idx, 1);
      }
      if (last.hadCross) {
        this.markedCrosses.add(`${last.cat.row},${last.cat.col}`);
      }
    } else if (last.type === 'REMOVE') {
      this.placedCats.push(last.cat);
    } else if (last.type === 'MARK') {
      this.markedCrosses.delete(`${last.row},${last.col}`);
    } else if (last.type === 'UNMARK') {
      this.markedCrosses.add(`${last.row},${last.col}`);
    }

    if (this.audio) this.audio.playUndo();
    this.notifyState();
    return true;
  }

  /**
   * Restarts the current puzzle, clearing all placements and restoring 3 lives.
   */
  restart() {
    this.placedCats = [];
    this.markedCrosses = new Set();
    this.wrongMarks = new Set();
    this.history = [];
    this.isCompleted = false;
    this.isGameOver = false;
    this.lives = this.maxLives;
    this.hintsUsed = 0;
    this.mistakesCount = 0;
    this.elapsedSeconds = 0;
    this.startTimer();
    if (this.audio) this.audio.playUndo();
    this.notifyState();
  }

  /**
   * Requests a hint from the HintSystem.
   *
   * @returns {object} Hint info
   */
  requestHint() {
    if (this.isCompleted || !this.level) return null;

    this.hintsUsed++;
    if (this.audio) this.audio.playHint();

    const hint = HintSystem.getHint(
      this.placedCats,
      this.level.solution,
      this.level.regions,
      this.gridSize
    );

    this.notifyState();
    return hint;
  }

  /**
   * Executes assisted placement from a hint.
   *
   * @param {object} hint
   */
  applyHintPlacement(hint) {
    if (!hint || !hint.cell) return;
    if (hint.type === 'CORRECTION') {
      this.removeCat(hint.cell.row, hint.cell.col);
    } else if (hint.type === 'NEXT_PLACEMENT') {
      this.placeCat(hint.cell.row, hint.cell.col, true);
    }
  }

  /**
   * Checks if puzzle is fully and correctly solved.
   */
  checkCompletion() {
    if (this.isCompleted) return;

    if (isPuzzleComplete(this.placedCats, this.level.regions, this.gridSize)) {
      this.isCompleted = true;
      this.pauseTimer();
      if (this.audio) this.audio.playWin();

      this.onCompletion({
        level: this.level,
        timeElapsed: this.elapsedSeconds,
        hintsUsed: this.hintsUsed,
        mistakesCount: this.mistakesCount,
        placedCats: [...this.placedCats]
      });
    }
  }

  /**
   * Timer management
   */
  startTimer() {
    if (this.isTimerRunning) return;
    this.isTimerRunning = true;
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      this.notifyTimer();
    }, 1000);
  }

  pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isTimerRunning = false;
  }

  /**
   * Keyboard grid navigation (Accessibility)
   */
  moveFocus(dRow, dCol) {
    this.focusedRow = Math.max(0, Math.min(this.gridSize - 1, this.focusedRow + dRow));
    this.focusedCol = Math.max(0, Math.min(this.gridSize - 1, this.focusedCol + dCol));
    this.notifyState();
  }

  toggleCurrentFocus() {
    this.handleCellClick(this.focusedRow, this.focusedCol);
  }

  notifyState() {
    const analysis = getBoardAnalysis(this.placedCats, this.level ? this.level.regions : [], this.gridSize);
    this.onStateChange({
      placedCats: [...this.placedCats],
      markedCrosses: new Set(this.markedCrosses),
      wrongMarks: new Set(this.wrongMarks),
      lives: this.lives,
      maxLives: this.maxLives,
      isGameOver: this.isGameOver,
      hintsUsed: this.hintsUsed,
      mistakesCount: this.mistakesCount,
      elapsedSeconds: this.elapsedSeconds,
      isCompleted: this.isCompleted,
      canUndo: this.history.length > 0 && !this.isCompleted && !this.isGameOver,
      analysis,
      focusedRow: this.focusedRow,
      focusedCol: this.focusedCol,
      interactionMode: this.interactionMode
    });
  }

  notifyTimer() {
    this.onStateChange({
      type: 'TIMER_TICK',
      elapsedSeconds: this.elapsedSeconds
    });
  }
}
