import random
import time
from collections import deque

def is_valid_queen_placement(cols):
    """Check if row-by-row columns satisfy no-touch and distinct columns."""
    n = len(cols)
    if len(set(cols)) != n:
        return False
    for r in range(n - 1):
        if abs(cols[r] - cols[r+1]) <= 1:
            return False
    return True

def generate_valid_cats(n, rng=random):
    """Backtracking with random choice to find a valid cat placement."""
    def backtrack(r, current_cols):
        if r == n:
            return current_cols
        candidates = [c for c in range(n) if c not in current_cols and (r == 0 or abs(c - current_cols[-1]) > 1)]
        rng.shuffle(candidates)
        for c in candidates:
            res = backtrack(r + 1, current_cols + [c])
            if res is not None:
                return res
        return None

    return backtrack(0, [])

def count_solutions(regions, n, max_count=2):
    """
    Backtracking solver with constraint propagation:
    Each row must have exactly 1 cat.
    Each col must have exactly 1 cat.
    Each region must have exactly 1 cat.
    Adjacent rows cannot have cols with diff <= 1.
    """
    col_used = [False] * n
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
            reg = regions[r][c]
            if region_used[reg]:
                continue

            # Candidate is valid
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

def solve_puzzle(regions, n):
    """Find the solution for the puzzle if one exists."""
    col_used = [False] * n
    region_used = [False] * n
    solution = [None] * n

    def search(r, last_col):
        if r == n:
            return True

        for c in range(n):
            if col_used[c]:
                continue
            if last_col is not None and abs(c - last_col) <= 1:
                continue
            reg = regions[r][c]
            if region_used[reg]:
                continue

            col_used[c] = True
            region_used[reg] = True
            solution[r] = c

            if search(r + 1, c):
                return True

            col_used[c] = False
            region_used[reg] = False
            solution[r] = None

        return False

    if search(0, None):
        return [(r, solution[r]) for r in range(n)]
    return None

def is_connected(region_cells):
    """Check if a set of (r, c) cells forms an orthogonal connected component."""
    if not region_cells:
        return False
    cells_set = set(region_cells)
    start = next(iter(cells_set))
    visited = {start}
    queue = deque([start])
    while queue:
        r, c = queue.popleft()
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if (nr, nc) in cells_set and (nr, nc) not in visited:
                visited.add((nr, nc))
                queue.append((nr, nc))
    return len(visited) == len(cells_set)

def generate_puzzle(n, max_attempts=500, rng=random):
    """
    Generate an N x N puzzle with N regions and exactly 1 unique solution.
    """
    for attempt in range(max_attempts):
        cats = generate_valid_cats(n, rng)
        if not cats:
            continue
        
        # Grid initialization
        grid = [[-1] * n for _ in range(n)]
        # Assign seed region to each cat
        region_cells = [[] for _ in range(n)]
        frontiers = [deque() for _ in range(n)]
        
        for reg_id, col in enumerate(cats):
            r = reg_id # Note: cats[r] is the col for row r, so cat reg_id is at (reg_id, cats[reg_id])
            grid[r][col] = reg_id
            region_cells[reg_id].append((r, col))
            frontiers[reg_id].append((r, col))

        # Grow regions in rounds
        unassigned = n * n - n
        active_regions = list(range(n))

        while unassigned > 0 and active_regions:
            rng.shuffle(active_regions)
            progress = False
            for reg in list(active_regions):
                if not frontiers[reg]:
                    active_regions.remove(reg)
                    continue
                # Pick a cell from frontier
                r, c = frontiers[reg].popleft()
                # Find unassigned neighbors
                nbrs = []
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] == -1:
                        nbrs.append((nr, nc))
                rng.shuffle(nbrs)
                if nbrs:
                    # Claim one or more neighbors
                    take = nbrs[:rng.randint(1, min(2, len(nbrs)))]
                    for nr, nc in take:
                        if grid[nr][nc] == -1:
                            grid[nr][nc] = reg
                            region_cells[reg].append((nr, nc))
                            frontiers[reg].append((nr, nc))
                            unassigned -= 1
                            progress = True
                    # Put current back if it still might have neighbors or re-add
                    frontiers[reg].append((r, c))
                else:
                    pass

            if not progress:
                # Assign remaining orphan cells to adjacent existing regions
                orphan_found = False
                for r in range(n):
                    for c in range(n):
                        if grid[r][c] == -1:
                            # find neighbor with assigned region
                            adj_regs = []
                            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                                nr, nc = r + dr, c + dc
                                if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] != -1:
                                    adj_regs.append(grid[nr][nc])
                            if adj_regs:
                                reg = rng.choice(adj_regs)
                                grid[r][c] = reg
                                region_cells[reg].append((r, c))
                                unassigned -= 1
                                orphan_found = True
                if not orphan_found and unassigned > 0:
                    break

        if unassigned > 0:
            continue

        # Check connectivity of all regions
        if not all(is_connected(region_cells[i]) for i in range(n)):
            continue

        # Check solution count
        sol_count = count_solutions(grid, n, max_count=2)
        if sol_count == 1:
            sol = [(r, cats[r]) for r in range(n)]
            return {
                "gridSize": n,
                "regions": grid,
                "solution": sol,
                "attempts": attempt + 1
            }

    return None

if __name__ == '__main__':
    print("Testing 4x4...")
    p4 = generate_puzzle(4)
    print("4x4 puzzle:", p4 is not None)
    if p4:
        print("Regions:")
        for row in p4["regions"]:
            print(row)
        print("Solution:", p4["solution"])

    print("Testing 5x5...")
    p5 = generate_puzzle(5)
    print("5x5 puzzle:", p5 is not None)
    if p5:
        print("Solution:", p5["solution"])

    print("Testing 6x6...")
    p6 = generate_puzzle(6)
    print("6x6 puzzle:", p6 is not None)
    if p6:
        print("Solution:", p6["solution"])
