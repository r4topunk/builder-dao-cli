import { keccak256, stringToHex } from 'viem'
import { getCli } from '../cli.js'
import { getDAOConfig, resolveAddressOrEns } from '../core/resolver.js'
import { getPublicClient, getWalletClient } from '../core/client.js'
import { querySubgraph } from '../core/subgraph.js'
import { governorAbi } from '../core/abis/governor.js'
import { auctionAbi } from '../core/abis/auction.js'
import { tokenAbi } from '../core/abis/token.js'
import { printKeyValue } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { formatEth, truncateAddress, formatTimeRemaining } from '../utils/format.js'
import { handleError, WalletNotConfiguredError } from '../utils/errors.js'
import { getExplorerTxUrl } from '../integrations/etherscan.js'
import { readFileSync } from 'fs'

const cli = getCli()

function getPrivateKey(flag?: string): `0x${string}` {
  const key = flag || process.env['PRIVATE_KEY']
  if (!key) throw new WalletNotConfiguredError()
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error('Invalid private key format. Must be 0x followed by 64 hex characters.')
  }
  return key as `0x${string}`
}

function parseSupport(support: string): number {
  switch (support.toLowerCase()) {
    case 'against': case '0': return 0
    case 'for':     case '1': return 1
    case 'abstain': case '2': return 2
    default: throw new Error(`Invalid support value "${support}". Use: for, against, abstain`)
  }
}

type WriteOptions = {
  token?: string
  chain?: string
  json?: boolean
  privateKey?: string
}

// ─── vote ──────────────────────────────────────────────────────────────────

cli.command('vote <proposalId> <support>', 'Cast a vote on a proposal')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--reason <text>', 'Vote reason')
  .option('--json, -j', 'JSON output')
  .option('--private-key <key>', 'Private key (prefer .env)')
  .action(async (proposalId: string, support: string, options: WriteOptions & { reason?: string }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const privateKey = getPrivateKey(options.privateKey)
      const supportNum = parseSupport(support)
      const supportLabel = ['AGAINST', 'FOR', 'ABSTAIN'][supportNum]!

      // Resolve proposal ID: if numeric, look up the bytes32 proposalId
      let proposalIdBytes: `0x${string}`
      if (proposalId.startsWith('0x')) {
        proposalIdBytes = proposalId as `0x${string}`
      } else {
        const { querySubgraph } = await import('../core/subgraph.js')
        const pData = await querySubgraph<{ proposals: Array<{ proposalId: string }> }>(
          daoConfig.chain,
          `query($dao: String!, $number: Int!) {
            proposals(where: { dao: $dao, proposalNumber: $number }, first: 1) { proposalId }
          }`,
          { dao: daoConfig.token.toLowerCase(), number: Number(proposalId) }
        )
        if (!pData.proposals?.[0]) throw new Error(`Proposal #${proposalId} not found`)
        proposalIdBytes = pData.proposals[0].proposalId as `0x${string}`
      }

      const walletClient = getWalletClient(daoConfig.chain, privateKey)
      const publicClient = getPublicClient(daoConfig.chain)
      const account = walletClient.account!

      const txHash = await walletClient.writeContract({
        abi: governorAbi,
        address: daoConfig.governor,
        functionName: options.reason ? 'castVoteWithReason' : 'castVote',
        args: options.reason
          ? [proposalIdBytes, BigInt(supportNum), options.reason]
          : [proposalIdBytes, BigInt(supportNum)],
        account,
        chain: walletClient.chain,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      const txUrl = getExplorerTxUrl(txHash, daoConfig.chain)

      if (isJsonMode(options)) {
        printJson({ txHash, status: receipt.status, proposalId: proposalIdBytes, support: supportLabel, reason: options.reason ?? null })
        return
      }

      console.log(`\nVoted ${supportLabel} on proposal #${proposalId}`)
      printKeyValue([
        ['Status', receipt.status === 'success' ? 'confirmed' : 'reverted'],
        ['Voter ', truncateAddress(account.address)],
        ['Tx    ', txUrl],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

// ─── propose ───────────────────────────────────────────────────────────────

interface ProposeFile {
  title: string
  description: string
  targets: string[]
  values: string[]
  calldatas: string[]
}

cli.command('propose', 'Create a governance proposal')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--title <text>', 'Proposal title')
  .option('--description <text>', 'Proposal description (or use --from)')
  .option('--target <address>', 'Target contract address')
  .option('--value <wei>', 'ETH value in wei', { default: '0' })
  .option('--calldata <hex>', 'Calldata hex', { default: '0x' })
  .option('--from <file>', 'Load proposal from JSON file')
  .option('--json, -j', 'JSON output')
  .option('--private-key <key>', 'Private key (prefer .env)')
  .action(async (options: WriteOptions & {
    title?: string
    description?: string
    target?: string
    value?: string
    calldata?: string
    from?: string
  }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const privateKey = getPrivateKey(options.privateKey)

      let targets: `0x${string}`[]
      let values: bigint[]
      let calldatas: `0x${string}`[]
      let description: string

      if (options.from) {
        const raw = JSON.parse(readFileSync(options.from, 'utf-8')) as ProposeFile
        targets = raw.targets as `0x${string}`[]
        values = raw.values.map(v => BigInt(v))
        calldatas = raw.calldatas as `0x${string}`[]
        const title = raw.title || options.title || ''
        description = title ? `${title}\n\n${raw.description}` : raw.description
      } else {
        if (!options.title) throw new Error('--title is required')
        if (!options.target) throw new Error('--target is required (use treasury address for ETH transfer)')
        targets = [options.target as `0x${string}`]
        values = [BigInt(options.value ?? '0')]
        calldatas = [(options.calldata ?? '0x') as `0x${string}`]
        description = options.description
          ? `${options.title}\n\n${options.description}`
          : options.title
      }

      const walletClient = getWalletClient(daoConfig.chain, privateKey)
      const publicClient = getPublicClient(daoConfig.chain)
      const account = walletClient.account!

      const txHash = await walletClient.writeContract({
        abi: governorAbi,
        address: daoConfig.governor,
        functionName: 'propose',
        args: [targets, values, calldatas, description],
        account,
        chain: walletClient.chain,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      const txUrl = getExplorerTxUrl(txHash, daoConfig.chain)

      if (isJsonMode(options)) {
        printJson({ txHash, status: receipt.status, description })
        return
      }

      console.log('\nProposal submitted')
      printKeyValue([
        ['Status   ', receipt.status === 'success' ? 'confirmed' : 'reverted'],
        ['Proposer ', truncateAddress(account.address)],
        ['Tx       ', txUrl],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

// ─── auction bid ───────────────────────────────────────────────────────────

cli.command('auction bid <amount>', 'Place a bid on the current auction')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .option('--private-key <key>', 'Private key (prefer .env)')
  .action(async (amount: string, options: WriteOptions) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const privateKey = getPrivateKey(options.privateKey)

      // Parse ETH amount to wei
      const amountWei = BigInt(Math.round(parseFloat(amount) * 1e18))
      if (amountWei <= 0n) throw new Error(`Invalid bid amount: ${amount}`)

      // Get current auction token ID
      const publicClient = getPublicClient(daoConfig.chain)
      const auctionData = await publicClient.readContract({
        abi: auctionAbi,
        address: daoConfig.auction,
        functionName: 'auction',
      }) as [bigint, bigint, `0x${string}`, number, number, boolean]

      const [tokenId, highestBid, , , endTime, settled] = auctionData

      if (settled) throw new Error('No active auction to bid on')
      if (Date.now() / 1000 > endTime) throw new Error('Auction has ended')
      if (amountWei <= highestBid) {
        throw new Error(`Bid must exceed current highest bid of ${formatEth(highestBid)}`)
      }

      const walletClient = getWalletClient(daoConfig.chain, privateKey)
      const account = walletClient.account!

      const txHash = await walletClient.writeContract({
        abi: auctionAbi,
        address: daoConfig.auction,
        functionName: 'createBid',
        args: [tokenId],
        value: amountWei,
        account,
        chain: walletClient.chain,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      const txUrl = getExplorerTxUrl(txHash, daoConfig.chain)

      if (isJsonMode(options)) {
        printJson({ txHash, status: receipt.status, tokenId: tokenId.toString(), amount: amountWei.toString() })
        return
      }

      console.log(`\nBid placed on Token #${tokenId}`)
      printKeyValue([
        ['Status', receipt.status === 'success' ? 'confirmed' : 'reverted'],
        ['Amount', formatEth(amountWei)],
        ['Bidder', truncateAddress(account.address)],
        ['Tx    ', txUrl],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

// ─── auction settle ────────────────────────────────────────────────────────

cli.command('auction settle', 'Settle ended auction and start a new one')
  .option('--token, -t <address>', 'Token address of the DAO')
  .option('--chain, -c <name>', 'Chain: ethereum, base, optimism, zora', { default: 'base' })
  .option('--json, -j', 'Output as JSON (for agents)')
  .option('--private-key <key>', 'Private key (prefer .env)')
  .action(async (options: WriteOptions) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const privateKey = getPrivateKey(options.privateKey)
      const publicClient = getPublicClient(daoConfig.chain)

      const auctionData = await publicClient.readContract({
        abi: auctionAbi,
        address: daoConfig.auction,
        functionName: 'auction',
      }) as [bigint, bigint, `0x${string}`, number, number, boolean]

      const [tokenId, , , , endTime, settled] = auctionData

      if (settled) throw new Error('Auction is already settled')
      const now = Math.floor(Date.now() / 1000)
      if (now < endTime) throw new Error(`Auction has not ended yet (${formatTimeRemaining(endTime)})`)

      const walletClient = getWalletClient(daoConfig.chain, privateKey)
      const account = walletClient.account!

      const txHash = await walletClient.writeContract({
        abi: auctionAbi,
        address: daoConfig.auction,
        functionName: 'settleCurrentAndCreateNewAuction',
        args: [],
        account,
        chain: walletClient.chain,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      const txUrl = getExplorerTxUrl(txHash, daoConfig.chain)

      if (isJsonMode(options)) {
        printJson({ txHash, status: receipt.status, settledTokenId: tokenId.toString() })
        return
      }

      console.log(`\nAuction settled — Token #${tokenId}`)
      printKeyValue([
        ['Status ', receipt.status === 'success' ? 'confirmed' : 'reverted'],
        ['Settler', truncateAddress(account.address)],
        ['Tx     ', txUrl],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

// ─── proposal queue ────────────────────────────────────────────────────────

async function resolveProposalIdBytes(
  id: string,
  daoConfig: { chain: string; token: string },
): Promise<`0x${string}`> {
  if (id.startsWith('0x')) return id as `0x${string}`
  const pData = await querySubgraph<{ proposals: Array<{ proposalId: string }> }>(
    daoConfig.chain,
    `query($dao: String!, $number: Int!) {
      proposals(where: { dao: $dao, proposalNumber: $number }, first: 1) { proposalId }
    }`,
    { dao: daoConfig.token.toLowerCase(), number: Number(id) },
  )
  if (!pData.proposals?.[0]) throw new Error(`Proposal #${id} not found`)
  return pData.proposals[0].proposalId as `0x${string}`
}

cli.command('proposal queue <id>', 'Queue a succeeded proposal for execution')
  .option('--token, -t <address>', 'Token address of the DAO')
  .option('--chain, -c <name>', 'Chain: ethereum, base, optimism, zora', { default: 'base' })
  .option('--json, -j', 'Output as JSON (for agents)')
  .option('--private-key <key>', 'Private key (prefer .env)')
  .action(async (id: string, options: WriteOptions) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const privateKey = getPrivateKey(options.privateKey)
      const proposalIdBytes = await resolveProposalIdBytes(id, daoConfig)

      const walletClient = getWalletClient(daoConfig.chain, privateKey)
      const publicClient = getPublicClient(daoConfig.chain)
      const account = walletClient.account!

      const txHash = await walletClient.writeContract({
        abi: governorAbi,
        address: daoConfig.governor,
        functionName: 'queue',
        args: [proposalIdBytes],
        account,
        chain: walletClient.chain,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      const txUrl = getExplorerTxUrl(txHash, daoConfig.chain)

      // Read eta after tx is confirmed
      const eta = await publicClient.readContract({
        abi: governorAbi,
        address: daoConfig.governor,
        functionName: 'proposalEta',
        args: [proposalIdBytes],
      })

      if (isJsonMode(options)) {
        printJson({ txHash, status: receipt.status, proposalId: proposalIdBytes, eta: eta.toString() })
        return
      }

      console.log(`\nProposal #${id} queued`)
      printKeyValue([
        ['Status     ', receipt.status === 'success' ? 'confirmed' : 'reverted'],
        ['Executable ', new Date(Number(eta) * 1000).toISOString()],
        ['Tx         ', txUrl],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

// ─── proposal execute ──────────────────────────────────────────────────────

interface ProposalExecData {
  proposalId: string
  proposer: string
  description: string
  targets: string[]
  values: string[]
  calldatas: string[]
}

cli.command('proposal execute <id>', 'Execute a queued proposal')
  .option('--token, -t <address>', 'Token address of the DAO')
  .option('--chain, -c <name>', 'Chain: ethereum, base, optimism, zora', { default: 'base' })
  .option('--json, -j', 'Output as JSON (for agents)')
  .option('--private-key <key>', 'Private key (prefer .env)')
  .action(async (id: string, options: WriteOptions) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const privateKey = getPrivateKey(options.privateKey)

      // Fetch full proposal data needed for execute()
      const query = id.startsWith('0x')
        ? `query($id: String!) {
            proposals(where: { proposalId: $id }, first: 1) {
              proposalId proposer description targets values calldatas
            }
          }`
        : `query($dao: String!, $number: Int!) {
            proposals(where: { dao: $dao, proposalNumber: $number }, first: 1) {
              proposalId proposer description targets values calldatas
            }
          }`

      const vars = id.startsWith('0x')
        ? { id }
        : { dao: daoConfig.token.toLowerCase(), number: Number(id) }

      const data = await querySubgraph<{ proposals: ProposalExecData[] }>(daoConfig.chain, query, vars)
      const proposal = data.proposals?.[0]
      if (!proposal) throw new Error(`Proposal #${id} not found`)

      const targets = proposal.targets as `0x${string}`[]
      const values = proposal.values.map(v => BigInt(v))
      const calldatas = proposal.calldatas as `0x${string}`[]
      const proposer = proposal.proposer as `0x${string}`
      const descriptionHash = keccak256(stringToHex(proposal.description)) as `0x${string}`

      const walletClient = getWalletClient(daoConfig.chain, privateKey)
      const publicClient = getPublicClient(daoConfig.chain)
      const account = walletClient.account!

      const txHash = await walletClient.writeContract({
        abi: governorAbi,
        address: daoConfig.governor,
        functionName: 'execute',
        args: [targets, values, calldatas, descriptionHash, proposer],
        account,
        chain: walletClient.chain,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      const txUrl = getExplorerTxUrl(txHash, daoConfig.chain)

      if (isJsonMode(options)) {
        printJson({ txHash, status: receipt.status, proposalId: proposal.proposalId })
        return
      }

      console.log(`\nProposal #${id} executed`)
      printKeyValue([
        ['Status  ', receipt.status === 'success' ? 'confirmed' : 'reverted'],
        ['Executor', truncateAddress(account.address)],
        ['Tx      ', txUrl],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

// ─── delegate ──────────────────────────────────────────────────────────────

cli.command('delegate <address>', 'Delegate voting power to an address')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .option('--private-key <key>', 'Private key (prefer .env)')
  .action(async (address: string, options: WriteOptions) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const privateKey = getPrivateKey(options.privateKey)
      const { resolveChain } = await import('../config/index.js')
      const chain = resolveChain(options.chain)
      const delegateTo = await resolveAddressOrEns(address, chain)

      const walletClient = getWalletClient(daoConfig.chain, privateKey)
      const publicClient = getPublicClient(daoConfig.chain)
      const account = walletClient.account!

      const txHash = await walletClient.writeContract({
        abi: tokenAbi,
        address: daoConfig.token,
        functionName: 'delegate',
        args: [delegateTo],
        account,
        chain: walletClient.chain,
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      const txUrl = getExplorerTxUrl(txHash, daoConfig.chain)

      if (isJsonMode(options)) {
        printJson({ txHash, status: receipt.status, delegatedTo: delegateTo })
        return
      }

      console.log('\nDelegation updated')
      printKeyValue([
        ['Status      ', receipt.status === 'success' ? 'confirmed' : 'reverted'],
        ['Delegated to', truncateAddress(delegateTo)],
        ['From        ', truncateAddress(account.address)],
        ['Tx          ', txUrl],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })
