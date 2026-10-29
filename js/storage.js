/**
 * Cat Puzzle - Storage Manager
 * Handles versioned browser localStorage persistence for game progress,
 * scores, unlocked levels, settings, and in-progress puzzle states.
 */

const STORAGE_KEY = 'purrfect_grid_save_v1';
const CURRENT_VERSION = 1;

const DEFAULT_SAVE_DATA = {
  version: CURRENT_VERSION,
  currentLevelId: 1,
  unlockedLevels: [1],
  completedLevels: [],
  levelScores: {}, // { [levelId]: { bestScore: number, stars: number, bestTime: number, completedCount: number } }
  totalScore: 0,
  settings: {
    soundEnabled: true,
    highContrast: false,
    showTimer: true,
    reducedMotion: false
  },
  savedProgress: null // { levelId, cats: [{row, col}], elapsedSeconds, hintsUsed }
};

export class StorageManager {
  /**
   * Retrieves full saved state, migrating and validating if needed.
   *
   * @returns {object} Validated save data
   */
  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this._cloneDefaults();
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return this._cloneDefaults();
      }

      // Version migration handler if future versions added
      return this._migrateAndSanitize(parsed);
    } catch (err) {
      console.warn('StorageManager: Failed to parse localStorage data, using defaults.', err);
      return this._cloneDefaults();
    }
  }

  /**
   * Saves the state to localStorage.
   *
   * @param {object} data
   * @returns {boolean} Success status
   */
  static save(data) {
    try {
      data.version = CURRENT_VERSION;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('StorageManager: Error writing to localStorage', err);
      return false;
    }
  }

  /**
   * Records a level completion.
   *
   * @param {number|string} levelId
   * @param {number} score
   * @param {number} stars (1 to 3)
   * @param {number} timeElapsed (seconds)
   * @param {number|string} [nextLevelId]
   * @returns {object} Updated stats
   */
  static recordCompletion(levelId, score, stars, timeElapsed, nextLevelId) {
    const data = this.load();
    const idStr = String(levelId);

    // Completed list
    if (!data.completedLevels.includes(idStr)) {
      data.completedLevels.push(idStr);
    }

    // Unlock next level
    if (nextLevelId !== undefined && nextLevelId !== null) {
      const nextIdStr = String(nextLevelId);
      if (!data.unlockedLevels.includes(nextIdStr)) {
        data.unlockedLevels.push(nextIdStr);
      }
    }

    // Level score record
    const existing = data.levelScores[idStr] || {
      bestScore: 0,
      stars: 0,
      bestTime: 999999,
      completedCount: 0
    };

    const isNewBestScore = score > existing.bestScore;
    const scoreDiff = isNewBestScore ? score - existing.bestScore : 0;
    data.totalScore += scoreDiff;

    data.levelScores[idStr] = {
      bestScore: Math.max(existing.bestScore, score),
      stars: Math.max(existing.stars, stars),
      bestTime: Math.min(existing.bestTime, timeElapsed),
      completedCount: existing.completedCount + 1,
      lastCompletedAt: Date.now()
    };

    // Clear saved progress for this level
    if (data.savedProgress && String(data.savedProgress.levelId) === idStr) {
      data.savedProgress = null;
    }

    this.save(data);
    return {
      totalScore: data.totalScore,
      levelRecord: data.levelScores[idStr],
      isNewBestScore
    };
  }

  /**
   * Saves unfinished puzzle state so refreshing does not lose work.
   *
   * @param {number|string} levelId
   * @param {Array<{row: number, col: number}>} cats
   * @param {number} elapsedSeconds
   * @param {number} hintsUsed
   * @param {number} [lives=3]
   */
  static saveInProgress(levelId, cats, elapsedSeconds, hintsUsed, lives = 3) {
    const data = this.load();
    data.savedProgress = {
      levelId: String(levelId),
      cats,
      elapsedSeconds,
      hintsUsed,
      lives,
      timestamp: Date.now()
    };
    this.save(data);
  }

  /**
   * Clears any active in-progress puzzle save.
   */
  static clearInProgress() {
    const data = this.load();
    data.savedProgress = null;
    this.save(data);
  }

  /**
   * Updates game settings.
   *
   * @param {Partial<typeof DEFAULT_SAVE_DATA.settings>} partialSettings
   * @returns {object} Updated settings
   */
  static updateSettings(partialSettings) {
    const data = this.load();
    data.settings = { ...data.settings, ...partialSettings };
    this.save(data);
    return data.settings;
  }

  /**
   * Resets all player progress to fresh state.
   */
  static resetAllProgress() {
    const defaults = this._cloneDefaults();
    this.save(defaults);
    return defaults;
  }

  static _cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  }

  static _migrateAndSanitize(data) {
    const safe = this._cloneDefaults();

    if (Array.isArray(data.unlockedLevels)) {
      safe.unlockedLevels = data.unlockedLevels.map(String);
    }
    if (!safe.unlockedLevels.includes('1')) {
      safe.unlockedLevels.push('1');
    }

    if (Array.isArray(data.completedLevels)) {
      safe.completedLevels = data.completedLevels.map(String);
    }

    if (data.levelScores && typeof data.levelScores === 'object') {
      safe.levelScores = data.levelScores;
    }

    if (typeof data.totalScore === 'number' && !isNaN(data.totalScore)) {
      safe.totalScore = Math.max(0, data.totalScore);
    }

    if (data.settings && typeof data.settings === 'object') {
      safe.settings = { ...safe.settings, ...data.settings };
    }

    if (data.savedProgress && typeof data.savedProgress === 'object') {
      safe.savedProgress = data.savedProgress;
    }

    return safe;
  }
}
