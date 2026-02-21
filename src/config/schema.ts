import { z } from 'zod'
import { SUPPORTED_CHAINS } from './chains.js'

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

export const chainSchema = z.enum(SUPPORTED_CHAINS)

export const envConfigSchema = z.object({
  BUILDER_TOKEN_ADDRESS: addressSchema.optional(),
  BUILDER_CHAIN: chainSchema.optional(),
  BASE_RPC_URL: z.string().url().optional(),
  ETHEREUM_RPC_URL: z.string().url().optional(),
  OPTIMISM_RPC_URL: z.string().url().optional(),
  ZORA_RPC_URL: z.string().url().optional(),
  PRIVATE_KEY: z.string().optional(),
  ETHERSCAN_API_KEY: z.string().optional(),
  NEYNAR_API_KEY: z.string().optional(),
  GOLDSKY_PROJECT_ID: z.string().optional(),
})

export type EnvConfig = z.infer<typeof envConfigSchema>
