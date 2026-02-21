import { getCli } from '../cli.js'
import { getDAOConfig } from '../core/resolver.js'
import { querySubgraph } from '../core/subgraph.js'
import { printTable, printKeyValue, type Column } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { truncateAddress, formatTimestamp } from '../utils/format.js'
import { handleError } from '../utils/errors.js'

const cli = getCli()

interface ProposalRaw {
  proposalId: string
  proposalNumber: number
  title: string
  description?: string
  proposer: string
  forVotes: string
  againstVotes: string
  abstainVotes: string
  quorumVotes: string
  canceled: boolean
  executed: boolean
  vetoed: boolean
  voteStart: string
  voteEnd: string
  timeCreated: string
  executableFrom?: string
  expiresAt?: string
  targets?: string[]
  values?: string[]
  calldatas?: string[]
}

interface ProposalListResponse {
  proposals: ProposalRaw[]
}

interface ProposalVoteRaw {
  voter: string
  support: number
  weight: string
  reason: string
}

interface ProposalVotesResponse {
  proposalVotes: ProposalVoteRaw[]
}

function getProposalStatus(p: ProposalRaw): string {
  if (p.vetoed) return 'VETOED'
  if (p.canceled) return 'CANCELED'
  if (p.executed) return 'EXECUTED'
  const now = Math.floor(Date.now() / 1000)
  const voteStart = Number(p.voteStart)
  const voteEnd = Number(p.voteEnd)
  if (now < voteStart) return 'PENDING'
  if (now >= voteStart && now < voteEnd) return 'ACTIVE'
  const forVotes = Number(p.forVotes)
  const againstVotes = Number(p.againstVotes)
  const quorumVotes = Number(p.quorumVotes)
  if (forVotes < quorumVotes) return 'DEFEATED'
  if (forVotes <= againstVotes) return 'DEFEATED'
  if (p.executableFrom && now < Number(p.executableFrom)) return 'QUEUED'
  return 'SUCCEEDED'
}

function supportLabel(support: number): string {
  switch (support) {
    case 0: return 'AGAINST'
    case 1: return 'FOR'
    case 2: return 'ABSTAIN'
    default: return String(support)
  }
}

cli.command('proposal list', 'List proposals')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .option('--limit, -l <number>', 'Number of proposals', { default: 20 })
  .option('--skip <number>', 'Skip proposals', { default: 0 })
  .option('--status, -s <status>', 'Filter by status')
  .action(async (options: { token?: string; chain?: string; json?: boolean; limit?: number; skip?: number; status?: string }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const limit = Number(options.limit) || 20
      const skip = Number(options.skip) || 0

      const query = `
        query ProposalList($dao: String!, $first: Int!, $skip: Int!) {
          proposals(
            where: { dao: $dao }
            first: $first
            skip: $skip
            orderBy: proposalNumber
            orderDirection: desc
          ) {
            proposalId
            proposalNumber
            title
            proposer
            forVotes
            againstVotes
            abstainVotes
            quorumVotes
            canceled
            executed
            vetoed
            voteStart
            voteEnd
            timeCreated
            executableFrom
            expiresAt
          }
        }
      `

      const data = await querySubgraph<ProposalListResponse>(daoConfig.chain, query, {
        dao: daoConfig.token.toLowerCase(),
        first: limit,
        skip,
      })

      let proposals = data.proposals || []

      if (options.status) {
        const statusFilter = options.status.toUpperCase()
        proposals = proposals.filter(p => getProposalStatus(p) === statusFilter)
      }

      if (isJsonMode(options)) {
        printJson(proposals.map(p => ({
          ...p,
          status: getProposalStatus(p),
        })))
        return
      }

      const columns: Column[] = [
        { header: '#', width: 5, align: 'right' },
        { header: 'Title', width: 40 },
        { header: 'Status', width: 10 },
        { header: 'For', width: 6, align: 'right' },
        { header: 'Against', width: 7, align: 'right' },
        { header: 'Quorum', width: 7, align: 'right' },
      ]

      const rows = proposals.map(p => [
        String(p.proposalNumber),
        (p.title || '').slice(0, 40),
        getProposalStatus(p),
        String(p.forVotes),
        String(p.againstVotes),
        String(p.quorumVotes),
      ])

      printTable(columns, rows)
    } catch (error) {
      handleError(error)
    }
  })

cli.command('proposal get <id>', 'Show proposal details')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .action(async (id: string, options: { token?: string; chain?: string; json?: boolean }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      let proposals: ProposalRaw[]

      if (id.startsWith('0x')) {
        const query = `
          query ProposalDetail($id: String!) {
            proposals(where: { proposalId: $id }, first: 1) {
              proposalId
              proposalNumber
              title
              description
              proposer
              forVotes
              againstVotes
              abstainVotes
              quorumVotes
              canceled
              executed
              vetoed
              voteStart
              voteEnd
              timeCreated
              executableFrom
              targets
              values
              calldatas
            }
          }
        `
        const data = await querySubgraph<ProposalListResponse>(daoConfig.chain, query, { id })
        proposals = data.proposals || []
      } else {
        const query = `
          query ProposalByNumber($dao: String!, $number: Int!) {
            proposals(where: { dao: $dao, proposalNumber: $number }, first: 1) {
              proposalId
              proposalNumber
              title
              description
              proposer
              forVotes
              againstVotes
              abstainVotes
              quorumVotes
              canceled
              executed
              vetoed
              voteStart
              voteEnd
              timeCreated
              executableFrom
              targets
              values
              calldatas
            }
          }
        `
        const data = await querySubgraph<ProposalListResponse>(daoConfig.chain, query, {
          dao: daoConfig.token.toLowerCase(),
          number: Number(id),
        })
        proposals = data.proposals || []
      }

      if (proposals.length === 0) {
        console.error(`Proposal ${id} not found`)
        process.exit(1)
      }

      const p = proposals[0]!
      const status = getProposalStatus(p)

      if (isJsonMode(options)) {
        printJson({ ...p, status })
        return
      }

      console.log(`\nProposal #${p.proposalNumber}: ${p.title}`)
      console.log('-'.repeat(60))
      printKeyValue([
        ['Status   ', status],
        ['Proposer ', truncateAddress(p.proposer)],
        ['Created  ', formatTimestamp(Number(p.timeCreated))],
        ['Vote Start', formatTimestamp(Number(p.voteStart))],
        ['Vote End ', formatTimestamp(Number(p.voteEnd))],
        ['For      ', p.forVotes],
        ['Against  ', p.againstVotes],
        ['Abstain  ', p.abstainVotes],
        ['Quorum   ', p.quorumVotes],
      ])

      if (p.description) {
        console.log(`\nDescription:\n${p.description}`)
      }
      console.log()
    } catch (error) {
      handleError(error)
    }
  })

cli.command('proposal votes <id>', 'Show votes for a proposal')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .option('--limit, -l <number>', 'Number of votes', { default: 100 })
  .option('--skip <number>', 'Skip votes', { default: 0 })
  .action(async (id: string, options: { token?: string; chain?: string; json?: boolean; limit?: number; skip?: number }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const limit = Number(options.limit) || 100
      const skip = Number(options.skip) || 0

      // If numeric, resolve to proposalId first
      let proposalId = id
      if (!id.startsWith('0x')) {
        const pQuery = `
          query ProposalByNumber($dao: String!, $number: Int!) {
            proposals(where: { dao: $dao, proposalNumber: $number }, first: 1) {
              proposalId
            }
          }
        `
        const pData = await querySubgraph<ProposalListResponse>(daoConfig.chain, pQuery, {
          dao: daoConfig.token.toLowerCase(),
          number: Number(id),
        })
        if (!pData.proposals || pData.proposals.length === 0) {
          console.error(`Proposal ${id} not found`)
          process.exit(1)
        }
        proposalId = pData.proposals[0]!.proposalId
      }

      const query = `
        query ProposalVotes($proposalId: String!, $first: Int!, $skip: Int!) {
          proposalVotes(
            where: { proposal_: { proposalId: $proposalId } }
            first: $first
            skip: $skip
            orderBy: weight
            orderDirection: desc
          ) {
            voter
            support
            weight
            reason
          }
        }
      `

      const data = await querySubgraph<ProposalVotesResponse>(daoConfig.chain, query, {
        proposalId,
        first: limit,
        skip,
      })

      const votes = data.proposalVotes || []

      if (isJsonMode(options)) {
        printJson(votes.map(v => ({
          ...v,
          supportLabel: supportLabel(v.support),
        })))
        return
      }

      const columns: Column[] = [
        { header: 'Voter', width: 16 },
        { header: 'Support', width: 8 },
        { header: 'Weight', width: 7, align: 'right' },
        { header: 'Reason', width: 40 },
      ]

      const rows = votes.map(v => [
        truncateAddress(v.voter),
        supportLabel(v.support),
        String(v.weight),
        (v.reason || '').slice(0, 40),
      ])

      printTable(columns, rows)
    } catch (error) {
      handleError(error)
    }
  })
