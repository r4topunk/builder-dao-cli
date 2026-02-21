import { describe, it, expect } from 'vitest'
import { resolveIpfsUrl } from '../../src/integrations/ipfs.js'

describe('resolveIpfsUrl', () => {
  it('converts ipfs:// URIs to gateway URLs', () => {
    const cid = 'QmXjkFQjnD8i8ntNd5MzPmFpL5Pk4mJHkS6xQkKJr1YFhH'
    const result = resolveIpfsUrl(`ipfs://${cid}`)
    expect(result).toBe(`https://ipfs.io/ipfs/${cid}`)
  })

  it('returns http URLs as-is', () => {
    const url = 'https://example.com/image.png'
    expect(resolveIpfsUrl(url)).toBe(url)
  })

  it('returns data URIs as-is', () => {
    const dataUri = 'data:image/svg+xml;base64,abc123'
    expect(resolveIpfsUrl(dataUri)).toBe(dataUri)
  })

  it('handles empty string', () => {
    expect(resolveIpfsUrl('')).toBe('')
  })
})
