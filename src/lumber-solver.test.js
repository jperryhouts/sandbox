import { describe, it, expect } from 'vitest'
import { ffd, generatePatterns, optimize } from '../apps/lumber/solver.js'

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

describe('generatePatterns', () => {
  it('returns empty pattern for no pieces', () => {
    const patterns = generatePatterns(10, [])
    expect(patterns).toEqual([[]])
  })

  it('single piece that fits', () => {
    const patterns = generatePatterns(10, [7])
    expect(patterns).toContainEqual([1])
    expect(patterns).toContainEqual([0])
  })

  it('does not include patterns where total exceeds stock', () => {
    const patterns = generatePatterns(10, [7, 6])
    for (const p of patterns) {
      const total = p[0] * 7 + p[1] * 6
      expect(total).toBeLessThanOrEqual(10 + 1e-9)
    }
  })

  it('respects demand limits', () => {
    const patterns = generatePatterns(20, [7], [1])
    for (const p of patterns) {
      expect(p[0]).toBeLessThanOrEqual(1)
    }
  })

  it('returns all valid combinations for stock=10, pieces=[5,3]', () => {
    const patterns = generatePatterns(10, [5, 3])
    expect(patterns).toContainEqual([2, 0])
    expect(patterns).toContainEqual([1, 1])
  })

  it('always includes the all-zeros pattern for multi-piece input', () => {
    const patterns = generatePatterns(10, [5, 3])
    expect(patterns).toContainEqual([0, 0])
  })

  it('handles floating-point piece lengths', () => {
    const patterns = generatePatterns(10, [3.5])
    // can fit 2× 3.5 = 7 ≤ 10, but not 3× 10.5 > 10
    expect(patterns).toContainEqual([2])
    for (const p of patterns) {
      expect(p[0] * 3.5).toBeLessThanOrEqual(10 + 1e-9)
    }
  })

  it('does not include over-limit patterns in multi-piece case', () => {
    // stock=10, pieces=[5,3]: [1,2] = 5+6 = 11 > 10, must not be present
    const patterns = generatePatterns(10, [5, 3])
    expect(patterns).not.toContainEqual([1, 2])
  })
})

describe('optimize', () => {
  it('returns same result as ffd for trivial case', () => {
    const result = optimize([10], [5, 5])
    expect(result.boards.length).toBe(1)
    expect(result.timedOut).toBe(false)
  })

  it('result never exceeds ffd board count', () => {
    const pieces = [8, 8, 7, 7, 3.9, 5.9, 8.5, 4, 2]
    const ffdResult = ffd([10, 16], pieces)
    const result = optimize([10, 16], pieces)
    expect(result.boards.length).toBeLessThanOrEqual(ffdResult.length)
  })

  it('solves the design doc example optimally (4 boards)', () => {
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
    const allCuts = result.boards.flatMap(b => b.cuts).sort((a, b) => a - b)
    expect(allCuts).toEqual([...pieces].sort((a, b) => a - b))
  })

  it('consolidates waste into the largest possible scrap piece', () => {
    // Same pieces as the design doc example, different order — same result
    const pieces = [8, 8, 7, 7, 2, 4, 8.5, 5.9, 3.9]
    const result = optimize([10, 16], pieces)
    expect(result.boards.length).toBe(4)
    // Optimal: 16ft[8+8] + 16ft[7+7+2] + 16ft[8.5+3.9=12.4, waste=3.6] + 10ft[5.9+4=9.9]
    // Max scrap should be ~3.6ft, not a collection of tiny scraps
    const maxScrap = Math.max(...result.boards.map(b => b.waste))
    expect(maxScrap).toBeGreaterThan(3.4)
  })
})
