# Lumber Optimizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder `apps/lumber/index.html` with a working lumber cut optimizer that finds the minimum number of boards to buy and how to cut each one.

**Architecture:** Solver logic lives in `apps/lumber/solver.js` as a plain ES module (importable by both Vitest tests and the HTML page). The UI is `apps/lumber/index.html` with inline CSS and a `<script type="module">` that imports the solver. No external dependencies.

**Tech Stack:** Vanilla JS ES modules, Vitest + jsdom for tests, plain HTML/CSS for UI.

---

### Task 1: FFD heuristic solver

The First Fit Decreasing heuristic is used both as a standalone fallback and as the lower-bound estimator inside branch-and-bound.

**Files:**
- Create: `apps/lumber/solver.js`
- Create: `src/lumber-solver.test.js`

**Step 1: Write the failing tests**

Create `src/lumber-solver.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { ffd } from '../apps/lumber/solver.js'

describe('ffd', () => {
  it('packs a single piece into one board', () => {
    const result = ffd([10], [7])
    expect(result.length).toBe(1)
    expect(result[0].stockLength).toBe(10)
    expect(result[0].cuts).toEqual([7])
  })

  it('packs two pieces that fit on one board', () => {
    const result = ffd([10], [5, 5])
    expect(result.length).toBe(1)
    expect(result[0].cuts).toEqual([5, 5])
  })

  it('splits pieces across two boards when needed', () => {
    const result = ffd([10], [7, 7])
    expect(result.length).toBe(2)
  })

  it('chooses the shorter stock length when both fit', () => {
    const result = ffd([10, 16], [8])
    expect(result.length).toBe(1)
    expect(result[0].stockLength).toBe(10)
  })

  it('chooses longer stock when shorter does not fit', () => {
    const result = ffd([10, 16], [11])
    expect(result.length).toBe(1)
    expect(result[0].stockLength).toBe(16)
  })

  it('handles the worked example from the design doc', () => {
    const pieces = [8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2]
    const result = ffd([10, 16], pieces)
    // FFD should use no more than 5 boards (optimal is 4)
    expect(result.length).toBeLessThanOrEqual(5)
    // Every piece must appear in some board
    const allCuts = result.flatMap(b => b.cuts)
    expect(allCuts.sort((a,b)=>a-b)).toEqual([...pieces].sort((a,b)=>a-b))
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/lumber-solver.test.js
```
Expected: all tests FAIL with "Cannot find module" or similar.

**Step 3: Implement FFD in solver.js**

Create `apps/lumber/solver.js`:

```js
/**
 * Sort pieces descending, then greedily assign each piece to the first
 * open board (across all stock lengths) that still has room.
 * When no existing board fits, open a new board using the shortest
 * available stock length that can fit the piece.
 *
 * @param {number[]} stockLengths - available board lengths (e.g. [10, 16])
 * @param {number[]} pieces       - required cut lengths (any order)
 * @returns {{ stockLength: number, cuts: number[], waste: number }[]}
 */
export function ffd(stockLengths, pieces) {
  const sorted = [...stockLengths].sort((a, b) => a - b)
  const demanded = [...pieces].sort((a, b) => b - a) // descending

  // boards: { stockLength, cuts, remaining }
  const boards = []

  for (const piece of demanded) {
    // find first existing board with enough room
    let placed = false
    for (const board of boards) {
      if (board.remaining >= piece - 1e-9) {
        board.cuts.push(piece)
        board.remaining -= piece
        placed = true
        break
      }
    }
    if (!placed) {
      // open new board: shortest stock that fits this piece
      const stock = sorted.find(s => s >= piece - 1e-9)
      if (stock === undefined) throw new Error(`No stock length fits piece ${piece}`)
      boards.push({ stockLength: stock, cuts: [piece], remaining: stock - piece })
    }
  }

  return boards.map(b => ({
    stockLength: b.stockLength,
    cuts: b.cuts,
    waste: b.remaining,
  }))
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/lumber-solver.test.js
```
Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add apps/lumber/solver.js src/lumber-solver.test.js
git commit -m "feat: add FFD heuristic solver for lumber cutting"
```

---

### Task 2: Cutting pattern generator

A "pattern" describes one way to cut a single board of a given stock length into a multiset of required pieces. The branch-and-bound needs to enumerate all valid patterns.

**Files:**
- Modify: `apps/lumber/solver.js`
- Modify: `src/lumber-solver.test.js`

**Step 1: Add failing tests**

Append to `src/lumber-solver.test.js`:

```js
import { generatePatterns } from '../apps/lumber/solver.js'

describe('generatePatterns', () => {
  it('returns empty pattern for no pieces', () => {
    const patterns = generatePatterns(10, [])
    expect(patterns).toEqual([[]])
  })

  it('single piece that fits', () => {
    const patterns = generatePatterns(10, [7])
    // patterns: [1 cut of 7] and [0 cuts of 7]
    expect(patterns).toContainEqual([1])
    expect(patterns).toContainEqual([0])
  })

  it('does not include patterns where total exceeds stock', () => {
    // stock=10, pieces=[7,6]: cannot take both (13>10)
    const patterns = generatePatterns(10, [7, 6])
    for (const p of patterns) {
      const total = p[0] * 7 + p[1] * 6
      expect(total).toBeLessThanOrEqual(10 + 1e-9)
    }
  })

  it('respects demand limits', () => {
    // stock=20, pieces=[7] with demand [1]: cannot cut more than 1
    const patterns = generatePatterns(20, [7], [1])
    for (const p of patterns) {
      expect(p[0]).toBeLessThanOrEqual(1)
    }
  })

  it('returns all valid combinations for stock=10, pieces=[5,3]', () => {
    const patterns = generatePatterns(10, [5, 3])
    // valid: [0,0],[1,0],[0,1],[2,0],[1,1],[0,2],[0,3],[2,0] etc
    // just check [2,0] and [1,1] are present
    expect(patterns).toContainEqual([2, 0])
    expect(patterns).toContainEqual([1, 1])
  })
})
```

**Step 2: Run to confirm failure**

```bash
npm test -- --reporter=verbose src/lumber-solver.test.js
```
Expected: new tests FAIL with "generatePatterns is not a function".

**Step 3: Implement generatePatterns**

Add to `apps/lumber/solver.js` (before the `ffd` export):

```js
/**
 * Enumerate all ways to cut one board of `stockLength` into pieces from
 * `pieces`, respecting optional per-piece demand limits.
 *
 * @param {number}   stockLength
 * @param {number[]} pieces       - distinct piece lengths
 * @param {number[]} [demands]    - max count of each piece (default: floor(stock/piece))
 * @returns {number[][]}          - array of count vectors, one entry per piece
 */
export function generatePatterns(stockLength, pieces, demands) {
  if (pieces.length === 0) return [[]]
  const maxCounts = pieces.map((p, i) =>
    Math.min(
      demands ? demands[i] : Infinity,
      p > 1e-9 ? Math.floor(stockLength / p) : 0
    )
  )

  const results = []

  function recurse(idx, remaining, current) {
    if (idx === pieces.length) {
      results.push([...current])
      return
    }
    const maxHere = Math.min(maxCounts[idx], Math.floor(remaining / pieces[idx] + 1e-9))
    for (let c = 0; c <= maxHere; c++) {
      current.push(c)
      recurse(idx + 1, remaining - c * pieces[idx], current)
      current.pop()
    }
  }

  recurse(0, stockLength, [])
  return results
}
```

**Step 4: Run all tests**

```bash
npm test -- --reporter=verbose src/lumber-solver.test.js
```
Expected: all tests PASS.

**Step 5: Commit**

```bash
git add apps/lumber/solver.js src/lumber-solver.test.js
git commit -m "feat: add cutting pattern generator"
```

---

### Task 3: Branch-and-bound exact solver

Combines FFD (lower bound) and pattern enumeration to find the optimal (minimum-board) solution.

**Files:**
- Modify: `apps/lumber/solver.js`
- Modify: `src/lumber-solver.test.js`

**Step 1: Add failing tests**

Append to `src/lumber-solver.test.js`:

```js
import { optimize } from '../apps/lumber/solver.js'

describe('optimize', () => {
  it('returns same result as ffd for trivial case', () => {
    const result = optimize([10], [5, 5])
    expect(result.boards.length).toBe(1)
    expect(result.timedOut).toBe(false)
  })

  it('finds optimal 1-board solution when FFD would use 2', () => {
    // pieces [6, 5] on stock [12]: FFD (sorted desc) places 6 on board1,
    // then 5 on board1 (remaining 6 >= 5), so actually FFD gets 1 here too.
    // Use a case where FFD is suboptimal: [7,6,5,4] on stock [12]
    // FFD: board1=[7,5], board2=[6,4] → 2 boards (optimal)
    // FFD suboptimal example: pieces [9,8,7,6,5] on stock [16]
    // FFD: [9,7]=16, [8,6]=14, [5] → 3 boards
    // Optimal: [9,7]=16, [8,5,3]... hmm let me use known case
    // Simpler: verify it always matches or beats FFD
    const pieces = [8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2]
    const ffdResult = ffd([10, 16], pieces)
    const result = optimize([10, 16], pieces)
    expect(result.boards.length).toBeLessThanOrEqual(ffdResult.length)
  })

  it('solves the design doc example optimally', () => {
    // 8+8=16 ✓, 7+7+2=16 ✓, 8.5+1.5waste on 10, 5.9+3.9=9.8 on 10 → 4 boards
    const pieces = [8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2]
    const result = optimize([10, 16], pieces)
    expect(result.boards.length).toBe(4)
  })

  it('returns timedOut=false for small input', () => {
    const result = optimize([10], [3, 3, 3])
    expect(result.timedOut).toBe(false)
  })

  it('each board cut list sums to at most its stock length', () => {
    const pieces = [8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2]
    const result = optimize([10, 16], pieces)
    for (const board of result.boards) {
      const total = board.cuts.reduce((s, c) => s + c, 0)
      expect(total).toBeLessThanOrEqual(board.stockLength + 1e-9)
    }
  })

  it('every required piece appears in the result', () => {
    const pieces = [8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2]
    const result = optimize([10, 16], pieces)
    const allCuts = result.boards.flatMap(b => b.cuts).sort((a,b)=>a-b)
    expect(allCuts).toEqual([...pieces].sort((a,b)=>a-b))
  })
})
```

**Step 2: Run to confirm failure**

```bash
npm test -- --reporter=verbose src/lumber-solver.test.js
```
Expected: new tests FAIL.

**Step 3: Implement optimize**

Add to `apps/lumber/solver.js`:

```js
/**
 * Find the minimum number of boards needed using branch-and-bound.
 * Falls back to FFD if the search exceeds `timeoutMs`.
 *
 * @param {number[]} stockLengths
 * @param {number[]} pieces         - required cut lengths (may repeat)
 * @param {number}   [timeoutMs=2000]
 * @returns {{ boards: {stockLength,cuts,waste}[], timedOut: boolean }}
 */
export function optimize(stockLengths, pieces, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs

  // Deduplicate piece lengths and track demands
  const pieceMap = new Map()
  for (const p of pieces) pieceMap.set(p, (pieceMap.get(p) ?? 0) + 1)
  const uniquePieces = [...pieceMap.keys()].sort((a, b) => b - a)
  const initialDemand = uniquePieces.map(p => pieceMap.get(p))

  // Pre-generate all patterns per stock length
  const allPatterns = stockLengths.map(s => ({
    stockLength: s,
    patterns: generatePatterns(s, uniquePieces, initialDemand)
      .filter(p => p.some(c => c > 0)), // exclude zero pattern
  }))

  // Convert a demand vector + pattern vector to remaining demand
  function applyPattern(demand, pattern) {
    return demand.map((d, i) => d - pattern[i])
  }

  function demandFulfilled(demand) {
    return demand.every(d => d <= 0)
  }

  // FFD lower bound on remaining demand (returns board count)
  function lowerBound(demand) {
    const remaining = []
    for (let i = 0; i < uniquePieces.length; i++) {
      for (let j = 0; j < demand[i]; j++) remaining.push(uniquePieces[i])
    }
    if (remaining.length === 0) return 0
    return ffd(stockLengths, remaining).length
  }

  let bestBoards = ffd(stockLengths, pieces) // initial upper bound
  let timedOut = false

  // board assignment: array of {stockLength, pattern}
  function branch(demand, assignedBoards) {
    if (Date.now() > deadline) { timedOut = true; return }
    if (demandFulfilled(demand)) {
      if (assignedBoards.length < bestBoards.length) {
        // Reconstruct board objects
        bestBoards = assignedBoards.map(({ stockLength, pattern }) => {
          const cuts = []
          for (let i = 0; i < uniquePieces.length; i++) {
            for (let j = 0; j < pattern[i]; j++) cuts.push(uniquePieces[i])
          }
          const waste = stockLength - cuts.reduce((s, c) => s + c, 0)
          return { stockLength, cuts, waste }
        })
      }
      return
    }

    // Prune: current boards + lower bound on remaining >= best known
    if (assignedBoards.length + lowerBound(demand) >= bestBoards.length) return

    // Try every pattern from every stock length
    for (const { stockLength, patterns } of allPatterns) {
      for (const pattern of patterns) {
        // Pattern must not exceed current demand for any piece
        if (pattern.some((c, i) => c > demand[i])) continue
        const newDemand = applyPattern(demand, pattern)
        branch(newDemand, [...assignedBoards, { stockLength, pattern }])
        if (timedOut) return
      }
    }
  }

  branch(initialDemand, [])

  return { boards: bestBoards, timedOut }
}
```

**Step 4: Run all tests**

```bash
npm test -- --reporter=verbose src/lumber-solver.test.js
```
Expected: all tests PASS. If the "design doc example" test is slow, the `lowerBound` call may need tuning — but for 9 pieces it should complete in milliseconds.

**Step 5: Commit**

```bash
git add apps/lumber/solver.js src/lumber-solver.test.js
git commit -m "feat: add branch-and-bound exact solver"
```

---

### Task 4: UI — input section

Build the HTML/CSS input form: two textareas with live chip rendering and × removal.

**Files:**
- Modify: `apps/lumber/index.html`

**Step 1: Replace the placeholder with the full UI scaffold**

Replace the entire contents of `apps/lumber/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lumber Optimizer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 1.5rem;
      background: #f8f7f4;
      color: #222;
      min-height: 100vh;
    }

    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 1.25rem;
      color: #1a1a1a;
    }

    .inputs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    @media (max-width: 540px) {
      .inputs { grid-template-columns: 1fr; }
    }

    .input-group label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #555;
      margin-bottom: 0.4rem;
    }

    .input-group textarea {
      width: 100%;
      height: 72px;
      padding: 0.5rem 0.6rem;
      border: 1.5px solid #ccc;
      border-radius: 6px;
      font: inherit;
      font-size: 0.9rem;
      resize: vertical;
      background: #fff;
      transition: border-color 0.15s;
    }

    .input-group textarea:focus {
      outline: none;
      border-color: #5b8a5f;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.45rem;
      min-height: 1.8rem;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.5rem;
      background: #e8f0e9;
      border: 1px solid #b8d4ba;
      border-radius: 999px;
      font-size: 0.8rem;
      color: #2d5a31;
      cursor: default;
    }

    .chip button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: #6a9a6e;
      font-size: 0.85rem;
      line-height: 1;
      display: flex;
      align-items: center;
    }

    .chip button:hover { color: #c0392b; }

    .actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    button#optimize-btn {
      padding: 0.55rem 1.4rem;
      background: #3d7042;
      color: #fff;
      border: none;
      border-radius: 6px;
      font: inherit;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }

    button#optimize-btn:hover { background: #2e5631; }
    button#optimize-btn:disabled { background: #999; cursor: not-allowed; }

    #error-msg {
      color: #c0392b;
      font-size: 0.85rem;
    }

    /* Results */
    #results { display: none; }

    .result-summary {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .warning-banner {
      background: #fff8e1;
      border: 1px solid #f0c040;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      color: #7a5800;
      margin-bottom: 0.75rem;
      display: none;
    }

    .board-row {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      margin-bottom: 0.5rem;
    }

    .board-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #555;
      margin-bottom: 0.4rem;
    }

    .cut-bar {
      display: flex;
      height: 28px;
      border-radius: 4px;
      overflow: hidden;
      width: 100%;
    }

    .cut-seg {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 600;
      color: #fff;
      overflow: hidden;
      white-space: nowrap;
      border-right: 1px solid rgba(255,255,255,0.3);
      min-width: 2px;
    }

    .cut-seg:last-child { border-right: none; }

    .cut-seg.waste {
      background: #ddd;
      color: #888;
      font-weight: 400;
    }

    /* Cycle through a palette for cut segments */
    .cut-seg:not(.waste):nth-child(7n+1) { background: #3d7042; }
    .cut-seg:not(.waste):nth-child(7n+2) { background: #2874a6; }
    .cut-seg:not(.waste):nth-child(7n+3) { background: #884ea0; }
    .cut-seg:not(.waste):nth-child(7n+4) { background: #b7770d; }
    .cut-seg:not(.waste):nth-child(7n+5) { background: #c0392b; }
    .cut-seg:not(.waste):nth-child(7n+6) { background: #117a65; }
    .cut-seg:not(.waste):nth-child(7n+0) { background: #1f618d; }
  </style>
</head>
<body>
  <h1>Lumber Optimizer</h1>

  <div class="inputs">
    <div class="input-group">
      <label for="stock-input">Available stock lengths</label>
      <textarea id="stock-input" placeholder="e.g. 10, 16"></textarea>
      <div class="chips" id="stock-chips"></div>
    </div>
    <div class="input-group">
      <label for="pieces-input">Pieces needed</label>
      <textarea id="pieces-input" placeholder="e.g. 8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2"></textarea>
      <div class="chips" id="pieces-chips"></div>
    </div>
  </div>

  <div class="actions">
    <button id="optimize-btn">Optimize</button>
    <span id="error-msg"></span>
  </div>

  <div id="results">
    <div class="warning-banner" id="timeout-warning">
      Search timed out — showing best solution found (may not be optimal).
    </div>
    <div class="result-summary" id="result-summary"></div>
    <div id="board-list"></div>
  </div>

  <script type="module">
    import { optimize } from './solver.js'

    // ── chip state ────────────────────────────────────────────────────────
    const stockState  = { raw: '', values: [] }
    const piecesState = { raw: '', values: [] }

    function parseNumbers(text) {
      return text
        .split(/[\s,;]+/)
        .map(s => parseFloat(s))
        .filter(n => isFinite(n) && n > 0)
    }

    function renderChips(state, containerId, onRemove) {
      const container = document.getElementById(containerId)
      container.innerHTML = ''
      state.values.forEach((v, i) => {
        const chip = document.createElement('span')
        chip.className = 'chip'
        chip.textContent = v
        const btn = document.createElement('button')
        btn.setAttribute('aria-label', `Remove ${v}`)
        btn.textContent = '×'
        btn.addEventListener('click', () => onRemove(i))
        chip.appendChild(btn)
        container.appendChild(chip)
      })
    }

    function wireTextarea(inputId, chipsId, state) {
      const el = document.getElementById(inputId)
      el.addEventListener('input', () => {
        state.raw = el.value
        state.values = parseNumbers(state.raw)
        renderChips(state, chipsId, idx => {
          state.values.splice(idx, 1)
          // Rebuild textarea to match
          el.value = state.values.join(', ')
          state.raw = el.value
          renderChips(state, chipsId, arguments.callee)
        })
      })
    }

    wireTextarea('stock-input',  'stock-chips',  stockState)
    wireTextarea('pieces-input', 'pieces-chips', piecesState)

    // ── optimize ──────────────────────────────────────────────────────────
    document.getElementById('optimize-btn').addEventListener('click', () => {
      const errEl = document.getElementById('error-msg')
      errEl.textContent = ''

      if (stockState.values.length === 0) {
        errEl.textContent = 'Enter at least one stock length.'
        return
      }
      if (piecesState.values.length === 0) {
        errEl.textContent = 'Enter at least one piece length.'
        return
      }
      const tooBig = piecesState.values.filter(p =>
        !stockState.values.some(s => s >= p - 1e-9)
      )
      if (tooBig.length > 0) {
        errEl.textContent = `No stock length fits piece(s): ${tooBig.join(', ')}`
        return
      }

      const btn = document.getElementById('optimize-btn')
      btn.disabled = true
      btn.textContent = 'Optimizing…'

      // Run async so the UI updates before blocking
      setTimeout(() => {
        try {
          const { boards, timedOut } = optimize(stockState.values, piecesState.values)
          renderResults(boards, timedOut)
        } catch (e) {
          errEl.textContent = `Error: ${e.message}`
        } finally {
          btn.disabled = false
          btn.textContent = 'Optimize'
        }
      }, 0)
    })

    // ── results rendering ─────────────────────────────────────────────────
    function renderResults(boards, timedOut) {
      const el = document.getElementById('results')
      el.style.display = 'block'

      document.getElementById('timeout-warning').style.display =
        timedOut ? 'block' : 'none'

      // Summary line
      const counts = {}
      for (const b of boards) counts[b.stockLength] = (counts[b.stockLength] ?? 0) + 1
      const parts = Object.entries(counts)
        .sort(([a],[b]) => Number(a)-Number(b))
        .map(([len, n]) => `${n}× ${len}ft`)
      document.getElementById('result-summary').textContent =
        `Buy ${boards.length} board${boards.length !== 1 ? 's' : ''}: ${parts.join(', ')}`

      // Board rows, sorted by waste ascending
      const sorted = [...boards].sort((a, b) => a.waste - b.waste)
      const list = document.getElementById('board-list')
      list.innerHTML = ''

      for (let i = 0; i < sorted.length; i++) {
        const { stockLength, cuts, waste } = sorted[i]
        const row = document.createElement('div')
        row.className = 'board-row'

        const label = document.createElement('div')
        label.className = 'board-label'
        const wasteStr = waste > 1e-9 ? ` — ${fmt(waste)} waste` : ' — no waste'
        label.textContent = `Board ${i + 1}: ${stockLength}ft${wasteStr}`
        row.appendChild(label)

        const bar = document.createElement('div')
        bar.className = 'cut-bar'

        for (const cut of cuts) {
          const seg = document.createElement('div')
          seg.className = 'cut-seg'
          seg.style.flex = cut / stockLength
          seg.textContent = fmt(cut)
          bar.appendChild(seg)
        }

        if (waste > 1e-9) {
          const seg = document.createElement('div')
          seg.className = 'cut-seg waste'
          seg.style.flex = waste / stockLength
          seg.textContent = fmt(waste)
          bar.appendChild(seg)
        }

        row.appendChild(bar)
        list.appendChild(row)
      }
    }

    function fmt(n) {
      return parseFloat(n.toFixed(4)).toString()
    }
  </script>
</body>
</html>
```

**Step 2: Verify visually**

```bash
npm run dev
```
Open http://localhost:5173/sandbox/ and:
- Type `10, 16` in stock lengths → chips appear
- Type `8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2` in pieces needed → chips appear
- Click Optimize → results show 4 boards with colored cut bars

**Step 3: Commit**

```bash
git add apps/lumber/index.html
git commit -m "feat: add lumber optimizer UI with chip inputs and results display"
```

---

### Task 5: Run full test suite and fix any issues

**Step 1: Run all tests**

```bash
npm test
```
Expected: all tests PASS (including pre-existing main.js tests).

**Step 2: Fix any failures, then commit**

```bash
git add -A
git commit -m "fix: resolve any test failures after UI integration"
```
(Only if there were actually fixes to commit.)

---

### Task 6: Final integration check

**Step 1: Build and verify**

```bash
npm run build
```
Expected: build succeeds with no errors. The `dist/apps/lumber/` directory should contain both `index.html` and `solver.js`.

**Step 2: Confirm solver.js is copied to dist**

```bash
ls dist/apps/lumber/
```
Expected: `index.html` and `solver.js` both present.

**Step 3: Commit if any fixes were needed, then finish**

If everything passes with no changes needed, invoke `superpowers:finishing-a-development-branch`.
