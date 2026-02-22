/**
 * sell-zora-coins.ts
 * Sells all Zora Coins in the wallet via @zoralabs/coins-sdk.
 *
 * Usage: pnpm tsx scripts/sell-zora-coins.ts
 *
 * Requires in .env:
 *   NEW_PRIVATE_KEY   — wallet holding the coins
 *   ALCHEMY_API_KEY   — for token discovery
 */

import 'dotenv/config'
import { createPublicClient, createWalletClient, http, formatEther } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { tradeCoin, setApiKey, type TradeParameters } from '@zoralabs/coins-sdk'

const PRIVATE_KEY  = (process.env['NEW_PRIVATE_KEY'] ?? process.env['PRIVATE_KEY']) as `0x${string}`
const ALCHEMY_KEY  = process.env['ALCHEMY_API_KEY'] ?? '9mPnhlCSQ21svp3KNXUqIpDZGTJKebzB'
const ZORA_API_KEY = process.env['ZORA_API_KEY'] ?? 'zora_api_1828564696ec3a424bf2b58e29bb99094d861c16e9a115a4e46e4c9736df5086'

if (!PRIVATE_KEY) throw new Error('NEW_PRIVATE_KEY not set in .env')

setApiKey(ZORA_API_KEY)

const account = privateKeyToAccount(PRIVATE_KEY)
const rpcUrl  = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`

const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) })

// ─── Token discovery ─────────────────────────────────────────────────────────

async function getTokens(): Promise<`0x${string}`[]> {
  const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1, jsonrpc: '2.0',
      method: 'alchemy_getTokenBalances',
      params: [account.address, 'erc20'],
    }),
  })
  const data = await res.json() as any
  return (data.result?.tokenBalances ?? [])
    .filter((t: any) => t.tokenBalance !== '0x' + '0'.repeat(64))
    .map((t: any) => t.contractAddress as `0x${string}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const ethBefore = await publicClient.getBalance({ address: account.address })

  console.log('Wallet   :', account.address)
  console.log('ETH      :', parseFloat(formatEther(ethBefore)).toFixed(8))

  const tokens = await getTokens()
  console.log(`Tokens   : ${tokens.length} with non-zero balance\n`)

  let sold = 0
  let skipped = 0

  for (const tokenAddress of tokens) {
    process.stdout.write(`→ ${tokenAddress} ... `)

    try {
      const tradeParameters: TradeParameters = {
        sell: { type: 'erc20', address: tokenAddress },
        buy:  { type: 'eth' },
        amountIn: 0n, // will be overridden to full balance by SDK if 0, or we fetch it
        slippage: 0.05,
        sender: account.address,
        recipient: account.address,
      }

      // Fetch actual balance first
      const balRes = await publicClient.readContract({
        address: tokenAddress,
        abi: [{ name: 'balanceOf', type: 'function', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'balanceOf',
        args: [account.address],
      }) as bigint

      if (balRes === 0n) { console.log('skip (0 balance)'); skipped++; continue }

      tradeParameters.amountIn = balRes

      const receipt = await tradeCoin({
        tradeParameters,
        walletClient,
        account,
        publicClient,
        validateTransaction: true,
      })

      console.log(receipt.status === 'success' ? '✓' : '✗ reverted')
      if (receipt.status === 'success') sold++
      else skipped++
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 100) : String(err)
      // Only show non-quota errors; suppress "not a zora coin" noise
      if (!msg.includes('404') && !msg.includes('not found') && !msg.includes('No route')) {
        console.log(`✗ ${msg}`)
      } else {
        console.log('✗ not a Zora Coin')
      }
      skipped++
    }
  }

  const ethAfter = await publicClient.getBalance({ address: account.address })
  const diff = ethAfter - ethBefore

  console.log(`\nSold: ${sold} | Skipped: ${skipped}`)
  console.log(`ETH before : ${parseFloat(formatEther(ethBefore)).toFixed(8)}`)
  console.log(`ETH after  : ${parseFloat(formatEther(ethAfter)).toFixed(8)}`)
  console.log(`Net change : ${diff >= 0n ? '+' : ''}${parseFloat(formatEther(diff)).toFixed(8)} ETH`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
