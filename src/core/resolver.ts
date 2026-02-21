import { getPublicClient, getEnsClient } from './client.js'
import { managerAbi } from './abis/manager.js'
import { type ChainName, getChainConfig, type DAOConfig, resolveChain } from '../config/index.js'
import { normalize } from 'viem/ens'

export async function resolveDAOAddresses(
  tokenAddress: `0x${string}`,
  chain: ChainName,
  rpcUrl?: string
): Promise<DAOConfig> {
  const client = getPublicClient(chain, rpcUrl)
  const chainConfig = getChainConfig(chain)

  try {
    const [metadata, auction, treasury, governor] = await client.readContract({
      abi: managerAbi,
      address: chainConfig.managerAddress,
      functionName: 'getAddresses',
      args: [tokenAddress],
    }) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`]

    const zeroAddress = '0x0000000000000000000000000000000000000000'
    if (metadata === zeroAddress && auction === zeroAddress) {
      throw new Error(`No DAO found at ${tokenAddress} on ${chain}`)
    }

    return {
      token: tokenAddress,
      auction,
      governor,
      treasury,
      metadata,
      chain,
      chainConfig,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('No DAO found')) {
      throw error
    }
    throw new Error(`Failed to resolve DAO at ${tokenAddress} on ${chain}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function resolveAddressOrEns(
  input: string,
  chain: ChainName
): Promise<`0x${string}`> {
  if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
    return input as `0x${string}`
  }

  if (input.includes('.')) {
    const ensClient = getEnsClient()
    try {
      const address = await ensClient.getEnsAddress({ name: normalize(input) })
      if (!address) throw new Error(`ENS name ${input} not found`)
      return address
    } catch {
      throw new Error(`Failed to resolve ENS name: ${input}`)
    }
  }

  throw new Error(`Invalid address or ENS name: ${input}`)
}

export async function getDAOConfig(opts: {
  token?: string
  chain?: string
  rpc?: string
}): Promise<DAOConfig> {
  const chain = resolveChain(opts.chain)

  let tokenAddress: `0x${string}`

  if (opts.token) {
    tokenAddress = await resolveAddressOrEns(opts.token, chain)
  } else {
    const defaultToken = process.env['BUILDER_TOKEN_ADDRESS']
    if (!defaultToken) {
      throw new Error('No token address provided. Use --token 0x... or set BUILDER_TOKEN_ADDRESS in .env')
    }
    tokenAddress = defaultToken as `0x${string}`
  }

  return resolveDAOAddresses(tokenAddress, chain, opts.rpc)
}
