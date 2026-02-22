/**
 * migrate-tokens.ts
 * 1. Revokes EIP-7702 delegation from OLD wallet (sponsor pays gas)
 * 2. Sponsor funds OLD wallet with ETH for token transfer gas
 * 3. Transfers all ERC20 tokens from OLD → NEW wallet
 * 4. Funds NEW wallet with ETH for swap gas
 *
 * Usage: pnpm tsx scripts/migrate-tokens.ts
 *
 * Requires in .env:
 *   PRIVATE_KEY         — old/compromised wallet (has the tokens)
 *   SPONSOR_PRIVATE_KEY — wallet with ETH (r4to.base.eth)
 *   NEW_PRIVATE_KEY     — new wallet to receive tokens
 */

import 'dotenv/config'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  formatEther,
  parseEther,
  maxUint256,
} from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const OLD_KEY  = process.env['PRIVATE_KEY']       as `0x${string}`
const SPON_KEY = process.env['SPONSOR_PRIVATE_KEY'] as `0x${string}`
const NEW_KEY  = process.env['NEW_PRIVATE_KEY']    as `0x${string}`
if (!OLD_KEY || !SPON_KEY || !NEW_KEY) throw new Error('Missing keys in .env')

const oldAccount  = privateKeyToAccount(OLD_KEY)
const sponsorAccount = privateKeyToAccount(SPON_KEY)
const newAccount  = privateKeyToAccount(NEW_KEY)

const ALCHEMY_KEY = '9mPnhlCSQ21svp3KNXUqIpDZGTJKebzB'

const transport = http('https://mainnet.base.org')
const publicClient  = createPublicClient({ chain: base, transport })
const oldClient     = createWalletClient({ account: oldAccount,     chain: base, transport })
const sponsorClient = createWalletClient({ account: sponsorAccount, chain: base, transport })

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
])

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getTokensFromAlchemy(address: `0x${string}`) {
  const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1, jsonrpc: '2.0', method: 'alchemy_getTokenBalances',
      params: [address, 'erc20'],
    }),
  })
  const data = await res.json() as any
  return (data.result?.tokenBalances ?? []).filter(
    (t: any) => t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) as Array<{ contractAddress: `0x${string}`; tokenBalance: string }>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Old wallet  :', oldAccount.address)
  console.log('Sponsor     :', sponsorAccount.address)
  console.log('New wallet  :', newAccount.address)

  const [oldBal, sponsorBal, code] = await Promise.all([
    publicClient.getBalance({ address: oldAccount.address }),
    publicClient.getBalance({ address: sponsorAccount.address }),
    publicClient.getCode({ address: oldAccount.address }),
  ])
  console.log('\nOld balance :', formatEther(oldBal), 'ETH')
  console.log('Sponsor bal :', formatEther(sponsorBal), 'ETH')
  console.log('Code        :', code ?? '0x (none)')

  // ── Step 1: Skip revocation ───────────────────────────────────────────────
  // EIP-7702 only affects INCOMING ETH (receive() hook).
  // Outgoing ERC20 transfers are unaffected — we can still sign them.
  console.log('\n[1/4] Skipping EIP-7702 revocation (not needed for outgoing transfers)')

  // ── Step 2: Skip ETH funding to old wallet ───────────────────────────────
  // Sending ETH to old wallet would trigger the sweep. Use existing balance.
  const gasPrice = await publicClient.getGasPrice()
  const canAfford = oldBal / (gasPrice * 65_000n)
  console.log(`\n[2/4] Using existing gas: ${formatEther(oldBal)} ETH (~${canAfford} transfers)`)

  // ── Step 3: Transfer all tokens to new wallet ─────────────────────────────
  console.log('\n[3/4] Discovering and transferring tokens...')
  const tokens = await getTokensFromAlchemy(oldAccount.address)
  console.log(`  Found ${tokens.length} tokens with non-zero balance`)

  let transferred = 0
  let skipped = 0

  for (const token of tokens) {
    const addr = token.contractAddress

    // Re-check live balance (in case something changed)
    let balance: bigint
    let symbol: string
    try {
      ;[balance, symbol] = await Promise.all([
        publicClient.readContract({ abi: erc20Abi, address: addr, functionName: 'balanceOf', args: [oldAccount.address] }) as Promise<bigint>,
        publicClient.readContract({ abi: erc20Abi, address: addr, functionName: 'symbol' }) as Promise<string>,
      ])
    } catch {
      balance = 0n
      symbol = '?'
    }

    if (balance === 0n) { skipped++; continue }

    process.stdout.write(`  ${symbol.padEnd(12)} ${addr} ... `)
    try {
      const tx = await oldClient.writeContract({
        abi: erc20Abi,
        address: addr,
        functionName: 'transfer',
        args: [newAccount.address, balance],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })
      console.log('✓')
      transferred++
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 80) : String(err)
      console.log(`✗ ${msg}`)
      skipped++
    }

    // Check remaining gas
    const remainingBal = await publicClient.getBalance({ address: oldAccount.address })
    const gasPrice = await publicClient.getGasPrice()
    const remainingTxs = remainingBal / (gasPrice * 65_000n)
    if (remainingTxs < 2n) {
      console.log('\n  ⚠ Gas running low — stopping early')
      break
    }
  }

  console.log(`\n  Transferred: ${transferred} | Skipped: ${skipped}`)

  // ── Step 4: Fund new wallet for swap gas ──────────────────────────────────
  console.log('\n[4/4] Funding new wallet for swap gas...')
  const SWAP_GAS = parseEther('0.001')
  const swapGasTx = await sponsorClient.sendTransaction({
    to: newAccount.address,
    value: SWAP_GAS,
  })
  await publicClient.waitForTransactionReceipt({ hash: swapGasTx })
  const newWalletBal = await publicClient.getBalance({ address: newAccount.address })
  console.log('  ✓ New wallet balance:', formatEther(newWalletBal), 'ETH')

  console.log('\n✓ Migration complete.')
  console.log(`  New wallet: ${newAccount.address}`)
  console.log('\nNext step: PRIVATE_KEY=$NEW_PRIVATE_KEY pnpm tsx scripts/swap-to-eth.ts')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
