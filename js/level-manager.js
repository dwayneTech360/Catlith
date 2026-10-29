/**
 * Cat Puzzle - Level Manager
 * Manages level progression, loading predefined levels from JSON,
 * supporting procedurally generated levels, and tracking unlock states.
 */

import { PREDEFINED_LEVELS } from './levels-data.js';

export class LevelManager {
  constructor() {
    this.levels = [];
    this.currentLevel = null;
    this.isLoaded = false;
  }

  /**
   * Loads levels, attempting to fetch levels/levels.json, with graceful
   * fallback to PREDEFINED_LEVELS if running from a local file:// without an HTTP server.
   *
   * @returns {Promise<Array<object>>}
   */
  async init() {
    try {
      const response = await fetch('levels/levels.json');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          this.levels = data;
          this.isLoaded = true;
          return this.levels;
        }
      }
    } catch (err) {
      // Fetch might fail on file:// protocol or offline
      console.info('LevelManager: Falling back to bundled PREDEFINED_LEVELS (ES module import).');
    }

    this.levels = [...PREDEFINED_LEVELS];
    this.isLoaded = true;
    return this.levels;
  }

  /**
   * Retrieves level by levelId.
   *
   * @param {number|string} levelId
   * @returns {object|null}
   */
  getLevel(levelId) {
    const idStr = String(levelId);
    return this.levels.find(lvl => String(lvl.levelId) === idStr) || null;
  }

  /**
   * Returns the next sequential predefined level after currentLevelId.
   *
   * @param {number|string} currentLevelId
   * @returns {object|null}
   */
  getNextLevel(currentLevelId) {
    const idStr = String(currentLevelId);
    const idx = this.levels.findIndex(lvl => String(lvl.levelId) === idStr);
    if (idx >= 0 && idx < this.levels.length - 1) {
      return this.levels[idx + 1];
    }
    return null;
  }

  /**
   * Formats list of levels with their unlock, completion, and score status.
   *
   * @param {string[]} unlockedIds
   * @param {string[]} completedIds
   * @param {object} levelScores
   * @returns {Array<object>}
   */
  getLevelsSummary(unlockedIds = ['1'], completedIds = [], levelScores = {}) {
    const unlockedSet = new Set(unlockedIds.map(String));
    const completedSet = new Set(completedIds.map(String));

    return this.levels.map((lvl, index) => {
      const idStr = String(lvl.levelId);
      // Level 1 is always unlocked
      const isUnlocked = index === 0 || unlockedSet.has(idStr);
      const isCompleted = completedSet.has(idStr);
      const scoreData = levelScores[idStr] || null;

      return {
        ...lvl,
        isUnlocked,
        isCompleted,
        stars: scoreData ? scoreData.stars : 0,
        bestScore: scoreData ? scoreData.bestScore : 0,
        bestTime: scoreData ? scoreData.bestTime : null
      };
    });
  }

  /**
   * Injects a procedurally generated level into the active manager.
   *
   * @param {object} generatedLevel
   */
  setCustomLevel(generatedLevel) {
    this.currentLevel = generatedLevel;
  }
}
