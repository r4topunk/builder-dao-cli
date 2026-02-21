import { describe, it, expect } from 'vitest'
import { formatEth, truncateAddress, formatDuration, formatNumber } from '../../src/utils/format.js'

describe('formatEth', () => {
  it('formats wei to ETH', () => {
    expect(formatEth(1000000000000000000n)).toBe('1 ETH')
    expect(formatEth(42000000000000000n)).toBe('0.042 ETH')
    expect(formatEth(0n)).toBe('0 ETH')
  })
})

describe('truncateAddress', () => {
  it('truncates long addresses', () => {
    const addr = '0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17'
    const result = truncateAddress(addr)
    expect(result).toContain('...')
    expect(result.length).toBeLessThan(addr.length)
  })

  it('returns short strings as-is', () => {
    expect(truncateAddress('0x1234', 6)).toBe('0x1234')
  })
})

describe('formatDuration', () => {
  it('formats seconds into human readable', () => {
    expect(formatDuration(0)).toBe('< 1m')
    expect(formatDuration(-1)).toBe('ended')
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(86400)).toBe('1d')
    expect(formatDuration(90061)).toBe('1d 1h 1m')
  })
})

describe('formatNumber', () => {
  it('formats numbers with locale separator', () => {
    const result = formatNumber(1234)
    // toLocaleString uses system locale, so separator varies
    expect(result).toMatch(/1[.,]234/)
    const bigResult = formatNumber(1000000)
    expect(bigResult).toMatch(/1[.,]000[.,]000/)
  })
})
