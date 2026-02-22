/**
 * revoke-7702.ts
 * Revokes an EIP-7702 delegation from a wallet by setting the delegate to 0x000...000.
 *
 * Usage: pnpm tsx scripts/revoke-7702.ts
 *
 * Requires in .env:
 *   PRIVATE_KEY      — wallet whose delegation will be revoked (signs the authorization)
 *   SPONSOR_PRIVATE_KEY — wallet that pays the gas (needs ETH on Base)
 */

import 'dotenv/config'
import { createWalletClient, createPublicClient, http, formatEther } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const PRIVATE_KEY = process.env['PRIVATE_KEY'] as `0x${string}`
const SPONSOR_KEY = process.env['SPONSOR_PRIVATE_KEY'] as `0x${string}`
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set')
if (!SPONSOR_KEY) throw new Error('SPONSOR_PRIVATE_KEY not set')

const sweepAccount = privateKeyToAccount(PRIVATE_KEY)
const sponsorAccount = privateKeyToAccount(SPONSOR_KEY)

const transport = http(process.env['BASE_RPC_URL'] ?? 'https://mainnet.base.org')

const publicClient = createPublicClient({ chain: base, transport })

const sweepClient = createWalletClient({ account: sweepAccount, chain: base, transport })
const sponsorClient = createWalletClient({ account: sponsorAccount, chain: base, transport })

async function main() {
  console.log('Sweep wallet  :', sweepAccount.address)
  console.log('Sponsor wallet:', sponsorAccount.address)

  const [sweepBal, sponsorBal, code] = await Promise.all([
    publicClient.getBalance({ address: sweepAccount.address }),
    publicClient.getBalance({ address: sponsorAccount.address }),
    publicClient.getCode({ address: sweepAccount.address }),
  ])

  console.log('Sweep balance :', formatEther(sweepBal), 'ETH')
  console.log('Sponsor balance:', formatEther(sponsorBal), 'ETH')
  console.log('Current code  :', code ?? '0x (none)')

  if (!code || code === '0x') {
    console.log('\nNo EIP-7702 delegation found — nothing to revoke.')
    return
  }

  if (!code.startsWith('0xef0100')) {
    console.log('\nCode is not an EIP-7702 delegation. Aborting.')
    return
  }

  const delegateAddr = '0x' + code.slice(8)
  console.log('\nCurrent delegate:', delegateAddr)
  console.log('Revoking → 0x0000000000000000000000000000000000000000')

  // Step 1: sweep wallet signs authorization for zero address (= revoke)
  console.log('\nSigning revocation authorization...')
  const authorization = await sweepClient.signAuthorization({
    contractAddress: '0x0000000000000000000000000000000000000000',
  })
  console.log('Authorization signed. nonce:', authorization.nonce)

  // Step 2: sponsor sends the type-0x04 tx with that authorization
  console.log('Sending EIP-7702 revocation tx from sponsor...')
  const hash = await sponsorClient.sendTransaction({
    authorizationList: [authorization],
    to: sweepAccount.address,
    value: 0n,
    data: '0x',
  })

  console.log('Tx sent:', hash)
  console.log('Waiting for confirmation...')
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Status:', receipt.status)

  // Verify
  const newCode = await publicClient.getCode({ address: sweepAccount.address })
  console.log('\nNew code:', newCode ?? '0x (none)')
  if (!newCode || newCode === '0x') {
    console.log('✓ Delegation revoked — wallet is now a normal EOA.')
  } else {
    console.log('✗ Code still present:', newCode)
  }

  console.log(`\nhttps://basescan.org/tx/${hash}`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
