import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem'
import { mainnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { type ChainName, getChainConfig, getRpcUrl } from '../config/index.js'

const clientCache = new Map<string, PublicClient>()

export function getPublicClient(chain: ChainName, rpcUrl?: string): PublicClient {
  const url = getRpcUrl(chain, rpcUrl)
  const cacheKey = `${chain}:${url}`

  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!
  }

  const chainConfig = getChainConfig(chain)
  const client = createPublicClient({
    chain: chainConfig.chain,
    transport: http(url),
  })

  clientCache.set(cacheKey, client)
  return client
}

export function getEnsClient(): PublicClient {
  const url = process.env['ETHEREUM_RPC_URL'] || 'https://eth.llamarpc.com'
  const cacheKey = `ens:${url}`

  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!
  }

  const client = createPublicClient({
    chain: mainnet,
    transport: http(url),
  })

  clientCache.set(cacheKey, client)
  return client
}

export function getWalletClient(chain: ChainName, privateKey: `0x${string}`, rpcUrl?: string): WalletClient {
  const url = getRpcUrl(chain, rpcUrl)
  const chainConfig = getChainConfig(chain)
  const account = privateKeyToAccount(privateKey)

  return createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(url),
  })
}
