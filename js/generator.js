/**
 * Cat Puzzle - Automatic Puzzle Generator
 * Generates verified, uniquely solvable N x N cat placement puzzles.
 * Workflow:
 * 1. Generate candidate cat arrangement satisfying row, col, and no-touch.
 * 2. Grow connected color regions seeded at each cat.
 * 3. Iteratively refine region boundaries to eliminate alternative solutions.
 * 4. Verify uniqueness with PuzzleSolver (count === 1).
 * 5. Fallback gracefully to validated predefined puzzles if retry limit is reached.
 */

import { PuzzleSolver } from './solver.js';
import { isRegionConnected } from './rules.js';

export const REGION_CHARS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

/**
 * Seedable PRNG (Mulberry32) for reproducible puzzle generation.
 */
export class SeededRandom {
  constructor(seed) {
    if (typeof seed === 'number') {
      this.seed = seed >>> 0;
    } else if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
      }
      this.seed = hash >>> 0;
    } else {
      this.seed = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
    }
  }

  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  choice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(this.next() * array.length)];
  }
}

export class PuzzleGenerator {
  /**
   * Generates a valid arrangement of N cats on an N x N board (1 per row, 1 per col, none touching).
   *
   * @param {number} n Grid size
   * @param {SeededRandom} rng
   * @returns {number[]|null} Array of col indices for each row 0..n-1
   */
  static generateCandidateCats(n, rng) {
    function backtrack(r, currentCols) {
      if (r === n) {
        return currentCols;
      }
      const candidates = [];
      const lastCol = r > 0 ? currentCols[r - 1] : -1;
      for (let c = 0; c < n; c++) {
        if (!currentCols.includes(c) && (r === 0 || Math.abs(c - lastCol) > 1)) {
          candidates.push(c);
        }
      }
      rng.shuffle(candidates);
      for (const c of candidates) {
        const res = backtrack(r + 1, [...currentCols, c]);
        if (res !== null) return res;
      }
      return null;
    }

    return backtrack(0, []);
  }

  /**
   * Initializes connected regions by seeding each cat with its own region and expanding.
   *
   * @param {number} n
   * @param {number[]} cats Column position for each row
   * @param {SeededRandom} rng
   * @returns {number[][]}
   */
  static growInitialRegions(n, cats, rng) {
    const grid = Array.from({ length: n }, () => new Array(n).fill(-1));
    for (let r = 0; r < n; r++) {
      grid[r][cats[r]] = r;
    }

    let unassigned = n * n - n;
    while (unassigned > 0) {
      const candidates = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (grid[r][c] === -1) {
            const adj = [];
            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of dirs) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] !== -1) {
                adj.push(grid[nr][nc]);
              }
            }
            if (adj.length > 0) {
              candidates.push({ r, c, adj });
            }
          }
        }
      }

      if (candidates.length === 0) break;
      rng.shuffle(candidates);
      const pick = candidates[0];
      grid[pick.r][pick.c] = rng.choice(pick.adj);
      unassigned--;
    }

    return grid;
  }

  /**
   * Eliminates alternative solutions by targeting boundary cells and reassigning them.
   *
   * @param {number} n
   * @param {number[][]} grid
   * @param {number[]} cats
   * @param {SeededRandom} rng
   * @param {number} maxSteps
   * @returns {number[][]|null}
   */
  static refineToUnique(n, grid, cats, rng, maxSteps = 400) {
    const targetSolutionSet = new Set(cats.map((c, r) => `${r},${c}`));

    function getRegionCells() {
      const regs = Array.from({ length: n }, () => []);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          regs[grid[r][c]].push({ row: r, col: c });
        }
      }
      return regs;
    }

    for (let step = 0; step < maxSteps; step++) {
      const { count, solutions } = PuzzleSolver.countSolutions(grid, n, 2);
      if (count === 1) {
        return grid;
      }
      if (count === 0) {
        return null;
      }

      // Identify alternative solution
      const sol0Key = solutions[0].map(([r, c]) => `${r},${c}`).sort().join(';');
      const targetKey = cats.map((c, r) => `${r},${c}`).sort().join(';');
      const alt = (sol0Key === targetKey && solutions.length > 1) ? solutions[1] : solutions[0];

      // Cells in alt that are not in target
      const diffCells = alt.filter(([r, c]) => !targetSolutionSet.has(`${r},${c}`));
      rng.shuffle(diffCells);

      let reassigned = false;
      const regCells = getRegionCells();

      for (const [r, c] of diffCells) {
        const currReg = grid[r][c];
        const remainingCells = regCells[currReg].filter(pt => !(pt.row === r && pt.col === c));
        if (!isRegionConnected(remainingCells)) continue;

        // Adjacent regions
        const adjRegs = new Set();
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
            adjRegs.add(grid[nr][nc]);
          }
        }
        adjRegs.delete(currReg);

        // Find adjacent region that alt uses elsewhere
        const targetRegs = Array.from(adjRegs).filter(reg =>
          alt.some(([ar, ac]) => (ar !== r || ac !== c) && grid[ar][ac] === reg)
        );

        const choices = targetRegs.length > 0 ? targetRegs : Array.from(adjRegs);
        if (choices.length > 0) {
          grid[r][c] = rng.choice(choices);
          reassigned = true;
          break;
        }
      }

      if (!reassigned) {
        // Random boundary perturbation
        const borderCells = [];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (targetSolutionSet.has(`${r},${c}`)) continue;
            const currReg = grid[r][c];
            const remaining = regCells[currReg].filter(pt => !(pt.row === r && pt.col === c));
            if (isRegionConnected(remaining)) {
              const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
              for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] !== currReg) {
                  borderCells.push({ r, c, newReg: grid[nr][nc] });
                }
              }
            }
          }
        }
        if (borderCells.length > 0) {
          const pick = rng.choice(borderCells);
          grid[pick.r][pick.c] = pick.newReg;
        }
      }
    }

    return null;
  }

  /**
   * Evaluates puzzle difficulty based on grid size and region irregularities.
   *
   * @param {number} n Grid size
   * @param {string[][]} regions
   * @returns {'Beginner'|'Easy'|'Medium'|'Hard'|'Expert'|'Master'}
   */
  static evaluateDifficulty(n, regions) {
    if (n <= 4) return 'Beginner';
    if (n === 5) return 'Easy';
    if (n === 6) return 'Easy';
    if (n === 7) return 'Medium';
    if (n === 8) return 'Hard';
    if (n === 9) return 'Expert';
    return 'Master';
  }

  /**
   * Generates a complete, verified, uniquely solvable puzzle.
   *
   * @param {object} options
   * @param {number} [options.gridSize=6] Grid size (4 to 10)
   * @param {string|number} [options.seed] Optional seed for reproducible generation
   * @param {number} [options.maxAttempts=25] Max retry attempts before fallback
   * @param {Array<object>} [options.fallbackLevels] Fallback list of predefined puzzles
   * @returns {object} Formatted puzzle object
   */
  static generatePuzzle({ gridSize = 6, seed = null, maxAttempts = 25, fallbackLevels = [] } = {}) {
    const n = Math.min(10, Math.max(4, gridSize));
    const rng = new SeededRandom(seed);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const cats = this.generateCandidateCats(n, rng);
      if (!cats) continue;

      const initialGrid = this.growInitialRegions(n, cats, rng);
      const refinedGrid = this.refineToUnique(n, initialGrid, cats, rng, 400);

      if (refinedGrid) {
        // Verify all regions are connected
        const regionCells = Array.from({ length: n }, () => []);
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            regionCells[refinedGrid[r][c]].push({ row: r, col: c });
          }
        }
        if (!regionCells.every(cells => isRegionConnected(cells))) {
          continue;
        }

        // Final uniqueness check with PuzzleSolver
        const uniqueness = PuzzleSolver.checkUniqueness(refinedGrid, n);
        if (!uniqueness.isUnique) {
          continue;
        }

        // Convert to character labels
        const regions = refinedGrid.map(row => row.map(regIdx => REGION_CHARS[regIdx]));
        const solution = cats.map((col, row) => [row, col]);
        const difficulty = this.evaluateDifficulty(n, regions);

        return {
          levelId: `gen-${Date.now()}-${rng.nextInt(100, 999)}`,
          name: `Custom Map ${n}x${n}`,
          gridSize: n,
          difficulty,
          parTime: n * 25,
          story: `A procedurally generated ${n}x${n} territory waiting to be claimed!`,
          regions,
          solution,
          isGenerated: true,
          seed: rng.seed
        };
      }
    }

    // Graceful fallback to matching predefined level
    if (fallbackLevels && fallbackLevels.length > 0) {
      const match = fallbackLevels.find(lvl => lvl.gridSize === n) || fallbackLevels[0];
      return {
        ...match,
        isFallback: true
      };
    }

    throw new Error(`Failed to generate a valid ${n}x${n} puzzle within ${maxAttempts} attempts.`);
  }
}
