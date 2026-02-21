import { describe, it, expect } from 'vitest'
import { getExplorerTxUrl, getExplorerAddressUrl, getExplorerBaseUrl } from '../../src/integrations/etherscan.js'

describe('etherscan URL helpers', () => {
  it('generates correct base URLs per chain', () => {
    expect(getExplorerBaseUrl('ethereum')).toBe('https://etherscan.io')
    expect(getExplorerBaseUrl('base')).toBe('https://basescan.org')
    expect(getExplorerBaseUrl('optimism')).toBe('https://optimistic.etherscan.io')
    expect(getExplorerBaseUrl('zora')).toBe('https://explorer.zora.energy')
  })

  it('generates correct tx URLs', () => {
    const hash = '0xabcdef1234567890'
    expect(getExplorerTxUrl(hash, 'base')).toBe(`https://basescan.org/tx/${hash}`)
    expect(getExplorerTxUrl(hash, 'ethereum')).toBe(`https://etherscan.io/tx/${hash}`)
  })

  it('generates correct address URLs', () => {
    const addr = '0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17'
    expect(getExplorerAddressUrl(addr, 'base')).toBe(`https://basescan.org/address/${addr}`)
  })
})
