# builder-dao-cli

> CLI for agents and humans to interact with any [Builder Protocol](https://nouns.build) DAO.

Auto-discovers all DAO contracts from a single token address via the Manager contract. Works on Ethereum, Base, Optimism, and Zora.

## Quick start

```bash
pnpm install
pnpm build

node dist/index.js dao info --token 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base
```

Or install globally:

```bash
npm install -g .
builder dao info --token 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base
```

## Configuration

```bash
# Minimal .env
BUILDER_TOKEN_ADDRESS=0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17
BUILDER_CHAIN=base

# Custom RPC (optional, has public defaults)
BASE_RPC_URL=https://mainnet.base.org

# Write operations require a private key
PRIVATE_KEY=0x...

# Optional integrations
ETHERSCAN_API_KEY=
GOLDSKY_PROJECT_ID=
```

Generate a template:

```bash
builder config init   # creates .env.example
builder config show   # shows current config status
```

## Global flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--token <address>` | `-t` | DAO token address (overrides env) |
| `--chain <name>` | `-c` | Chain: `ethereum`, `base`, `optimism`, `zora` (default: `base`) |
| `--json` | `-j` | Output as JSON — use this for agent parsing |
| `--quiet` | `-q` | Minimal output |
| `--rpc <url>` | | Override RPC endpoint |

## Commands

### DAO

```bash
builder dao info                    # Discover all DAO contracts + supply + chain
builder dao discover <token>        # Same, explicit token address
```

### Proposals

```bash
builder proposal list               # List all proposals
builder proposal list --status ACTIVE --limit 10 --skip 0
builder proposal get <id>           # By proposal number or 0x proposalId
builder proposal votes <id>         # Votes for a proposal (paginated)
```

Status values: `PENDING` `ACTIVE` `SUCCEEDED` `QUEUED` `DEFEATED` `EXECUTED` `CANCELED` `VETOED`

### Auction

```bash
builder auction current             # Current active auction
builder auction history             # Past settled auctions
```

### Members

```bash
builder member list                 # All token holders (sorted by token count)
builder member list --sort votes --limit 20
builder member info <address>       # Balance, votes, delegation, token IDs
builder member info vitalik.eth     # ENS names resolved automatically
```

### Treasury

```bash
builder treasury balance            # ETH balance of the treasury
```

### Token

```bash
builder token info <id>             # Owner + metadata URI for a token ID
```

### Write operations (require `PRIVATE_KEY`)

```bash
# Governance
builder vote <proposalId> for               # Cast vote (for/against/abstain or 0/1/2)
builder vote <proposalId> against --reason "Because..."
builder propose --title "Fund event" --target 0xRECIPIENT --value 1000000000000000000
builder propose --from proposal.json        # Load from JSON file
builder proposal queue <id>                 # Queue a succeeded proposal
builder proposal execute <id>              # Execute a queued proposal
builder delegate <address>                  # Delegate voting power (supports ENS)

# Auction
builder auction bid 0.5                     # Bid 0.5 ETH on current auction
builder auction settle                      # Settle ended auction and start new one
```

## For AI agents

All commands support `--json` for machine-readable output. Errors are also returned as JSON when the flag is set.

```bash
# Discover DAO contracts
builder dao info --token 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base --json
# → { "chain": "base", "token": "0x...", "auction": "0x...", "governor": "0x...", ... }

# Get active proposals
builder proposal list --status ACTIVE --json
# → [{ "proposalNumber": 42, "title": "...", "status": "ACTIVE", "forVotes": "...", ... }]

# Current auction state
builder auction current --json
# → { "tokenId": "...", "highBidder": "0x...", "highBid": "500000000000000000", "endTime": "..." }

# Member snapshot
builder member list --json
# → [{ "address": "0x...", "ens": "vitalik.eth", "tokenCount": 5, "votes": "5" }, ...]

# Cast vote
builder vote 42 for --reason "Ships fast" --json
# → { "txHash": "0x...", "explorerUrl": "https://basescan.org/tx/0x..." }
```

Errors follow this shape when `--json` is active:

```json
{ "error": "Proposal not found", "hint": "Check proposal ID" }
```

## Supported chains

| Chain | Manager Address |
|-------|----------------|
| Ethereum | `0xd310a3041dfcf14def5ccbc508668974b5da7174` |
| Base | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` |
| Optimism | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` |
| Zora | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` |

Each chain has a Goldsky subgraph indexer and a public RPC fallback. Custom RPCs can be set via env vars (`BASE_RPC_URL`, `ETHEREUM_RPC_URL`, etc.).

## Integrations

| Integration | Behavior |
|------------|----------|
| **ENS** | Resolves names in inputs and outputs, cached 15 min |
| **Etherscan V2** | Explorer links on all write operations, ABI verification |
| **IPFS** | Resolves `ipfs://` URIs via multiple gateways |
| **Goldsky Subgraph** | Proposals, auctions, members, votes — indexed per chain |

## Stack

| Layer | Tool |
|-------|------|
| Runtime | Node.js LTS |
| Language | TypeScript (strict) |
| CLI | `cac` |
| Blockchain | `viem` |
| Subgraph | `graphql-request` |
| Validation | `zod` |
| Build | `tsup` |
| Tests | `vitest` |

## Development

```bash
pnpm dev          # Run without build (tsx)
pnpm build        # Compile to dist/
pnpm test         # Run tests
pnpm typecheck    # Type check only
```

## References

- [Builder Protocol](https://nouns.build)
- [BuilderOSS/nouns-builder](https://github.com/BuilderOSS/nouns-builder) — SDK + subgraph
- [ourzora/nouns-protocol](https://github.com/ourzora/nouns-protocol) — Smart contracts
- [Goldsky Subgraph](https://api.goldsky.com)
- [`docs/PRD.md`](docs/PRD.md) — Full product spec

## License

MIT
