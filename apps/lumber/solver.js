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
      demands ? demands[i] : Math.floor((stockLength + 1e-9) / p),
      p > 1e-9 ? Math.floor((stockLength + 1e-9) / p) : 0
    )
  )

  const results = []

  function recurse(idx, remaining, current) {
    if (idx === pieces.length) {
      results.push([...current])
      return
    }
    // +1e-9 tolerates floating-point underflow in accumulated subtraction
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

/**
 * Sort pieces descending, then greedily assign each piece to the first
 * open board (across all stock lengths) that still has room.
 * When no existing board fits, open a new board using the stock length
 * that minimises the total number of boards (lookahead simulation tie-
 * broken by shortest stock).
 *
 * @param {number[]} stockLengths - available board lengths (e.g. [10, 16])
 * @param {number[]} pieces       - required cut lengths (any order)
 * @returns {{ stockLength: number, cuts: number[], waste: number }[]}
 */
export function ffd(stockLengths, pieces) {
  const sorted = [...stockLengths].sort((a, b) => a - b)
  const demanded = [...pieces].sort((a, b) => b - a) // descending

  /**
   * Quick simulation used only for stock-selection lookahead.
   * Returns the total board count if we start with `boardsSnap` and
   * place `remaining` pieces using plain FFD with shortest-stock fallback.
   */
  function simulate(boardsSnap, remaining) {
    const rem = boardsSnap.map(r => r) // shallow copy of remaining-space values
    for (const piece of remaining) {
      let placed = false
      for (let j = 0; j < rem.length; j++) {
        if (rem[j] >= piece - 1e-9) {
          rem[j] -= piece
          placed = true
          break
        }
      }
      if (!placed) {
        const s = sorted.find(sl => sl >= piece - 1e-9)
        rem.push(s - piece)
      }
    }
    return rem.length
  }

  // boards: { stockLength, cuts, remaining }
  const boards = []

  for (let i = 0; i < demanded.length; i++) {
    const piece = demanded[i]

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
      // Choose which stock length to open: run a lookahead simulation for
      // each candidate and pick the one that yields the fewest total boards.
      // Ties are broken by shorter stock (sorted ascending).
      const future = demanded.slice(i + 1)
      const snap = boards.map(b => b.remaining)

      let bestStock = null
      let bestCount = Infinity

      for (const s of sorted) {
        if (s < piece - 1e-9) continue
        const count = simulate([...snap, s - piece], future)
        if (count < bestCount) {
          bestCount = count
          bestStock = s
        }
      }

      if (bestStock === null) throw new Error(`No stock length fits piece ${piece}`)
      boards.push({ stockLength: bestStock, cuts: [piece], remaining: bestStock - piece })
    }
  }

  return boards.map(b => ({
    stockLength: b.stockLength,
    cuts: b.cuts,
    waste: b.remaining,
  }))
}

/**
 * Find the minimum number of boards needed using branch-and-bound.
 * Among solutions with equal board count, prefers minimum total stock purchased,
 * then maximum single scrap piece (to consolidate waste into useful offcuts).
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

  // Pre-generate all patterns per stock length (non-trivial only)
  const allPatterns = stockLengths.map(s => ({
    stockLength: s,
    patterns: generatePatterns(s, uniquePieces, initialDemand)
      .filter(p => p.some(c => c > 0)),
  }))

  function applyPattern(demand, pattern) {
    return demand.map((d, i) => d - pattern[i])
  }

  function demandFulfilled(demand) {
    return demand.every(d => d <= 0)
  }

  // FFD lower bound: how many boards does FFD need for remaining pieces?
  function lowerBound(demand) {
    const remaining = []
    for (let i = 0; i < uniquePieces.length; i++) {
      for (let j = 0; j < demand[i]; j++) remaining.push(uniquePieces[i])
    }
    if (remaining.length === 0) return 0
    return ffd(stockLengths, remaining).length
  }

  // Compute total stock and max scrap for boards in {stockLength, pattern} form
  function assignedTotalStock(boards) {
    return boards.reduce((s, b) => s + b.stockLength, 0)
  }

  function assignedMaxScrap(boards) {
    if (boards.length === 0) return 0
    return Math.max(...boards.map(({ stockLength, pattern }) =>
      stockLength - pattern.reduce((s, c, i) => s + c * uniquePieces[i], 0)
    ))
  }

  // Initial upper bound: FFD solution
  let bestBoards = ffd(stockLengths, pieces)
  let bestTotalStock = bestBoards.reduce((s, b) => s + b.stockLength, 0)
  let bestMaxScrap = Math.max(0, ...bestBoards.map(b => b.waste))
  let timedOut = false

  // Returns true if the candidate (count, totalStock, maxScrap) beats the current best.
  // Objectives in priority order:
  //   1. Fewer boards
  //   2. Less total stock purchased (proxy for cost)
  //   3. Larger single scrap piece (more useful offcut)
  function isBetter(count, totalStock, maxScrap) {
    if (count < bestBoards.length) return true
    if (count > bestBoards.length) return false
    if (totalStock < bestTotalStock - 1e-9) return true
    if (totalStock > bestTotalStock + 1e-9) return false
    return maxScrap > bestMaxScrap + 1e-9
  }

  function branch(demand, assignedBoards) {
    if (Date.now() > deadline) { timedOut = true; return }
    if (demandFulfilled(demand)) {
      const count = assignedBoards.length
      const totalStock = assignedTotalStock(assignedBoards)
      const maxScrap = assignedMaxScrap(assignedBoards)
      if (isBetter(count, totalStock, maxScrap)) {
        bestBoards = assignedBoards.map(({ stockLength, pattern }) => {
          const cuts = []
          for (let i = 0; i < uniquePieces.length; i++) {
            for (let j = 0; j < pattern[i]; j++) cuts.push(uniquePieces[i])
          }
          const waste = stockLength - cuts.reduce((s, c) => s + c, 0)
          return { stockLength, cuts, waste }
        })
        bestTotalStock = totalStock
        bestMaxScrap = maxScrap
      }
      return
    }

    // Prune only when we strictly cannot match the best board count
    if (assignedBoards.length + lowerBound(demand) > bestBoards.length) return

    for (const { stockLength, patterns } of allPatterns) {
      for (const pattern of patterns) {
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
