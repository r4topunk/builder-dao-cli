import { base, mainnet, optimism, zora } from 'viem/chains'
import type { Chain } from 'viem'

export const SUPPORTED_CHAINS = ['ethereum', 'base', 'optimism', 'zora'] as const
export type ChainName = (typeof SUPPORTED_CHAINS)[number]

export interface ChainConfig {
  chain: Chain
  chainId: number
  managerAddress: `0x${string}`
  subgraphName: string
  explorerUrl: string
  explorerName: string
  rpcEnvVar: string
  defaultRpc: string
}

export const CHAIN_CONFIGS: Record<ChainName, ChainConfig> = {
  ethereum: {
    chain: mainnet,
    chainId: 1,
    managerAddress: '0xd310a3041dfcf14def5ccbc508668974b5da7174',
    subgraphName: 'nouns-builder-ethereum-mainnet',
    explorerUrl: 'https://etherscan.io',
    explorerName: 'Etherscan',
    rpcEnvVar: 'ETHEREUM_RPC_URL',
    defaultRpc: 'https://eth.llamarpc.com',
  },
  base: {
    chain: base,
    chainId: 8453,
    managerAddress: '0x3ac0e64fe2931f8e082c6bb29283540de9b5371c',
    subgraphName: 'nouns-builder-base-mainnet',
    explorerUrl: 'https://basescan.org',
    explorerName: 'Basescan',
    rpcEnvVar: 'BASE_RPC_URL',
    defaultRpc: 'https://mainnet.base.org',
  },
  optimism: {
    chain: optimism,
    chainId: 10,
    managerAddress: '0x3ac0e64fe2931f8e082c6bb29283540de9b5371c',
    subgraphName: 'nouns-builder-optimism-mainnet',
    explorerUrl: 'https://optimistic.etherscan.io',
    explorerName: 'Optimism Explorer',
    rpcEnvVar: 'OPTIMISM_RPC_URL',
    defaultRpc: 'https://mainnet.optimism.io',
  },
  zora: {
    chain: zora,
    chainId: 7777777,
    managerAddress: '0x3ac0e64fe2931f8e082c6bb29283540de9b5371c',
    subgraphName: 'nouns-builder-zora-mainnet',
    explorerUrl: 'https://explorer.zora.energy',
    explorerName: 'Zora Explorer',
    rpcEnvVar: 'ZORA_RPC_URL',
    defaultRpc: 'https://rpc.zora.energy',
  },
}

export function getChainConfig(chainName: ChainName): ChainConfig {
  return CHAIN_CONFIGS[chainName]
}

export function isValidChain(name: string): name is ChainName {
  return SUPPORTED_CHAINS.includes(name as ChainName)
}
