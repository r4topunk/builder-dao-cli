import 'dotenv/config'
import { type ChainName, isValidChain, getChainConfig, type ChainConfig } from './chains.js'
import { envConfigSchema } from './schema.js'

export interface DAOConfig {
  token: `0x${string}`
  auction: `0x${string}`
  governor: `0x${string}`
  treasury: `0x${string}`
  metadata: `0x${string}`
  chain: ChainName
  chainConfig: ChainConfig
}

export interface GlobalOptions {
  token?: string
  chain?: string
  json?: boolean
  quiet?: boolean
  rpc?: string
}

const parsed = envConfigSchema.safeParse(process.env)
export const env = parsed.success ? parsed.data : {}

export function getDefaultChain(): ChainName {
  const chainEnv = process.env['BUILDER_CHAIN']
  if (chainEnv && isValidChain(chainEnv)) return chainEnv
  return 'base'
}

export function getDefaultToken(): `0x${string}` | undefined {
  const token = process.env['BUILDER_TOKEN_ADDRESS']
  if (token && /^0x[a-fA-F0-9]{40}$/.test(token)) return token as `0x${string}`
  return undefined
}

export function resolveChain(flagChain?: string): ChainName {
  if (flagChain && isValidChain(flagChain)) return flagChain
  return getDefaultChain()
}

export function resolveToken(flagToken?: string): `0x${string}` | undefined {
  if (flagToken && /^0x[a-fA-F0-9]{40}$/.test(flagToken)) return flagToken as `0x${string}`
  return getDefaultToken()
}

export function getGoldskyProjectId(): string {
  return process.env['GOLDSKY_PROJECT_ID'] || 'project_cm33ek8kjx6pz010i2c3w8z25'
}

export function getRpcUrl(chain: ChainName, flagRpc?: string): string {
  if (flagRpc) return flagRpc
  const chainConfig = getChainConfig(chain)
  return process.env[chainConfig.rpcEnvVar] || chainConfig.defaultRpc
}

export { getChainConfig, isValidChain, type ChainName, type ChainConfig }
