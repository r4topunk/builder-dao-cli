import { getCli } from '../cli.js'
import { resolveChain } from '../config/index.js'
import { getDAOConfig, resolveAddressOrEns } from '../core/resolver.js'
import { getPublicClient } from '../core/client.js'
import { querySubgraph } from '../core/subgraph.js'
import { tokenAbi } from '../core/abis/token.js'
import { printTable, printKeyValue, type Column } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { truncateAddress, formatNumber } from '../utils/format.js'
import { handleError } from '../utils/errors.js'

const cli = getCli()

interface MemberListResponse {
  daotokenOwners: Array<{
    owner: string
    delegate: string
    daoTokenCount: string
  }>
}

interface MemberTokensResponse {
  tokens: Array<{
    tokenId: string
  }>
}

cli.command('member list', 'List DAO members')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .option('--limit, -l <number>', 'Number of members', { default: 20 })
  .option('--skip <number>', 'Skip members', { default: 0 })
  .option('--sort <sort>', 'Sort by: tokens, votes', { default: 'tokens' })
  .action(async (options: { token?: string; chain?: string; json?: boolean; limit?: number; skip?: number; sort?: string }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const limit = Number(options.limit) || 20
      const skip = Number(options.skip) || 0

      const query = `
        query MemberList($dao: String!, $first: Int!, $skip: Int!) {
          daotokenOwners(
            where: { dao: $dao }
            orderBy: daoTokenCount
            orderDirection: desc
            first: $first
            skip: $skip
          ) {
            owner
            delegate
            daoTokenCount
          }
        }
      `

      const data = await querySubgraph<MemberListResponse>(daoConfig.chain, query, {
        dao: daoConfig.token.toLowerCase(),
        first: limit,
        skip,
      })

      const members = data.daotokenOwners || []

      if (isJsonMode(options)) {
        printJson(members)
        return
      }

      const columns: Column[] = [
        { header: 'Address', width: 16 },
        { header: 'Tokens', width: 8, align: 'right' },
        { header: 'Delegate', width: 16 },
      ]

      const rows = members.map(m => {
        const delegateDisplay = m.delegate.toLowerCase() === m.owner.toLowerCase() ? 'self' : truncateAddress(m.delegate)
        return [
          truncateAddress(m.owner),
          String(m.daoTokenCount),
          delegateDisplay,
        ]
      })

      printTable(columns, rows)
    } catch (error) {
      handleError(error)
    }
  })

cli.command('member info <address>', 'Show member information')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .action(async (address: string, options: { token?: string; chain?: string; json?: boolean }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const chain = resolveChain(options.chain)
      const publicClient = getPublicClient(daoConfig.chain)
      const memberAddress = await resolveAddressOrEns(address, chain)

      const [balance, votes, delegate] = await Promise.all([
        publicClient.readContract({
          abi: tokenAbi,
          address: daoConfig.token,
          functionName: 'balanceOf',
          args: [memberAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          abi: tokenAbi,
          address: daoConfig.token,
          functionName: 'getVotes',
          args: [memberAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          abi: tokenAbi,
          address: daoConfig.token,
          functionName: 'delegates',
          args: [memberAddress],
        }) as Promise<`0x${string}`>,
      ])

      const tokenQuery = `
        query MemberTokens($dao: String!, $owner: String!) {
          tokens(where: { dao: $dao, owner: $owner }) {
            tokenId
          }
        }
      `

      const tokenData = await querySubgraph<MemberTokensResponse>(daoConfig.chain, tokenQuery, {
        dao: daoConfig.token.toLowerCase(),
        owner: memberAddress.toLowerCase(),
      })

      const tokenIds = (tokenData.tokens || []).map(t => t.tokenId)

      if (isJsonMode(options)) {
        printJson({
          address: memberAddress,
          balance: Number(balance),
          votes: Number(votes),
          delegate,
          delegatingSelf: delegate.toLowerCase() === memberAddress.toLowerCase(),
          tokenIds,
        })
        return
      }

      const isSelf = delegate.toLowerCase() === memberAddress.toLowerCase()
      const delegateDisplay = isSelf ? 'self' : truncateAddress(delegate)
      const tokensDisplay = tokenIds.length > 0 ? `${tokenIds.length} (#${tokenIds.join(', #')})` : '0'

      console.log(`\nMember: ${truncateAddress(memberAddress)}`)
      printKeyValue([
        ['Tokens       ', tokensDisplay],
        ['Votes        ', formatNumber(Number(votes))],
        ['Delegating to', delegateDisplay],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })
