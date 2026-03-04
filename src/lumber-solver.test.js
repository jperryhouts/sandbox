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
