import { normalize } from 'viem/ens'
import { getEnsClient } from '../core/client.js'
import { LRUCache } from '../utils/cache.js'

const ensNameCache = new LRUCache<string | null>(500, 15 * 60 * 1000)
const ensAddressCache = new LRUCache<`0x${string}` | null>(500, 15 * 60 * 1000)

export async function resolveAddressToEns(address: string): Promise<string | null> {
  const lowerAddr = address.toLowerCase()
  const cached = ensNameCache.get(lowerAddr)
  if (cached !== undefined) return cached

  try {
    const client = getEnsClient()
    const name = await client.getEnsName({ address: address as `0x${string}` })
    ensNameCache.set(lowerAddr, name ?? null)
    return name ?? null
  } catch {
    ensNameCache.set(lowerAddr, null)
    return null
  }
}

export async function resolveEnsToAddress(name: string): Promise<`0x${string}` | null> {
  const key = name.toLowerCase()
  const cached = ensAddressCache.get(key)
  if (cached !== undefined) return cached

  try {
    const client = getEnsClient()
    const address = await client.getEnsAddress({ name: normalize(name) })
    ensAddressCache.set(key, address ?? null)
    return address ?? null
  } catch {
    ensAddressCache.set(key, null)
    return null
  }
}

export function formatAddressWithEns(
  address: string,
  ensName: string | null | undefined
): string {
  if (ensName) return `${ensName} (${address.slice(0, 6)}...${address.slice(-4)})`
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export async function batchResolveAddressToEns(
  addresses: string[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  await Promise.all(
    addresses.map(async (addr) => {
      const ens = await resolveAddressToEns(addr)
      results.set(addr.toLowerCase(), ens)
    })
  )
  return results
}
