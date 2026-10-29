/**
 * Cat Puzzle - Scoring System
 * Calculates level scores, time bonuses, hint penalties, and star ratings.
 * Protects against duplicate scoring on completion events.
 */

export const SCORING_CONFIG = {
  basePerGridSize: 200,      // Base points per cell dimension (e.g. 10x10 = 2000 base)
  baseCompletionPoints: 500, // Fixed completion baseline
  noHintBonus: 300,          // Perfect play without hints
  hintPenalty: 60,           // Deduction per hint requested
  mistakePenalty: 15,        // Small deduction per invalid placement attempt
  timeBonusMultiplier: 5,    // Points per second under par time
  minScoreFloorFraction: 0.3 // Score cannot drop below 30% of base
};

export class ScoringSystem {
  constructor(config = {}) {
    this.config = { ...SCORING_CONFIG, ...config };
    this._completedLevelsThisSession = new Set();
  }

  /**
   * Calculates score breakdown for a completed puzzle.
   *
   * @param {object} level
   * @param {number} timeElapsed in seconds
   * @param {number} hintsCount
   * @param {number} mistakesCount
   * @returns {{
   *   baseScore: number,
   *   timeBonus: number,
   *   noHintBonus: number,
   *   hintDeduction: number,
   *   mistakeDeduction: number,
   *   finalScore: number,
   *   stars: number,
   *   parTime: number,
   *   timeElapsed: number
   * }}
   */
  calculateScore(level, timeElapsed, hintsCount = 0, mistakesCount = 0) {
    const n = level.gridSize || 6;
    const parTime = level.parTime || n * 20;

    const baseScore = this.config.baseCompletionPoints + (n * this.config.basePerGridSize);

    // Time bonus for finishing under par time
    const secondsSaved = Math.max(0, parTime - Math.floor(timeElapsed));
    const timeBonus = secondsSaved * this.config.timeBonusMultiplier;

    // No-hint bonus
    const noHintBonus = hintsCount === 0 ? this.config.noHintBonus : 0;

    // Deductions
    const hintDeduction = hintsCount * this.config.hintPenalty;
    const mistakeDeduction = mistakesCount * this.config.mistakePenalty;

    // Raw score
    let finalScore = baseScore + timeBonus + noHintBonus - hintDeduction - mistakeDeduction;

    // Floor protection
    const floor = Math.floor(baseScore * this.config.minScoreFloorFraction);
    finalScore = Math.max(floor, Math.round(finalScore));

    // Star calculation
    let stars = 1;
    if (hintsCount === 0 && timeElapsed <= parTime * 1.1) {
      stars = 3;
    } else if (hintsCount <= 1 && timeElapsed <= parTime * 1.5) {
      stars = 2;
    }

    return {
      baseScore,
      timeBonus,
      noHintBonus,
      hintDeduction,
      mistakeDeduction,
      finalScore,
      stars,
      parTime,
      timeElapsed: Math.floor(timeElapsed)
    };
  }

  /**
   * Guards against double scoring for the same level completion instance.
   *
   * @param {string|number} levelSessionKey Unique identifier for this play attempt
   * @returns {boolean} True if scoring is permitted (first time), false if duplicate
   */
  claimScoringPermission(levelSessionKey) {
    if (this._completedLevelsThisSession.has(String(levelSessionKey))) {
      return false; // Already scored!
    }
    this._completedLevelsThisSession.add(String(levelSessionKey));
    return true;
  }

  /**
   * Formats seconds into MM:SS string.
   *
   * @param {number} totalSeconds
   * @returns {string}
   */
  static formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
