/**
 * swap-to-eth.ts
 * Swaps all ERC20 tokens in the wallet to ETH via Uniswap v3 on Base.
 *
 * Usage: pnpm tsx scripts/swap-to-eth.ts
 *
 * Requires: PRIVATE_KEY in .env
 * Optional: ETHERSCAN_API_KEY (faster token discovery), BASE_RPC_URL
 */

import 'dotenv/config'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatEther,
  formatGwei,
  maxUint256,
} from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// ─── Config ─────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env['PRIVATE_KEY'] as `0x${string}`
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set in .env')

const account = privateKeyToAccount(PRIVATE_KEY)

const transport = http(process.env['BASE_RPC_URL'] ?? 'https://mainnet.base.org')

const publicClient = createPublicClient({ chain: base, transport })
const walletClient = createWalletClient({ account, chain: base, transport })

// Uniswap v3 on Base
const WETH        = '0x4200000000000000000000000000000000000006' as `0x${string}`
const SWAP_ROUTER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as `0x${string}` // SwapRouter02
const QUOTER_V2   = '0x3d4e44Eb1374240CE5F1B136Cf395a8B9974f378' as `0x${string}`
const FEE_TIERS   = [500, 3000, 10000] as const // 0.05%, 0.3%, 1%

// ─── ABIs ───────────────────────────────────────────────────────────────────

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
])

const quoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut)',
])

const wethAbi = parseAbi([
  'function withdraw(uint256 amount)',
  'function balanceOf(address) view returns (uint256)',
])

// ─── Token discovery ────────────────────────────────────────────────────────

interface TokenEntry {
  contractAddress: `0x${string}`
  tokenSymbol: string
}

/**
 * Priority 1: TOKENS env var with comma-separated contract addresses.
 * Example: TOKENS=0xABC...,0xDEF... pnpm tsx scripts/swap-to-eth.ts
 */
function getTokensFromEnv(): TokenEntry[] {
  const raw = process.env['TOKENS'] ?? ''
  if (!raw.trim()) return []
  return raw.split(',')
    .map(s => s.trim())
    .filter(s => /^0x[a-fA-F0-9]{40}$/.test(s))
    .map(addr => ({ contractAddress: addr as `0x${string}`, tokenSymbol: '?' }))
}

/** Priority 2: Alchemy API (getTokenBalances). */
async function getTokensFromAlchemy(): Promise<TokenEntry[]> {
  const apiKey = process.env['ALCHEMY_API_KEY'] ?? ''
  if (!apiKey) return []
  try {
    const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1, jsonrpc: '2.0', method: 'alchemy_getTokenBalances',
        params: [account.address, 'erc20'],
      }),
    })
    const data = await res.json() as { result?: { tokenBalances: Array<{ contractAddress: string; tokenBalance: string }> } }
    const nonZero = (data.result?.tokenBalances ?? []).filter(
      t => t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
    if (nonZero.length > 0) {
      console.log('Token source: Alchemy')
      return nonZero.map(t => ({ contractAddress: t.contractAddress as `0x${string}`, tokenSymbol: '?' }))
    }
  } catch { /* fall through */ }
  return []
}

/** Priority 3: Etherscan V2 API (requires paid plan for Base). */
async function getTokensFromEtherscan(): Promise<TokenEntry[]> {
  const apiKey = process.env['ETHERSCAN_API_KEY'] ?? process.env['BASESCAN_API_KEY'] ?? ''
  if (!apiKey) return []
  const url = `https://api.etherscan.io/v2/api?chainid=8453&module=account&action=tokenlist&address=${account.address}&apikey=${apiKey}`
  try {
    const res = await fetch(url)
    const data = await res.json() as { status: string; result: TokenEntry[] }
    if (data.status === '1' && Array.isArray(data.result)) {
      console.log('Token source: Etherscan V2')
      return data.result
    }
  } catch { /* fall through */ }
  return []
}

// ─── Swap logic ─────────────────────────────────────────────────────────────

async function getBestQuote(
  tokenIn: `0x${string}`,
  amountIn: bigint,
): Promise<{ fee: number; amountOut: bigint } | null> {
  let best: { fee: number; amountOut: bigint } | null = null
  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.readContract({
        abi: quoterAbi,
        address: QUOTER_V2,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut: WETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
      })
      const amountOut = (result as [bigint, ...unknown[]])[0]
      if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
        best = { fee, amountOut }
      }
    } catch { /* no pool at this fee tier */ }
  }
  return best
}

async function swapTokenToWeth(
  tokenAddress: `0x${string}`,
  symbol: string,
  balance: bigint,
): Promise<void> {
  console.log(`\n→ ${symbol} (${tokenAddress})`)

  const quote = await getBestQuote(tokenAddress, balance)
  if (!quote || quote.amountOut === 0n) {
    console.log('  ✗ No Uniswap v3 pool / no liquidity — skipping')
    return
  }

  console.log(`  Quote: ${parseFloat(formatEther(quote.amountOut)).toFixed(8)} ETH (fee ${quote.fee / 10000}%)`)

  // Approve if needed
  const allowance = await publicClient.readContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'allowance',
    args: [account.address, SWAP_ROUTER],
  }) as bigint

  if (allowance < balance) {
    process.stdout.write('  Approving... ')
    const tx = await walletClient.writeContract({
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'approve',
      args: [SWAP_ROUTER, maxUint256],
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })
    console.log('done')
  }

  // Swap
  process.stdout.write('  Swapping... ')
  const swapTx = await walletClient.writeContract({
    abi: swapRouterAbi,
    address: SWAP_ROUTER,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn:          tokenAddress,
      tokenOut:         WETH,
      fee:              quote.fee,
      recipient:        account.address,
      amountIn:         balance,
      amountOutMinimum: 0n, // dust — accept any output
      sqrtPriceLimitX96: 0n,
    }],
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx })
  console.log(receipt.status === 'success' ? '✓' : '✗ reverted')
  console.log(`  https://basescan.org/tx/${swapTx}`)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const [ethBefore, gasPrice] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.getGasPrice(),
  ])

  console.log(`Wallet    : ${account.address}`)
  console.log(`ETH       : ${parseFloat(formatEther(ethBefore)).toFixed(8)}`)
  console.log(`Gas price : ${formatGwei(gasPrice)} gwei`)

  // Each approve+swap costs roughly 200k gas
  const costPerToken = gasPrice * 200_000n
  const canAfford = ethBefore / costPerToken
  console.log(`Est. cost/token : ${parseFloat(formatEther(costPerToken)).toFixed(8)} ETH`)
  console.log(`Can afford      : ~${canAfford} token swap(s)`)

  if (canAfford === 0n) {
    console.error([
      '',
      '⚠️  Insufficient ETH for gas.',
      `   Send at least ${parseFloat(formatEther(costPerToken * 10n)).toFixed(6)} ETH to ${account.address}`,
      '   Then re-run this script.',
    ].join('\n'))
    process.exit(1)
  }
  console.log()

  // Discover tokens — priority: TOKENS env > Etherscan API
  let tokens = getTokensFromEnv()
  if (tokens.length > 0) {
    console.log(`Token source: TOKENS env (${tokens.length} addresses)`)
  } else {
    tokens = await getTokensFromAlchemy()
    if (tokens.length === 0) tokens = await getTokensFromEtherscan()
  }

  if (tokens.length === 0) {
    console.error([
      'No tokens found.',
      '',
      'Provide token contract addresses via TOKENS env var:',
      '  TOKENS=0xADDR1,0xADDR2 pnpm tsx scripts/swap-to-eth.ts',
      '',
      'Find addresses in your wallet app → each token → "View on Explorer".',
    ].join('\n'))
    process.exit(1)
  }

  console.log(`Found ${tokens.length} token contract(s)\n`)

  for (const token of tokens) {
    const addr = token.contractAddress
    if (addr.toLowerCase() === WETH.toLowerCase()) continue

    const balance = await publicClient.readContract({
      abi: erc20Abi,
      address: addr,
      functionName: 'balanceOf',
      args: [account.address],
    }) as bigint

    if (balance === 0n) continue

    try {
      await swapTokenToWeth(addr, token.tokenSymbol, balance)
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 150) : String(err)
      console.log(`  ✗ ${msg}`)
    }
  }

  // Unwrap accumulated WETH → ETH
  const wethBalance = await publicClient.readContract({
    abi: wethAbi,
    address: WETH,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint

  if (wethBalance > 0n) {
    process.stdout.write(`\nUnwrapping ${formatEther(wethBalance)} WETH → ETH... `)
    const tx = await walletClient.writeContract({
      abi: wethAbi,
      address: WETH,
      functionName: 'withdraw',
      args: [wethBalance],
    })
    await publicClient.waitForTransactionReceipt({ hash: tx })
    console.log('✓')
    console.log(`https://basescan.org/tx/${tx}`)
  } else {
    console.log('\nNo WETH to unwrap.')
  }

  const ethAfter = await publicClient.getBalance({ address: account.address })
  const diff = ethAfter - ethBefore
  console.log(`\nETH before : ${parseFloat(formatEther(ethBefore)).toFixed(8)}`)
  console.log(`ETH after  : ${parseFloat(formatEther(ethAfter)).toFixed(8)}`)
  console.log(`Net change : ${diff >= 0n ? '+' : ''}${parseFloat(formatEther(diff)).toFixed(8)} ETH`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
