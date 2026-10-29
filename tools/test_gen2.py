import random
from collections import deque

def generate_valid_cats(n, rng=random):
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

def count_and_find_solutions(regions, n, max_count=2):
    col_used = [False] * n
    region_used = [False] * n
    solutions = []

    def search(r, last_col):
        if r == n:
            solutions.append([(i, cols[i]) for i in range(n)])
            return len(solutions) >= max_count

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
            cols[r] = c

            stop = search(r + 1, c)

            col_used[c] = False
            region_used[reg] = False

            if stop:
                return True
        return False

    cols = [0] * n
    search(0, None)
    return solutions

def grow_initial_regions(n, cats, rng=random):
    grid = [[-1] * n for _ in range(n)]
    for reg, col in enumerate(cats):
        grid[reg][col] = reg
    
    unassigned = n * n - n
    while unassigned > 0:
        candidates = []
        for r in range(n):
            for c in range(n):
                if grid[r][c] == -1:
                    adj = []
                    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] != -1:
                            adj.append(grid[nr][nc])
                    if adj:
                        candidates.append((r, c, adj))
        if not candidates:
            break
        rng.shuffle(candidates)
        # pick a few to expand
        r, c, adj = candidates[0]
        grid[r][c] = rng.choice(adj)
        unassigned -= 1

    return grid

def refine_to_unique(n, grid, cats, rng=random, max_steps=1000):
    cat_set = set((r, cats[r]) for r in range(n))
    
    # helper to get cells of a region
    def get_region_cells():
        regs = [[] for _ in range(n)]
        for r in range(n):
            for c in range(n):
                regs[grid[r][c]].append((r, c))
        return regs

    for step in range(max_steps):
        sols = count_and_find_solutions(grid, n, max_count=2)
        if len(sols) == 1:
            return grid
        if len(sols) == 0:
            return None # should not happen since cats is a solution
        
        # We have an alternative solution!
        alt = sols[1] if set(sols[0]) == cat_set else sols[0]
        alt_set = set(alt)
        diff_cells = list(alt_set - cat_set)
        rng.shuffle(diff_cells)
        
        # Try to modify grid to eliminate alt solution
        # diff_cells has cells that alt uses. In alt, what regions are used?
        # If we reassign (r, c) in diff_cells to an adjacent region that alt ALREADY uses elsewhere,
        # then alt will have TWO cells in that region, breaking alt!
        reassigned = False
        reg_cells = get_region_cells()
        
        for r, c in diff_cells:
            curr_reg = grid[r][c]
            # check if removing (r, c) keeps curr_reg connected
            temp_curr = [cell for cell in reg_cells[curr_reg] if cell != (r, c)]
            if not is_connected_component(temp_curr):
                continue # cannot remove without disconnecting
            
            # which adjacent regions can we join?
            adj_regs = set()
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < n and 0 <= nc < n:
                    adj_regs.add(grid[nr][nc])
            adj_regs.discard(curr_reg)
            
            # Find an adjacent region that alt uses in some OTHER cell
            target_regs = [reg for reg in adj_regs if any(grid[ar][ac] == reg for ar, ac in alt if (ar, ac) != (r, c))]
            if not target_regs:
                target_regs = list(adj_regs)
            
            rng.shuffle(target_regs)
            for t_reg in target_regs:
                # Assign (r, c) to t_reg
                grid[r][c] = t_reg
                reassigned = True
                break
            if reassigned:
                break
        
        if not reassigned:
            # Random boundary jitter if targeted elimination didn't find move
            # Pick a random non-cat cell on border of two regions
            border_cells = []
            for r in range(n):
                for c in range(n):
                    if (r, c) in cat_set:
                        continue
                    curr_reg = grid[r][c]
                    # check if connected without it
                    if is_connected_component([cell for cell in reg_cells[curr_reg] if cell != (r, c)]):
                        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                            nr, nc = r + dr, c + dc
                            if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] != curr_reg:
                                border_cells.append((r, c, grid[nr][nc]))
            if border_cells:
                r, c, new_reg = rng.choice(border_cells)
                grid[r][c] = new_reg

    return None

def test_sizes():
    for n in range(4, 11):
        success = False
        for attempt in range(20):
            cats = generate_valid_cats(n)
            grid = grow_initial_regions(n, cats)
            res = refine_to_unique(n, grid, cats, max_steps=400)
            if res:
                print(f"Success for N={n} on attempt {attempt+1}!")
                success = True
                break
        if not success:
            print(f"Failed for N={n}")

test_sizes()
