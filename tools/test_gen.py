import random
from collections import deque

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

# Let's test a boundary swap / hill climbing approach
def test_generator():
    for n in [4, 5, 6, 7, 8, 9, 10]:
        print(f"Testing n={n}...")
        found = False
        for trial in range(500):
            # Generate random cats
            # ...
            pass
