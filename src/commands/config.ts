import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { privateKeyToAccount } from 'viem/accounts'
import { formatEther } from 'viem'
import { getCli } from '../cli.js'
import { resolveChain, getRpcUrl } from '../config/index.js'
import { SUPPORTED_CHAINS, type ChainName } from '../config/chains.js'
import { getPublicClient } from '../core/client.js'
import { querySubgraph } from '../core/subgraph.js'
import { printKeyValue, printTable, type Column } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { truncateAddress, formatEth, formatNumber } from '../utils/format.js'
import { handleError, WalletNotConfiguredError } from '../utils/errors.js'

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

interface DaoTokenOwnerEntry {
  dao: { id: string; name: string; totalSupply: string }
  daoTokenCount: string
  delegate: string
}

interface WalletDaosResponse {
  daotokenOwners: DaoTokenOwnerEntry[]
}

cli.command('config wallet', 'Show wallet address, balance, and DAO memberships')
  .option('--chain, -c <chain>', 'Chain for ETH balance (default: BUILDER_CHAIN or base)')
  .option('--json, -j', 'JSON output')
  .action(async (options: { chain?: string; json?: boolean }) => {
    try {
      const key = process.env['PRIVATE_KEY']
      if (!key) throw new WalletNotConfiguredError()
      if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
        throw new Error('Invalid private key format. Must be 0x followed by 64 hex characters.')
      }

      const account = privateKeyToAccount(key as `0x${string}`)
      const address = account.address
      const chain = resolveChain(options.chain)
      const publicClient = getPublicClient(chain)

      const ethBalance = await publicClient.getBalance({ address })

      // Query all chains for DAO memberships
      const ownerLower = address.toLowerCase()
      const membershipQuery = `
        query WalletDaos($owner: String!) {
          daotokenOwners(
            where: { owner: $owner }
            orderBy: daoTokenCount
            orderDirection: desc
            first: 50
          ) {
            dao { id name totalSupply }
            daoTokenCount
            delegate
          }
        }
      `

      type ChainMembership = { chain: ChainName; daos: DaoTokenOwnerEntry[] }
      const results = await Promise.allSettled(
        SUPPORTED_CHAINS.map(async (c): Promise<ChainMembership> => {
          const data = await querySubgraph<WalletDaosResponse>(c, membershipQuery, { owner: ownerLower })
          return { chain: c, daos: data.daotokenOwners || [] }
        })
      )

      const memberships: ChainMembership[] = results
        .filter((r): r is PromiseFulfilledResult<ChainMembership> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(m => m.daos.length > 0)

      if (isJsonMode(options)) {
        printJson({
          address,
          chain,
          ethBalance: formatEther(ethBalance),
          memberships: memberships.flatMap(m =>
            m.daos.map(d => ({
              chain: m.chain,
              dao: d.dao.id,
              name: d.dao.name,
              tokens: Number(d.daoTokenCount),
              delegate: d.delegate,
              delegatingSelf: d.delegate.toLowerCase() === ownerLower,
            }))
          ),
        })
        return
      }

      console.log(`\nWallet: ${address}`)
      printKeyValue([
        ['Chain  ', chain],
        ['Balance', formatEth(ethBalance)],
      ])

      if (memberships.length === 0) {
        console.log('\nNo DAO memberships found across supported chains.')
      } else {
        console.log('\nDAO Memberships')

        const columns: Column[] = [
          { header: 'Chain', width: 10 },
          { header: 'DAO', width: 24 },
          { header: 'Tokens', width: 8, align: 'right' },
          { header: 'Delegate', width: 16 },
        ]

        const rows = memberships.flatMap(m =>
          m.daos.map(d => {
            const delegateDisplay = d.delegate.toLowerCase() === ownerLower ? 'self' : truncateAddress(d.delegate)
            return [
              m.chain,
              d.dao.name || truncateAddress(d.dao.id),
              String(d.daoTokenCount),
              delegateDisplay,
            ]
          })
        )

        printTable(columns, rows)
      }
      console.log()
    } catch (error) {
      handleError(error)
    }
  })
