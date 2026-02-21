import { getCli } from '../cli.js'
import { getDAOConfig } from '../core/resolver.js'
import { getPublicClient } from '../core/client.js'
import { querySubgraph } from '../core/subgraph.js'
import { auctionAbi } from '../core/abis/auction.js'
import { printTable, printKeyValue, type Column } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { formatEth, truncateAddress, formatTimeRemaining } from '../utils/format.js'
import { handleError } from '../utils/errors.js'

const cli = getCli()

cli.command('auction current', 'Show current auction')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .action(async (options: { token?: string; chain?: string; json?: boolean }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const publicClient = getPublicClient(daoConfig.chain)

      const auctionData = await publicClient.readContract({
        abi: auctionAbi,
        address: daoConfig.auction,
        functionName: 'auction',
      }) as [bigint, bigint, `0x${string}`, number, number, boolean]

      const [tokenId, highestBid, highestBidder, startTime, endTime, settled] = auctionData

      if (isJsonMode(options)) {
        printJson({
          tokenId: tokenId.toString(),
          highestBid: highestBid.toString(),
          highestBidder,
          startTime: Number(startTime),
          endTime: Number(endTime),
          settled,
        })
        return
      }

      if (settled) {
        console.log('\nNo active auction')
        console.log()
        return
      }

      console.log(`\nToken #${tokenId} — Current Auction`)
      const bidderDisplay = highestBid === 0n ? 'none' : `${formatEth(highestBid)} (${truncateAddress(highestBidder)})`
      printKeyValue([
        ['Highest Bid', bidderDisplay],
        ['Ends       ', formatTimeRemaining(Number(endTime))],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

interface AuctionHistoryResponse {
  auctions: Array<{
    token: { tokenId: string }
    highestBid: { amount: string; bidder: string } | null
    winningBid: { amount: string; bidder: string } | null
    endTime: string
  }>
}

cli.command('auction history', 'Show auction history')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .option('--limit, -l <number>', 'Number of auctions', { default: 20 })
  .action(async (options: { token?: string; chain?: string; json?: boolean; limit?: number }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const limit = Number(options.limit) || 20

      const query = `
        query AuctionHistory($dao: String!, $first: Int!) {
          auctions(
            where: { dao: $dao, settled: true }
            orderBy: endTime
            orderDirection: desc
            first: $first
          ) {
            token {
              tokenId
            }
            highestBid {
              amount
              bidder
            }
            winningBid {
              amount
              bidder
            }
            endTime
          }
        }
      `

      const data = await querySubgraph<AuctionHistoryResponse>(daoConfig.chain, query, {
        dao: daoConfig.token.toLowerCase(),
        first: limit,
      })

      const auctions = data.auctions || []

      if (isJsonMode(options)) {
        printJson(auctions)
        return
      }

      const columns: Column[] = [
        { header: 'Token', width: 8, align: 'right' },
        { header: 'Winner', width: 16 },
        { header: 'Price', width: 14 },
        { header: 'Date', width: 12 },
      ]

      const rows = auctions.map(a => {
        const bid = a.winningBid || a.highestBid
        const winner = bid ? truncateAddress(bid.bidder) : 'none'
        const price = bid ? formatEth(BigInt(bid.amount)) : '0 ETH'
        const date = new Date(Number(a.endTime) * 1000).toISOString().slice(0, 10)
        return [a.token.tokenId, winner, price, date]
      })

      printTable(columns, rows)
    } catch (error) {
      handleError(error)
    }
  })
