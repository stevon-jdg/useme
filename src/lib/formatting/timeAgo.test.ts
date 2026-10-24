import { describe, expect, it } from 'vitest'
import { timeAgo } from './timeAgo'

const now = new Date('2026-10-24T12:00:00Z').getTime()
const ago = (ms: number) => new Date(now - ms).toISOString()

describe('timeAgo', () => {
  it('says just now', () => expect(timeAgo(ago(20_000), now)).toBe('just now'))
  it('counts minutes', () => expect(timeAgo(ago(5 * 60_000), now)).toBe('5 min ago'))
  it('counts hours', () => expect(timeAgo(ago(3 * 3_600_000), now)).toBe('3 h ago'))
  it('says yesterday', () => expect(timeAgo(ago(30 * 3_600_000), now)).toBe('yesterday'))
  it('counts days', () => expect(timeAgo(ago(3 * 86_400_000), now)).toBe('3 days ago'))
  it('never goes negative for a clock that is slightly ahead', () => expect(timeAgo(ago(-5000), now)).toBe('just now'))
})
