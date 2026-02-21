import { describe, it, expect } from 'vitest'
import { LRUCache } from '../../src/utils/cache.js'

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string>(10, 60000)
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')
  })

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string>(10, 60000)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('evicts entries after TTL expires', async () => {
    const cache = new LRUCache<string>(10, 10)
    cache.set('key1', 'value1')
    expect(cache.get('key1')).toBe('value1')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(cache.get('key1')).toBeUndefined()
  })

  it('evicts LRU entries when at capacity', () => {
    const cache = new LRUCache<string>(2, 60000)
    cache.set('a', '1')
    cache.set('b', '2')
    cache.set('c', '3')
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe('2')
    expect(cache.get('c')).toBe('3')
  })
})
