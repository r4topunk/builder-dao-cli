---
name: builder-dao-cli
description: >
  Operate the builder-dao-cli to interact with Builder Protocol DAOs on Ethereum, Base, Optimism, and Zora.
  Use when the user asks to query DAO info, list proposals, check auctions, view members/treasury,
  cast votes, create proposals, bid on auctions, delegate tokens, settle auctions, or queue/execute proposals.
  Also use when asked about Builder Protocol, Nouns-style DAOs, or this CLI's commands.
user-invocable: false
---

# builder-dao-cli

TypeScript CLI for agents and humans to interact with any Builder Protocol DAO.
Auto-discovers contracts via Manager contract. Multi-chain: Ethereum, Base, Optimism, Zora.

## Quick orientation

| Layer | What |
|-------|------|
| Read commands | `dao info`, `proposal list/get/votes`, `auction current/history`, `member list/info`, `treasury balance`, `token info` |
| Write commands | `vote`, `propose`, `auction bid/settle`, `delegate`, `proposal queue/execute` |
| Output modes | Table (default, human), `--json` (agent-friendly) |
| Global flags | `--token/-t`, `--chain/-c`, `--json/-j`, `--quiet/-q`, `--rpc` |

## Environment

```bash
# Required
BUILDER_TOKEN_ADDRESS=0x...   # or use --token flag
BUILDER_CHAIN=base            # or use --chain flag

# Write operations
PRIVATE_KEY=0x...             # or use --private-key flag

# Optional
BASE_RPC_URL=               # defaults to public RPC
GOLDSKY_PROJECT_ID=          # defaults to public project
```

## Install

```bash
npm install -g builder-dao-cli
# binary: bdao
```

Or run without installing:

```bash
npx builder-dao-cli <command> [options]
```

## Decision tree: which command?

```
Want to READ data?
  About the DAO itself       → bdao dao info
  About proposals            → bdao proposal list / bdao proposal get <id> / bdao proposal votes <id>
  About auctions             → bdao auction current / bdao auction history
  About members              → bdao member list / bdao member info <address>
  About treasury             → bdao treasury balance
  About a token              → bdao token info <id>

Want to WRITE on-chain?
  Vote on proposal           → bdao vote <id> <for|against|abstain>
  Create proposal            → bdao propose --title "..." --description "..." --target 0x... --value 0 --calldata 0x...
  Bid on auction             → bdao auction bid <amount_eth>
  Settle ended auction       → bdao auction settle
  Delegate voting power      → bdao delegate <address>
  Queue succeeded proposal   → bdao proposal queue <id>
  Execute queued proposal    → bdao proposal execute <id>
```

## Additional resources

- For complete command reference with all flags and options, see [reference.md](reference.md)
- For real-world usage examples and common workflows, see [examples.md](examples.md)
- For codebase architecture and extension patterns, see [architecture.md](architecture.md)
