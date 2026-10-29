/**
 * Cat Puzzle - Automated Test Suite
 * Validates:
 * 1. Rule 1: One Cat Per Row
 * 2. Rule 2: One Cat Per Column
 * 3. Rule 3: One Cat Per Color Region
 * 4. Rule 4: No touch horizontally, vertically, or diagonally
 * 5. Valid & invalid placement diagnostics
 * 6. PuzzleSolver (solve, count, uniqueness, unsolvable detection)
 * 7. Verification of all 24 predefined levels
 * 8. HintSystem logic
 * 9. ScoringSystem calculations & double-scoring prevention
 * 10. Generator functionality
 */

import {
  validatePlacement,
  isPuzzleComplete,
  doCellsTouch,
  isRegionConnected,
  RULE_TYPES
} from '../js/rules.js';
import { PuzzleSolver } from '../js/solver.js';
import { HintSystem } from '../js/hints.js';
import { ScoringSystem } from '../js/scoring.js';
import { PuzzleGenerator } from '../js/generator.js';
import { GameEngine } from '../js/game.js';
import { PREDEFINED_LEVELS } from '../js/levels-data.js';

export async function runAllTests(reporter = console.log) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function assert(condition, testName, details = '') {
    results.total++;
    if (condition) {
      results.passed++;
      reporter(`  ✓ ${testName}`);
    } else {
      results.failed++;
      const msg = `  ✗ ${testName} - ${details}`;
      results.failures.push(msg);
      reporter(msg);
    }
  }

  reporter('--- RUNNING Cat Puzzle TEST SUITE ---');

  // Test 1: doCellsTouch
  reporter('\nGroup 1: Cell Touch Detection');
  assert(doCellsTouch(1, 1, 1, 2) === true, 'Horizontal touch detected');
  assert(doCellsTouch(1, 1, 2, 1) === true, 'Vertical touch detected');
  assert(doCellsTouch(1, 1, 2, 2) === true, 'Diagonal touch SE detected');
  assert(doCellsTouch(1, 1, 0, 0) === true, 'Diagonal touch NW detected');
  assert(doCellsTouch(1, 1, 0, 2) === true, 'Diagonal touch NE detected');
  assert(doCellsTouch(1, 1, 2, 0) === true, 'Diagonal touch SW detected');
  assert(doCellsTouch(1, 1, 1, 3) === false, 'Horizontal distance 2 is not touching');
  assert(doCellsTouch(1, 1, 3, 1) === false, 'Vertical distance 2 is not touching');
  assert(doCellsTouch(1, 1, 3, 3) === false, 'Diagonal distance 2 is not touching');

  // Test 2: Rule 1 - Row Constraint
  reporter('\nGroup 2: Core Rule Enforcement');
  const valid4x4Regions = [
    ['C', 'A', 'B', 'B'],
    ['C', 'A', 'B', 'B'],
    ['C', 'C', 'D', 'B'],
    ['C', 'D', 'D', 'B']
  ];
  const catAt0_1 = [{ row: 0, col: 1 }];

  const rowViolation = validatePlacement(0, 3, valid4x4Regions, catAt0_1, 4);
  assert(rowViolation.valid === false, 'Rule 1: Rejects placement in occupied row');
  assert(rowViolation.ruleViolated === RULE_TYPES.ROW, 'Rule 1: Reports RULE_ROW');
  assert(rowViolation.conflictingCats.length === 1, 'Rule 1: Points to conflicting cat');

  // Test 3: Rule 2 - Column Constraint
  const colViolation = validatePlacement(3, 1, valid4x4Regions, catAt0_1, 4);
  assert(colViolation.valid === false, 'Rule 2: Rejects placement in occupied column');
  assert(colViolation.ruleViolated === RULE_TYPES.COLUMN, 'Rule 2: Reports RULE_COLUMN');

  // Test 4: Rule 3 - Region Constraint
  // (0, 0) and (2, 2) in this test board share region 'A' but differ in row, col, and are not touching
  const regionIsolationBoard = [
    ['A', 'B', 'B', 'B'],
    ['C', 'C', 'B', 'B'],
    ['D', 'D', 'A', 'E'],
    ['D', 'D', 'E', 'E']
  ];
  const catAt0_0 = [{ row: 0, col: 0 }];
  const regionViolation = validatePlacement(2, 2, regionIsolationBoard, catAt0_0, 4);
  assert(regionViolation.valid === false, 'Rule 3: Rejects placement in occupied region (A)');
  assert(regionViolation.ruleViolated === RULE_TYPES.REGION, 'Rule 3: Reports RULE_REGION');

  // Test 5: Rule 4 - Touch Constraint
  const touchDiagViolation = validatePlacement(1, 2, valid4x4Regions, catAt0_1, 4);
  assert(touchDiagViolation.valid === false, 'Rule 4: Rejects diagonally touching placement');
  assert(touchDiagViolation.ruleViolated === RULE_TYPES.TOUCH, 'Rule 4: Reports RULE_TOUCH');

  // Test 6: Valid Placement
  const validPlacement = validatePlacement(2, 0, valid4x4Regions, catAt0_1, 4);
  assert(validPlacement.valid === true, 'Valid placement is accepted');
  assert(validPlacement.ruleViolated === null, 'No rule violation reported for valid move');

  // Test 7: Puzzle Completion
  reporter('\nGroup 3: Puzzle Completion & Region Connectivity');
  const valid4x4Cats = [
    { row: 0, col: 1 },
    { row: 1, col: 3 },
    { row: 2, col: 0 },
    { row: 3, col: 2 }
  ];
  assert(isPuzzleComplete(valid4x4Cats, valid4x4Regions, 4) === true, 'Accurately recognizes completed 4x4 puzzle');

  const incompleteCats = valid4x4Cats.slice(0, 3);
  assert(isPuzzleComplete(incompleteCats, valid4x4Regions, 4) === false, 'Rejects incomplete puzzle (3/4 cats)');

  const connectedRegion = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }];
  assert(isRegionConnected(connectedRegion) === true, 'Recognizes connected L-tromino');

  const disconnectedRegion = [{ row: 0, col: 0 }, { row: 3, col: 3 }];
  assert(isRegionConnected(disconnectedRegion) === false, 'Rejects disconnected cells');

  // Test 8: Backtracking Solver
  reporter('\nGroup 4: Puzzle Solver');
  const solution = PuzzleSolver.solve(valid4x4Regions, 4);
  assert(solution !== null && solution.length === 4, 'Solver finds solution for 4x4 board');

  const { count } = PuzzleSolver.countSolutions(valid4x4Regions, 4, 2);
  assert(count === 1, 'Solver verifies exactly 1 unique solution for 4x4 board');

  // Unsolvable board: regions where region A only occupies row 0 col 0, and region B has no valid spots
  const unsolvableRegions = [
    ['A', 'A', 'A', 'A'],
    ['B', 'B', 'B', 'B'],
    ['C', 'C', 'C', 'C'],
    ['C', 'C', 'C', 'C'] // Only 3 distinct regions for 4x4! Impossible to place 4 cats
  ];
  const unsolvableRes = PuzzleSolver.solve(unsolvableRegions, 4);
  assert(unsolvableRes === null, 'Solver correctly returns null for unsolvable puzzle');

  // Test 9: Predefined Levels Validation
  reporter('\nGroup 5: Predefined Levels Integrity Check (All 24 Levels)');
  let allLevelsPass = true;
  for (const lvl of PREDEFINED_LEVELS) {
    const n = lvl.gridSize;
    // Check solution format
    assert(lvl.solution.length === n, `Level ${lvl.levelId} has ${n} solution cats`);

    // Verify solution satisfies rules
    const valResult = PuzzleSolver.validateSolution(lvl.regions, lvl.solution, n);
    if (!valResult.valid) {
      allLevelsPass = false;
      assert(false, `Level ${lvl.levelId} solution validity`, valResult.errors.join('; '));
    }

    // Verify uniqueness
    const uniqueness = PuzzleSolver.checkUniqueness(lvl.regions, n);
    if (!uniqueness.isUnique) {
      allLevelsPass = false;
      assert(false, `Level ${lvl.levelId} uniqueness`, `Found ${uniqueness.solutionCount} solutions`);
    }
  }
  assert(allLevelsPass, 'All 24 predefined levels are mathematically validated and unique!');

  // Test 10: Hint System
  reporter('\nGroup 6: Hint System');
  const level1 = PREDEFINED_LEVELS[0];
  const hint1 = HintSystem.getHint([], level1.solution, level1.regions, level1.gridSize);
  assert(hint1 !== null && hint1.type === 'NEXT_PLACEMENT', 'Hint provides next placement from empty board');
  assert(hint1.autoPlacable === true, 'Hint is auto-placeable');

  // Hint with wrong placement
  const wrongPlaced = [{ row: 0, col: 0 }]; // Level 1 solution has (0, 1), not (0, 0)
  const correctionHint = HintSystem.getHint(wrongPlaced, level1.solution, level1.regions, level1.gridSize);
  assert(correctionHint.type === 'CORRECTION', 'Hint spots erroneous placement and suggests correction');

  // Test 11: Scoring System
  reporter('\nGroup 7: Scoring System');
  const scoring = new ScoringSystem();
  const scoreData = scoring.calculateScore(level1, 30, 0, 0); // 30s elapsed, par is 45, 0 hints
  assert(scoreData.finalScore > scoreData.baseScore, 'Fast completion with 0 hints receives time bonus');
  assert(scoreData.stars === 3, 'Perfect play awards 3 stars');

  const perm1 = scoring.claimScoringPermission('lvl-1-attempt');
  const perm2 = scoring.claimScoringPermission('lvl-1-attempt');
  assert(perm1 === true && perm2 === false, 'Double-scoring guard prevents duplicate points for same attempt');

  // Test 12: Procedural Puzzle Generator
  reporter('\nGroup 8: Procedural Generator');
  const genPuzzle = PuzzleGenerator.generatePuzzle({ gridSize: 5, seed: 'test-seed-42' });
  assert(genPuzzle !== null && genPuzzle.gridSize === 5, 'Generator creates 5x5 puzzle with seed');
  const genUniqueness = PuzzleSolver.checkUniqueness(genPuzzle.regions, 5);
  assert(genUniqueness.isUnique === true, 'Generated puzzle is verified uniquely solvable');

  // Test 13: Single-Click Mark, Double-Click Identify Cat & 3 Lives System
  reporter('\nGroup 9: Single-Click Cross, Double-Click Cat & 3 Lives');
  const testEngine = new GameEngine();
  testEngine.loadLevel(level1);
  assert(testEngine.lives === 3, 'Level initializes with 3 lives');

  // 1. Single-click marks a cross
  const singleClick1 = testEngine.handleSingleClick(2, 2);
  assert(singleClick1.success === true, 'Single-click marks cross on cell');
  assert(testEngine.markedCrosses.has('2,2') === true, 'Cross mark recorded on cell');

  // Single-click again unmarks the cross
  const singleClick2 = testEngine.handleSingleClick(2, 2);
  assert(singleClick2.success === true && !testEngine.markedCrosses.has('2,2'), 'Single-click again toggles cross off');

  // 2. Double-click to identify a valid cat (Level 1 has cat at (0, 1))
  const dblClickCat = testEngine.handleDoubleClick(0, 1);
  assert(dblClickCat.success === true && dblClickCat.action === 'PLACED_CAT', 'Double-click correctly identifies cat');
  assert(testEngine.placedCats.some(c => c.row === 0 && c.col === 1), 'Cat is marked as placed');
  assert(testEngine.lives === 3, 'Lives unchanged on correct cat identification');

  // 3. Prevent identifying the same cat multiple times
  const repeatDblClick = testEngine.handleDoubleClick(0, 1);
  assert(repeatDblClick.action === 'ALREADY_IDENTIFIED', 'Prevents identifying the same cat multiple times');
  assert(testEngine.placedCats.length === 1, 'Placed cat count remains exactly 1');

  // 4. Double-click on cell that does not contain a cat triggers Wrong Placement Validation
  const wrongDblClick = testEngine.handleDoubleClick(0, 0); // (0, 0) does not have cat
  assert(wrongDblClick.success === false && wrongDblClick.action === 'WRONG_PLACEMENT', 'Wrong placement validation triggered on wrong cell');
  assert(testEngine.lives === 2, 'Deducts exactly 1 life on wrong placement (3 -> 2)');
  assert(testEngine.wrongMarks.has('0,0') === true, 'Red mark displayed on incorrectly selected cell');

  // 5. Prevent repeated clicks on an already validated cell from deducting additional lives
  const repeatWrongClick = testEngine.handleDoubleClick(0, 0);
  assert(repeatWrongClick.action === 'ALREADY_VALIDATED_WRONG', 'Repeated double-click on validated wrong cell recognized');
  assert(testEngine.lives === 2, 'Does NOT deduct additional life on already validated cell (lives remain 2)');

  const repeatSingleClick = testEngine.handleSingleClick(0, 0);
  assert(repeatSingleClick.action === 'ALREADY_VALIDATED_WRONG', 'Single-click on already validated cell is locked');
  assert(testEngine.lives === 2, 'Lives remain 2 after repeated single-click');

  // 6. Deducting remaining lives leads to Game Over
  testEngine.handleDoubleClick(0, 2); // 2nd mistake -> 1 life left
  assert(testEngine.lives === 1, 'Life reduced to 1 on second mistake');

  let gameOverFired = false;
  testEngine.onGameOver = () => { gameOverFired = true; };
  testEngine.handleDoubleClick(0, 3); // 3rd mistake -> 0 lives left
  assert(testEngine.lives === 0, 'Lives reach 0 on third mistake');
  assert(testEngine.isGameOver === true, 'Game over state triggered');
  assert(gameOverFired === true, 'onGameOver callback executed');

  // 7. Restart restores 3 lives and clears wrong marks
  testEngine.restart();
  assert(testEngine.lives === 3, 'Restart restores 3 lives');
  assert(testEngine.wrongMarks.size === 0, 'Restart clears all wrong marks');
  assert(testEngine.isGameOver === false, 'Restart resets game over state');
  testEngine.pauseTimer();

  reporter('\n========================================');
  reporter(`TOTAL TESTS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
  reporter('========================================\n');

  return results;
}
