/**
 * Cat Puzzle - Core Game Rules Module
 * Enforces the four mandatory game rules:
 * Rule 1: One Cat Per Row
 * Rule 2: One Cat Per Column
 * Rule 3: One Cat Per Color Region
 * Rule 4: Cats Cannot Touch (horizontally, vertically, or diagonally)
 */

export const RULE_TYPES = {
  ROW: 'RULE_ROW',
  COLUMN: 'RULE_COLUMN',
  REGION: 'RULE_REGION',
  TOUCH: 'RULE_TOUCH'
};

export const RULE_DESCRIPTIONS = {
  [RULE_TYPES.ROW]: 'Only one cat allowed per horizontal row.',
  [RULE_TYPES.COLUMN]: 'Only one cat allowed per vertical column.',
  [RULE_TYPES.REGION]: 'Only one cat allowed per color region territory.',
  [RULE_TYPES.TOUCH]: 'Cats cannot touch each other, even diagonally!'
};

/**
 * Checks whether two cells touch each other (horizontal, vertical, or diagonal).
 * By definition, (r1, c1) and (r2, c2) touch if |r1 - r2| <= 1 && |c1 - c2| <= 1.
 *
 * @param {number} r1 Row of first cell
 * @param {number} c1 Col of first cell
 * @param {number} r2 Row of second cell
 * @param {number} c2 Col of second cell
 * @returns {boolean} True if the two cells touch
 */
export function doCellsTouch(r1, c1, r2, c2) {
  if (r1 === r2 && c1 === c2) return false;
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}

/**
 * Validates whether a cat can be placed at (row, col) given current cat placements and region layout.
 *
 * @param {number} row Target row (0-indexed)
 * @param {number} col Target column (0-indexed)
 * @param {Array<Array<string|number>>} regions 2D N x N matrix of region identifiers
 * @param {Array<{row: number, col: number}>} currentCats Array of currently placed cat coordinates
 * @param {number} gridSize Board dimension N
 * @returns {{
 *   valid: boolean,
 *   ruleViolated: string|null,
 *   message: string,
 *   conflictingCats: Array<{row: number, col: number}>
 * }} Validation result
 */
export function validatePlacement(row, col, regions, currentCats = [], gridSize) {
  const n = gridSize || regions.length;

  // Boundary check
  if (row < 0 || row >= n || col < 0 || col >= n) {
    return {
      valid: false,
      ruleViolated: null,
      message: 'Placement is outside board boundaries.',
      conflictingCats: []
    };
  }

  // Check if cell already contains a cat
  const alreadyThere = currentCats.find(cat => cat.row === row && cat.col === col);
  if (alreadyThere) {
    return {
      valid: false,
      ruleViolated: null,
      message: 'A cat is already occupying this cell.',
      conflictingCats: [alreadyThere]
    };
  }

  const targetRegion = regions[row][col];

  // 1. Rule 1: One Cat Per Row
  const rowConflict = currentCats.filter(cat => cat.row === row);
  if (rowConflict.length > 0) {
    return {
      valid: false,
      ruleViolated: RULE_TYPES.ROW,
      message: `Row ${row + 1} already has a cat! Only one cat is allowed per row.`,
      conflictingCats: rowConflict
    };
  }

  // 2. Rule 2: One Cat Per Column
  const colConflict = currentCats.filter(cat => cat.col === col);
  if (colConflict.length > 0) {
    return {
      valid: false,
      ruleViolated: RULE_TYPES.COLUMN,
      message: `Column ${col + 1} already has a cat! Only one cat is allowed per column.`,
      conflictingCats: colConflict
    };
  }

  // 3. Rule 3: One Cat Per Color Region
  const regionConflict = currentCats.filter(cat => regions[cat.row][cat.col] === targetRegion);
  if (regionConflict.length > 0) {
    return {
      valid: false,
      ruleViolated: RULE_TYPES.REGION,
      message: `Region "${targetRegion}" already has a cat! Only one cat is allowed per territory.`,
      conflictingCats: regionConflict
    };
  }

  // 4. Rule 4: Cats Cannot Touch (Orthogonal & Diagonal)
  const touchConflicts = currentCats.filter(cat => doCellsTouch(row, col, cat.row, cat.col));
  if (touchConflicts.length > 0) {
    return {
      valid: false,
      ruleViolated: RULE_TYPES.TOUCH,
      message: 'Cats cannot touch each other! Keep at least one space between cats (including diagonals).',
      conflictingCats: touchConflicts
    };
  }

  return {
    valid: true,
    ruleViolated: null,
    message: 'Placement is valid!',
    conflictingCats: []
  };
}

/**
 * Checks if the entire board puzzle is successfully completed.
 * Condition: exactly gridSize cats placed, with 1 per row, 1 per col, 1 per region, none touching.
 *
 * @param {Array<{row: number, col: number}>} currentCats
 * @param {Array<Array<string|number>>} regions
 * @param {number} gridSize
 * @returns {boolean} True if puzzle is completely and validly solved
 */
export function isPuzzleComplete(currentCats, regions, gridSize) {
  const n = gridSize || regions.length;
  if (currentCats.length !== n) return false;

  const rows = new Set();
  const cols = new Set();
  const regSet = new Set();

  for (let i = 0; i < currentCats.length; i++) {
    const { row, col } = currentCats[i];
    if (row < 0 || row >= n || col < 0 || col >= n) return false;

    // Duplicate row
    if (rows.has(row)) return false;
    rows.add(row);

    // Duplicate col
    if (cols.has(col)) return false;
    cols.add(col);

    // Duplicate region
    const reg = regions[row][col];
    if (regSet.has(reg)) return false;
    regSet.add(reg);

    // Check no-touch against all other cats
    for (let j = i + 1; j < currentCats.length; j++) {
      const other = currentCats[j];
      if (doCellsTouch(row, col, other.row, other.col)) {
        return false;
      }
    }
  }

  return rows.size === n && cols.size === n && regSet.size === n;
}

/**
 * Inspects all rows, columns, and regions to provide status info (e.g. for HUD indicators).
 *
 * @param {Array<{row: number, col: number}>} currentCats
 * @param {Array<Array<string|number>>} regions
 * @param {number} gridSize
 * @returns {{
 *   completedRows: Set<number>,
 *   completedCols: Set<number>,
 *   completedRegions: Set<string|number>,
 *   touchingPairs: Array<[{row: number, col: number}, {row: number, col: number}]>
 * }}
 */
export function getBoardAnalysis(currentCats, regions, gridSize) {
  const n = gridSize || regions.length;
  const rowCounts = new Array(n).fill(0);
  const colCounts = new Array(n).fill(0);
  const regionCounts = new Map();

  for (const cat of currentCats) {
    rowCounts[cat.row] = (rowCounts[cat.row] || 0) + 1;
    colCounts[cat.col] = (colCounts[cat.col] || 0) + 1;
    const rId = regions[cat.row][cat.col];
    regionCounts.set(rId, (regionCounts.get(rId) || 0) + 1);
  }

  const completedRows = new Set();
  const completedCols = new Set();
  const completedRegions = new Set();

  for (let r = 0; r < n; r++) {
    if (rowCounts[r] === 1) completedRows.add(r);
  }
  for (let c = 0; c < n; c++) {
    if (colCounts[c] === 1) completedCols.add(c);
  }
  for (const [rId, count] of regionCounts.entries()) {
    if (count === 1) completedRegions.add(rId);
  }

  const touchingPairs = [];
  for (let i = 0; i < currentCats.length; i++) {
    for (let j = i + 1; j < currentCats.length; j++) {
      if (doCellsTouch(currentCats[i].row, currentCats[i].col, currentCats[j].row, currentCats[j].col)) {
        touchingPairs.push([currentCats[i], currentCats[j]]);
      }
    }
  }

  return {
    completedRows,
    completedCols,
    completedRegions,
    touchingPairs
  };
}

/**
 * Checks if a color region's cells form an orthogonally connected component.
 *
 * @param {Array<{row: number, col: number}>} cells
 * @returns {boolean}
 */
export function isRegionConnected(cells) {
  if (!cells || cells.length === 0) return false;
  const set = new Set(cells.map(c => `${c.row},${c.col}`));
  const start = cells[0];
  const visited = new Set([`${start.row},${start.col}`]);
  const queue = [start];

  while (queue.length > 0) {
    const { row, col } = queue.shift();
    const neighbors = [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 }
    ];
    for (const nb of neighbors) {
      const key = `${nb.row},${nb.col}`;
      if (set.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(nb);
      }
    }
  }

  return visited.size === cells.length;
}
