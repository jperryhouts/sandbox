# Lumber Optimizer — Design Doc

**Date:** 2026-03-03

## Problem

Given a list of available stock lengths (e.g., 10ft and 16ft boards) and a list of required cut pieces (e.g., 8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2 feet), determine the minimum number of boards to buy and exactly how to cut each one.

This is the classic 1D cutting stock problem (NP-hard).

## Architecture

Single self-contained file: `apps/lumber/index.html` — inline CSS and JS, no build step, no external dependencies. Replaces the existing placeholder.

## UI Layout

Two-column input at the top, results below.

**Inputs:**
- "Available stock lengths" — textarea for comma/newline-separated values, chips/tags below with × to remove
- "Pieces needed" — same pattern
- "Optimize" button

**Results:**
- Summary: "Buy N boards: X× 10ft, Y× 16ft"
- One row per board: stock length label + CSS flexbox bar with colored segments per cut piece, gray segment for waste
- Waste percentage per board
- Yellow warning banner if FFD fallback was used (search timed out)

## Solver Algorithm

1. **Generate cutting patterns** — enumerate all feasible ways to cut one board of a given stock length into subsets of the required pieces (bounded knapsack, respecting per-piece multiplicity)
2. **Branch-and-bound** — iteratively assign patterns to boards; prune branches where `current_boards + FFD_lower_bound(remaining)` cannot beat best known solution
3. **FFD fallback** — if wall-clock time exceeds ~2 seconds, return FFD result with a warning that it may not be optimal

Output is sorted by waste ascending.

## Constraints / Scope

- No kerf allowance
- Units are whatever the user enters (feet, mm, etc.) — purely numeric
- Handles up to ~25–30 pieces optimally; larger inputs fall back to FFD heuristic
- No persistence — state lives only in the page
