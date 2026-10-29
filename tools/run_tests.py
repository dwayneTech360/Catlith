import json
import sys
from collections import deque

def check_cells_touch(r1, c1, r2, c2):
    if r1 == r2 and c1 == c2:
        return False
    return abs(r1 - r2) <= 1 and abs(c1 - c2) <= 1

def is_connected_component(cells):
    if not cells:
        return False
    cells_set = set(cells)
    start = next(iter(cells_set))
    visited = {start}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if (nr, nc) in cells_set and (nr, nc) not in visited:
                visited.add((nr, nc))
                q.append((nr, nc))
    return len(visited) == len(cells_set)

def count_solutions(regions, n, max_count=2):
    col_used = [False] * n
    region_map = {}
    for r in range(n):
        for c in range(n):
            reg = str(regions[r][c])
            if reg not in region_map:
                region_map[reg] = len(region_map)

    numeric_regions = [[region_map[str(regions[r][c])] for c in range(n)] for r in range(n)]
    region_used = [False] * n
    solutions = []

    def search(r, last_col):
        if r == n:
            solutions.append(True)
            return len(solutions) >= max_count

        for c in range(n):
            if col_used[c]:
                continue
            if last_col is not None and abs(c - last_col) <= 1:
                continue
            reg = numeric_regions[r][c]
            if region_used[reg]:
                continue

            col_used[c] = True
            region_used[reg] = True

            stop = search(r + 1, c)

            col_used[c] = False
            region_used[reg] = False

            if stop:
                return True
        return False

    search(0, None)
    return len(solutions)

def main():
    print("==================================================")
    print("       Cat Puzzle CLI VALIDATION SUITE         ")
    print("==================================================")

    with open("levels/levels.json", "r", encoding="utf-8") as f:
        levels = json.load(f)

    total_tests = 0
    passed_tests = 0

    def test(desc, cond):
        nonlocal total_tests, passed_tests
        total_tests += 1
        if cond:
            passed_tests += 1
            print(f"  [PASS] {desc}")
        else:
            print(f"  [FAIL] {desc}")

    # Test touch detection
    print("\n--- Testing Touch Logic ---")
    test("Orthogonal touch (0,0)-(0,1)", check_cells_touch(0, 0, 0, 1) is True)
    test("Orthogonal touch (0,0)-(1,0)", check_cells_touch(0, 0, 1, 0) is True)
    test("Diagonal touch (0,0)-(1,1)", check_cells_touch(0, 0, 1, 1) is True)
    test("Non-touch distance 2 (0,0)-(0,2)", check_cells_touch(0, 0, 0, 2) is False)
    test("Non-touch distance 2 (0,0)-(2,2)", check_cells_touch(0, 0, 2, 2) is False)

    # Test all 24 levels
    print(f"\n--- Validating {len(levels)} Predefined Levels ---")
    for lvl in levels:
        lvl_id = lvl["levelId"]
        name = lvl["name"]
        n = lvl["gridSize"]
        regions = lvl["regions"]
        sol = lvl["solution"]

        # 1. Grid dimension check
        test(f"L{lvl_id} ({name}): Grid size is {n}x{n}", len(regions) == n and all(len(r) == n for r in regions))

        # 2. Solution length
        test(f"L{lvl_id}: Solution has {n} cats", len(sol) == n)

        # 3. Rule 1: One cat per row
        sol_rows = [pt[0] for pt in sol]
        test(f"L{lvl_id}: Exactly 1 cat per row", len(set(sol_rows)) == n and sorted(sol_rows) == list(range(n)))

        # 4. Rule 2: One cat per column
        sol_cols = [pt[1] for pt in sol]
        test(f"L{lvl_id}: Exactly 1 cat per col", len(set(sol_cols)) == n and sorted(sol_cols) == list(range(n)))

        # 5. Rule 3: One cat per color region
        sol_regs = [regions[pt[0]][pt[1]] for pt in sol]
        test(f"L{lvl_id}: Exactly 1 cat per region", len(set(sol_regs)) == n)

        # 6. Rule 4: No two cats touch
        touching = False
        for i in range(n):
            for j in range(i + 1, n):
                if check_cells_touch(sol[i][0], sol[i][1], sol[j][0], sol[j][1]):
                    touching = True
                    break
            if touching:
                break
        test(f"L{lvl_id}: No cats touching (horizontal/vertical/diagonal)", touching is False)

        # 7. Region connectivity
        reg_cells = {}
        for r in range(n):
            for c in range(n):
                rg = regions[r][c]
                reg_cells.setdefault(rg, []).append((r, c))
        all_conn = all(is_connected_component(cells) for cells in reg_cells.values())
        test(f"L{lvl_id}: All {len(reg_cells)} regions are connected components", all_conn)

        # 8. Uniqueness verification with solver
        sols_count = count_solutions(regions, n, 2)
        test(f"L{lvl_id}: Exactly 1 UNIQUE solution (count={sols_count})", sols_count == 1)

    print("\n==================================================")
    print(f"TEST SUMMARY: {passed_tests} / {total_tests} PASSED")
    print("==================================================")

    if passed_tests == total_tests:
        print("\nAll automated tests passed successfully! System is fully verified.")
        sys.exit(0)
    else:
        print(f"\n{total_tests - passed_tests} test(s) failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
