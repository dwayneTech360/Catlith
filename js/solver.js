/**
 * Cat Puzzle - Backtracking Puzzle Solver
 * Solves N x N cat placement puzzles enforcing:
 * 1. Exactly one cat per row
 * 2. Exactly one cat per column
 * 3. Exactly one cat per region
 * 4. No two cats touching (horizontal, vertical, diagonal)
 */

import { doCellsTouch } from './rules.js';

export class PuzzleSolver {
  /**
   * Normalizes region grid: converts letter identifiers or strings to numeric indices 0..N-1.
   *
   * @param {Array<Array<string|number>>} regions
   * @returns {{ numericGrid: number[][], regionMap: string[], n: number }}
   */
  static normalizeRegions(regions) {
    const n = regions.length;
    const regionMap = [];
    const regionToIndex = new Map();

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const id = String(regions[r][c]);
        if (!regionToIndex.has(id)) {
          regionToIndex.set(id, regionMap.length);
          regionMap.push(id);
        }
      }
    }

    const numericGrid = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        row.push(regionToIndex.get(String(regions[r][c])));
      }
      numericGrid.push(row);
    }

    return { numericGrid, regionMap, n };
  }

  /**
   * Validates a candidate solution against all 4 game rules.
   *
   * @param {Array<Array<string|number>>} regions
   * @param {Array<[number, number]>|Array<{row: number, col: number}>} solution
   * @param {number} [gridSize]
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validateSolution(regions, solution, gridSize) {
    const n = gridSize || regions.length;
    const errors = [];

    if (!solution || solution.length !== n) {
      errors.push(`Expected exactly ${n} cats, got ${solution ? solution.length : 0}.`);
      return { valid: false, errors };
    }

    const cats = solution.map(item => Array.isArray(item) ? { row: item[0], col: item[1] } : item);
    const rows = new Set();
    const cols = new Set();
    const regSet = new Set();

    for (let i = 0; i < cats.length; i++) {
      const { row, col } = cats[i];
      if (row < 0 || row >= n || col < 0 || col >= n) {
        errors.push(`Cat out of bounds at (${row}, ${col}).`);
        continue;
      }

      if (rows.has(row)) errors.push(`Duplicate cat in row ${row + 1}.`);
      rows.add(row);

      if (cols.has(col)) errors.push(`Duplicate cat in column ${col + 1}.`);
      cols.add(col);

      const reg = regions[row][col];
      if (regSet.has(reg)) errors.push(`Duplicate cat in region "${reg}".`);
      regSet.add(reg);

      for (let j = i + 1; j < cats.length; j++) {
        const other = cats[j];
        if (doCellsTouch(row, col, other.row, other.col)) {
          errors.push(`Cats at (${row}, ${col}) and (${other.row}, ${other.col}) are touching!`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Finds the first valid solution for an N x N puzzle.
   *
   * @param {Array<Array<string|number>>} regions
   * @param {number} [gridSize]
   * @param {object} [options]
   * @returns {Array<[number, number]>|null} Array of [row, col] or null if unsolvable
   */
  static solve(regions, gridSize, options = {}) {
    const { numericGrid, n } = this.normalizeRegions(regions);
    const maxSteps = options.maxSteps || 300000;
    let steps = 0;

    const colUsed = new Uint8Array(n);
    const regionUsed = new Uint8Array(n);
    const solution = new Int32Array(n).fill(-1);

    function search(r, lastCol) {
      if (r === n) {
        return true;
      }
      if (++steps > maxSteps) {
        return false;
      }

      // Find candidates for row r
      for (let c = 0; c < n; c++) {
        if (colUsed[c]) continue;
        if (lastCol !== -1 && Math.abs(c - lastCol) <= 1) continue;

        const reg = numericGrid[r][c];
        if (regionUsed[reg]) continue;

        colUsed[c] = 1;
        regionUsed[reg] = 1;
        solution[r] = c;

        if (search(r + 1, c)) {
          return true;
        }

        colUsed[c] = 0;
        regionUsed[reg] = 0;
        solution[r] = -1;
      }

      return false;
    }

    if (search(0, -1)) {
      const result = [];
      for (let r = 0; r < n; r++) {
        result.push([r, solution[r]]);
      }
      return result;
    }

    return null;
  }

  /**
   * Counts the number of valid solutions up to maxCount.
   * Stops early when maxCount is reached.
   *
   * @param {Array<Array<string|number>>} regions
   * @param {number} [gridSize]
   * @param {number} [maxCount=2]
   * @param {object} [options]
   * @returns {{ count: number, solutions: Array<Array<[number, number]>>, timedOut: boolean }}
   */
  static countSolutions(regions, gridSize, maxCount = 2, options = {}) {
    const { numericGrid, n } = this.normalizeRegions(regions);
    const maxSteps = options.maxSteps || 300000;
    let steps = 0;
    let timedOut = false;

    const colUsed = new Uint8Array(n);
    const regionUsed = new Uint8Array(n);
    const solution = new Int32Array(n).fill(-1);
    const solutions = [];

    function search(r, lastCol) {
      if (r === n) {
        const found = [];
        for (let i = 0; i < n; i++) {
          found.push([i, solution[i]]);
        }
        solutions.push(found);
        return solutions.length >= maxCount;
      }

      if (++steps > maxSteps) {
        timedOut = true;
        return true; // abort
      }

      for (let c = 0; c < n; c++) {
        if (colUsed[c]) continue;
        if (lastCol !== -1 && Math.abs(c - lastCol) <= 1) continue;

        const reg = numericGrid[r][c];
        if (regionUsed[reg]) continue;

        colUsed[c] = 1;
        regionUsed[reg] = 1;
        solution[r] = c;

        const stop = search(r + 1, c);

        colUsed[c] = 0;
        regionUsed[reg] = 0;
        solution[r] = -1;

        if (stop) return true;
      }

      return false;
    }

    search(0, -1);

    return {
      count: solutions.length,
      solutions,
      timedOut
    };
  }

  /**
   * Validates whether a puzzle is uniquely solvable (count === 1).
   *
   * @param {Array<Array<string|number>>} regions
   * @param {number} [gridSize]
   * @returns {{ isUnique: boolean, solutionCount: number, solution: Array<[number, number]>|null }}
   */
  static checkUniqueness(regions, gridSize) {
    const res = this.countSolutions(regions, gridSize, 2);
    return {
      isUnique: res.count === 1 && !res.timedOut,
      solutionCount: res.count,
      solution: res.count >= 1 ? res.solutions[0] : null
    };
  }
}
