# CLAUDE.md -- builder-dao-cli

## What is this
TypeScript CLI for agents and humans to interact with any Builder Protocol DAO.
Auto-discovers contracts via Manager contract. Multi-chain (Ethereum, Base, Optimism, Zora).

## Quick start
```bash
pnpm install
pnpm build
node dist/index.js dao info --token 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base
```

## Architecture
- `src/config/` -- chain configs, env parsing, Zod schemas
- `src/core/` -- viem client factory, DAO resolver, subgraph client, ABIs
- `src/commands/` -- CLI commands (dao, proposal, auction, member, treasury, token, config)
- `src/integrations/` -- ENS, Etherscan V2, IPFS
- `src/output/` -- table formatter, JSON output
- `src/utils/` -- format helpers, LRU cache, error types

## Key patterns
- All commands import `getCli()` from `../cli.ts` to register themselves
- `getDAOConfig(opts)` resolves token + chain into full DAOConfig
- `querySubgraph(chain, query, variables)` for all GraphQL calls
- Output: `printTable()` for humans, `printJson()` for --json mode

## Chain Manager addresses
- Ethereum: 0xd310a3041dfcf14def5ccbc508668974b5da7174
- Base/Optimism/Zora: 0x3ac0e64fe2931f8e082c6bb29283540de9b5371c

## Subgraph URL
https://api.goldsky.com/api/public/{GOLDSKY_PROJECT_ID}/subgraphs/nouns-builder-{chain}-mainnet/latest/gn

## References
- ABIs source: /Users/r4to/Script/gnars-website/references/nouns-builder/packages/sdk/src/contract/abis/
- Service patterns: /Users/r4to/Script/gnars-website/src/services/
- Subgraph queries: /Users/r4to/Script/gnars-website/references/nouns-builder/packages/sdk/src/subgraph/queries/
