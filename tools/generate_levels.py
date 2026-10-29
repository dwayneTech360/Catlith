import json
import random
from collections import deque

REGION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]

LEVEL_CONFIGS = [
    # Beginner
    {"id": 1, "name": "Cozy Living Room", "n": 4, "diff": "Beginner", "par": 45, "story": "Whiskers needs a cozy corner on the rug without bumping into Mittens."},
    {"id": 2, "name": "Sunlit Porch", "n": 4, "diff": "Beginner", "par": 45, "story": "Warm patches of sunlight across the porch tiles."},
    {"id": 3, "name": "Cat Tree Haven", "n": 5, "diff": "Beginner", "par": 60, "story": "Different climbing levels on the cat tree."},
    {"id": 4, "name": "Kitten Nursery", "n": 5, "diff": "Beginner", "par": 60, "story": "Playful kittens resting in their favorite cardboard boxes."},
    # Easy
    {"id": 5, "name": "Flower Garden", "n": 5, "diff": "Easy", "par": 75, "story": "Cats lounging between tulip beds and daisy patches."},
    {"id": 6, "name": "Fish Market Nap", "n": 6, "diff": "Easy", "par": 90, "story": "Guarding the prize catch without getting too close to competitors."},
    {"id": 7, "name": "Wool Basket Room", "n": 6, "diff": "Easy", "par": 90, "story": "Tangled balls of yarn form colorful territories."},
    {"id": 8, "name": "Rooftop Stroll", "n": 6, "diff": "Easy", "par": 90, "story": "Chimneys, skylights, and quiet evening tiles."},
    # Medium
    {"id": 9, "name": "Library Stacks", "n": 7, "diff": "Medium", "par": 120, "story": "Silence in the library! Each scholar cat needs their own aisle."},
    {"id": 10, "name": "Bakery Counter", "n": 7, "diff": "Medium", "par": 120, "story": "Fresh bread aromas. Don't wake the bakery guardians."},
    {"id": 11, "name": "Calico Cafe", "n": 7, "diff": "Medium", "par": 130, "story": "Tables and cushions arranged for feline tea time."},
    {"id": 12, "name": "Midnight Alley", "n": 8, "diff": "Medium", "par": 150, "story": "Lantern shadows and brick alleys with feline patrols."},
    # Hard
    {"id": 13, "name": "Palace Courtyard", "n": 8, "diff": "Hard", "par": 180, "story": "Marble fountains and manicured hedges fit for royalty."},
    {"id": 14, "name": "Astronomy Tower", "n": 8, "diff": "Hard", "par": 180, "story": "Stargazing platforms under the crescent moon."},
    {"id": 15, "name": "Enchanted Greenhouse", "n": 8, "diff": "Hard", "par": 190, "story": "Ferns, orchids, and glass panes create tricky zones."},
    {"id": 16, "name": "Clockwork Workshop", "n": 9, "diff": "Hard", "par": 210, "story": "Gears, pendulums, and springs demand precise placement."},
    # Expert
    {"id": 17, "name": "Whispering Forest", "n": 9, "diff": "Expert", "par": 240, "story": "Winding moss trails and ancient hollow trees."},
    {"id": 18, "name": "Dragon's Lair Ledge", "n": 9, "diff": "Expert", "par": 250, "story": "Cats fearless on mountain crags and volcanic rocks."},
    {"id": 19, "name": "Empress's Silk Pavilion", "n": 10, "diff": "Expert", "par": 300, "story": "Ten majestic queens reign over embroidered satin tapestry."},
    {"id": 20, "name": "Celestial Constellation", "n": 10, "diff": "Expert", "par": 320, "story": "Mapping the feline stars across the cosmic night sky."},
    # Master
    {"id": 21, "name": "The Grand Labyrinth", "n": 10, "diff": "Master", "par": 360, "story": "Intricate stone corridors challenge the sharpest puzzle masters."},
    {"id": 22, "name": "Sanctuary of Bastet", "n": 10, "diff": "Master", "par": 380, "story": "Ancient temple chambers blessed by the feline goddess herself."},
    {"id": 23, "name": "Purrfection Paradox", "n": 10, "diff": "Master", "par": 400, "story": "Subtle boundary shifts require deep elimination deductions."},
    {"id": 24, "name": "Nine Lives Ascendant", "n": 10, "diff": "Master", "par": 420, "story": "The ultimate test of logic for true cat connoisseurs."}
]

def generate_valid_cats(n, rng):
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

def grow_initial_regions(n, cats, rng):
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
        r, c, adj = candidates[0]
        grid[r][c] = rng.choice(adj)
        unassigned -= 1

    return grid

def refine_to_unique(n, grid, cats, rng, max_steps=400):
    cat_set = set((r, cats[r]) for r in range(n))
    
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
            return None
        
        alt = sols[1] if set(sols[0]) == cat_set else sols[0]
        alt_set = set(alt)
        diff_cells = list(alt_set - cat_set)
        rng.shuffle(diff_cells)
        
        reassigned = False
        reg_cells = get_region_cells()
        
        for r, c in diff_cells:
            curr_reg = grid[r][c]
            temp_curr = [cell for cell in reg_cells[curr_reg] if cell != (r, c)]
            if not is_connected_component(temp_curr):
                continue
            
            adj_regs = set()
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < n and 0 <= nc < n:
                    adj_regs.add(grid[nr][nc])
            adj_regs.discard(curr_reg)
            
            target_regs = [reg for reg in adj_regs if any(grid[ar][ac] == reg for ar, ac in alt if (ar, ac) != (r, c))]
            if not target_regs:
                target_regs = list(adj_regs)
            
            rng.shuffle(target_regs)
            for t_reg in target_regs:
                grid[r][c] = t_reg
                reassigned = True
                break
            if reassigned:
                break
        
        if not reassigned:
            border_cells = []
            for r in range(n):
                for c in range(n):
                    if (r, c) in cat_set:
                        continue
                    curr_reg = grid[r][c]
                    if is_connected_component([cell for cell in reg_cells[curr_reg] if cell != (r, c)]):
                        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                            nr, nc = r + dr, c + dc
                            if 0 <= nr < n and 0 <= nc < n and grid[nr][nc] != curr_reg:
                                border_cells.append((r, c, grid[nr][nc]))
            if border_cells:
                r, c, new_reg = rng.choice(border_cells)
                grid[r][c] = new_reg

    return None

def generate_level(cfg, seed):
    rng = random.Random(seed)
    n = cfg["n"]
    for attempt in range(50):
        cats = generate_valid_cats(n, rng)
        if not cats:
            continue
        grid = grow_initial_regions(n, cats, rng)
        res = refine_to_unique(n, grid, cats, rng, max_steps=500)
        if res:
            # Check all regions connected
            reg_cells = [[] for _ in range(n)]
            for r in range(n):
                for c in range(n):
                    reg_cells[res[r][c]].append((r, c))
            if not all(is_connected_component(cells) for cells in reg_cells):
                continue
            
            # Map integers 0..n-1 to letters A..J
            region_letters_grid = []
            for r in range(n):
                row_letters = [REGION_LETTERS[res[r][c]] for c in range(n)]
                region_letters_grid.append(row_letters)
            
            sol = [[r, cats[r]] for r in range(n)]
            return {
                "levelId": cfg["id"],
                "name": cfg["name"],
                "gridSize": n,
                "difficulty": cfg["diff"],
                "parTime": cfg["par"],
                "story": cfg["story"],
                "regions": region_letters_grid,
                "solution": sol
            }
    raise RuntimeError(f"Could not generate level {cfg['id']}")

def main():
    levels = []
    print("Generating 24 verified unique levels...")
    for i, cfg in enumerate(LEVEL_CONFIGS):
        seed = 1000 + i * 47
        lvl = generate_level(cfg, seed)
        levels.append(lvl)
        print(f"  Level {lvl['levelId']}: {lvl['name']} ({lvl['gridSize']}x{lvl['gridSize']}, {lvl['difficulty']}) generated successfully!")

    # Save to levels/levels.json
    with open("levels/levels.json", "w", encoding="utf-8") as f:
        json.dump(levels, f, indent=2)
    print("Saved levels/levels.json successfully!")

    # Also save as js/levels-data.js so it can be imported via ES module
    js_content = "// Predefined levels data (also available in levels/levels.json)\n"
    js_content += "export const PREDEFINED_LEVELS = " + json.dumps(levels, indent=2) + ";\n"
    with open("js/levels-data.js", "w", encoding="utf-8") as f:
        f.write(js_content)
    print("Saved js/levels-data.js successfully!")

if __name__ == "__main__":
    main()
