import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getCli } from '../cli.js'
import { resolveChain, getRpcUrl } from '../config/index.js'
import { printKeyValue } from '../output/table.js'
import { truncateAddress } from '../utils/format.js'
import { handleError } from '../utils/errors.js'

const cli = getCli()

const ENV_EXAMPLE = `# builder-dao-cli config
BUILDER_TOKEN_ADDRESS=
BUILDER_CHAIN=base
BASE_RPC_URL=
ETHEREUM_RPC_URL=
PRIVATE_KEY=
ETHERSCAN_API_KEY=
NEYNAR_API_KEY=
GOLDSKY_PROJECT_ID=project_cm33ek8kjx6pz010i2c3w8z25
`

cli.command('config init', 'Create .env.example file')
  .action(async () => {
    try {
      const filePath = join(process.cwd(), '.env.example')
      if (existsSync(filePath)) {
        console.log('.env.example already exists')
        return
      }
      writeFileSync(filePath, ENV_EXAMPLE)
      console.log('Created .env.example')
    } catch (error) {
      handleError(error)
    }
  })

cli.command('config show', 'Show current configuration')
  .action(async () => {
    try {
      const token = process.env['BUILDER_TOKEN_ADDRESS']
      const chain = resolveChain(process.env['BUILDER_CHAIN'])
      const rpcUrl = getRpcUrl(chain)
      const hasWallet = !!process.env['PRIVATE_KEY']
      const hasEtherscan = !!process.env['ETHERSCAN_API_KEY']
      const hasNeynar = !!process.env['NEYNAR_API_KEY']

      console.log('\nCurrent Configuration')
      printKeyValue([
        ['Token    ', token ? `${truncateAddress(token)} (from BUILDER_TOKEN_ADDRESS)` : 'not configured'],
        ['Chain    ', `${chain} (from BUILDER_CHAIN)`],
        ['RPC      ', rpcUrl],
        ['Wallet   ', hasWallet ? 'configured' : 'not configured'],
        ['Etherscan', hasEtherscan ? 'configured' : 'not configured'],
        ['Farcaster', hasNeynar ? 'configured' : 'not configured'],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })
