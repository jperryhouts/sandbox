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
      p > 1e-9 ? Math.floor((stockLength + 1e-9) / p) : 0
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

      if (bestStock === undefined) throw new Error(`No stock length fits piece ${piece}`)
      boards.push({ stockLength: bestStock, cuts: [piece], remaining: bestStock - piece })
    }
  }

  return boards.map(b => ({
    stockLength: b.stockLength,
    cuts: b.cuts,
    waste: b.remaining,
  }))
}
