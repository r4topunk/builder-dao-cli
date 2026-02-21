import { getCli } from '../cli.js'
import { resolveChain } from '../config/index.js'
import { getDAOConfig, resolveAddressOrEns, resolveDAOAddresses } from '../core/resolver.js'
import { getPublicClient } from '../core/client.js'
import { querySubgraph } from '../core/subgraph.js'
import { tokenAbi } from '../core/abis/token.js'
import { printKeyValue } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { truncateAddress, formatNumber } from '../utils/format.js'
import { handleError } from '../utils/errors.js'

const cli = getCli()

interface DaoInfoResponse {
  dao: {
    name: string
    totalSupply: string
    ownerCount: string
    totalAuctionSales: string
  } | null
}

cli.command('dao info', 'Show DAO information')
  .option('--token, -t <address>', 'Token address of the DAO')
  .option('--chain, -c <chain>', 'Chain: ethereum, base, optimism, zora', { default: 'base' })
  .option('--json, -j', 'Output as JSON')
  .action(async (options: { token?: string; chain?: string; json?: boolean }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const publicClient = getPublicClient(daoConfig.chain)

      const query = `
        query DaoInfo($id: ID!) {
          dao(id: $id) {
            name
            totalSupply
            ownerCount
            totalAuctionSales
          }
        }
      `

      const [subgraphData, name, symbol] = await Promise.all([
        querySubgraph<DaoInfoResponse>(daoConfig.chain, query, {
          id: daoConfig.token.toLowerCase(),
        }),
        publicClient.readContract({
          abi: tokenAbi,
          address: daoConfig.token,
          functionName: 'name',
        }) as Promise<string>,
        publicClient.readContract({
          abi: tokenAbi,
          address: daoConfig.token,
          functionName: 'symbol',
        }) as Promise<string>,
      ])

      const totalSupply = subgraphData.dao ? Number(subgraphData.dao.totalSupply) : 0
      const ownerCount = subgraphData.dao ? Number(subgraphData.dao.ownerCount) : 0

      if (isJsonMode(options)) {
        printJson({
          chain: daoConfig.chain,
          chainId: daoConfig.chainConfig.chainId,
          token: daoConfig.token,
          auction: daoConfig.auction,
          governor: daoConfig.governor,
          treasury: daoConfig.treasury,
          metadata: daoConfig.metadata,
          name,
          symbol,
          totalSupply,
          ownerCount,
        })
        return
      }

      const daoName = subgraphData.dao?.name || name
      console.log(`\n${daoName} DAO (${daoConfig.chain})`)
      printKeyValue([
        ['Token   ', truncateAddress(daoConfig.token)],
        ['Auction ', truncateAddress(daoConfig.auction)],
        ['Governor', truncateAddress(daoConfig.governor)],
        ['Treasury', truncateAddress(daoConfig.treasury)],
        ['Metadata', truncateAddress(daoConfig.metadata)],
        ['Name    ', name],
        ['Symbol  ', symbol],
        ['Supply  ', formatNumber(totalSupply)],
        ['Owners  ', formatNumber(ownerCount)],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

cli.command('discover <token>', 'Discover DAO contracts from token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .action(async (token: string, options: { chain?: string; json?: boolean }) => {
    try {
      const chain = resolveChain(options.chain)
      const tokenAddress = await resolveAddressOrEns(token, chain)
      const daoConfig = await resolveDAOAddresses(tokenAddress, chain)

      if (isJsonMode(options)) {
        printJson({
          chain: daoConfig.chain,
          chainId: daoConfig.chainConfig.chainId,
          token: daoConfig.token,
          auction: daoConfig.auction,
          governor: daoConfig.governor,
          treasury: daoConfig.treasury,
          metadata: daoConfig.metadata,
        })
        return
      }

      console.log(`\nDAO Contracts (${chain})`)
      printKeyValue([
        ['Token   ', daoConfig.token],
        ['Auction ', daoConfig.auction],
        ['Governor', daoConfig.governor],
        ['Treasury', daoConfig.treasury],
        ['Metadata', daoConfig.metadata],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })
