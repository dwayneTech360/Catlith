/**
 * Cat Puzzle - Hint System
 * Provides smart, rule-preserving hints using the verified puzzle solution.
 * Explains logical deductions to help players learn puzzle-solving strategies.
 */

export class HintSystem {
  /**
   * Generates a targeted hint based on current board state and verified solution.
   *
   * @param {Array<{row: number, col: number}>} currentCats
   * @param {Array<[number, number]>} solution Array of [row, col]
   * @param {Array<Array<string|number>>} regions
   * @param {number} gridSize
   * @returns {{
   *   type: 'CORRECTION' | 'NEXT_PLACEMENT' | 'ALL_PLACED',
   *   cell: { row: number, col: number } | null,
   *   regionId: string | null,
   *   title: string,
   *   message: string,
   *   autoPlacable: boolean
   * }}
   */
  static getHint(currentCats, solution, regions, gridSize) {
    const n = gridSize || regions.length;
    const solutionSet = new Set(solution.map(([r, c]) => `${r},${c}`));
    const currentSet = new Set(currentCats.map(c => `${c.row},${c.col}`));

    // 1. Check if player has placed any cat that does not belong in the unique solution
    const incorrectCats = currentCats.filter(cat => !solutionSet.has(`${cat.row},${cat.col}`));

    if (incorrectCats.length > 0) {
      const wrong = incorrectCats[0];
      const regId = regions[wrong.row][wrong.col];
      return {
        type: 'CORRECTION',
        cell: { row: wrong.row, col: wrong.col },
        regionId: String(regId),
        title: 'Correction Needed',
        message: `The cat at Row ${wrong.row + 1}, Column ${wrong.col + 1} (in territory "${regId}") is leading to a dead end. Try clicking it to remove it.`,
        autoPlacable: false
      };
    }

    // 2. All current cats are correct! Find an unfilled solution cat
    const missingInSolution = solution.filter(([r, c]) => !currentSet.has(`${r},${c}`));

    if (missingInSolution.length === 0) {
      return {
        type: 'ALL_PLACED',
        cell: null,
        regionId: null,
        title: 'All Cats Placed!',
        message: 'All cats are already in their purrfect spots! Review the board to complete the puzzle.',
        autoPlacable: false
      };
    }

    // Pick candidate with best deduction explanation
    // Prioritize rows or regions with fewest open cells
    let bestPick = missingInSolution[0];
    let bestScore = -1;
    let bestExplanation = '';

    for (const [r, c] of missingInSolution) {
      const regId = regions[r][c];

      // Count empty cells in this row
      let emptyInRow = 0;
      for (let colIdx = 0; colIdx < n; colIdx++) {
        if (!currentCats.some(cat => cat.row === r && cat.col === colIdx)) {
          emptyInRow++;
        }
      }

      // Count empty cells in this region
      let emptyInRegion = 0;
      for (let rowIdx = 0; rowIdx < n; rowIdx++) {
        for (let colIdx = 0; colIdx < n; colIdx++) {
          if (regions[rowIdx][colIdx] === regId) {
            emptyInRegion++;
          }
        }
      }

      // Heuristic: smaller regions or rows make simpler deductions
      const priority = 100 - (emptyInRegion * 2 + emptyInRow);
      if (priority > bestScore) {
        bestScore = priority;
        bestPick = [r, c];
        bestExplanation = `Territory "${regId}" needs its guardian cat! Placing one at Row ${r + 1}, Column ${c + 1} safely satisfies Row ${r + 1} and Column ${c + 1} without touching any neighbors.`;
      }
    }

    const [targetRow, targetCol] = bestPick;
    const targetRegion = regions[targetRow][targetCol];

    return {
      type: 'NEXT_PLACEMENT',
      cell: { row: targetRow, col: targetCol },
      regionId: String(targetRegion),
      title: 'Helpful Paw Hint',
      message: bestExplanation,
      autoPlacable: true
    };
  }
}
