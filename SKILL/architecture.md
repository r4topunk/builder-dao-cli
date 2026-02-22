# Architecture & Extension Guide

## Project structure

```
src/
├── index.ts              # Entry point: imports all commands, preprocesses argv
├── cli.ts                # Singleton CLI factory (cac framework)
├── commands/
│   ├── dao.ts            # dao info, discover
│   ├── proposal.ts       # proposal list, get, votes
│   ├── auction.ts        # auction current, history
│   ├── member.ts         # member list, info
│   ├── treasury.ts       # treasury balance
│   ├── token.ts          # token info
│   ├── config.ts         # config init, show
│   └── write.ts          # vote, propose, auction bid/settle, delegate, proposal queue/execute
├── config/
│   ├── chains.ts         # ChainConfig per chain (manager address, RPC, explorer)
│   ├── index.ts          # getDAOConfig() resolver
│   └── schema.ts         # Zod validation for env vars
├── core/
│   ├── client.ts         # viem public/wallet client factory
│   ├── resolver.ts       # resolveDAOAddresses(), resolveAddressOrEns()
│   ├── subgraph.ts       # GraphQL client for Goldsky subgraph
│   └── abis/             # Contract ABIs (manager, governor, auction, token, treasury, metadata)
├── integrations/
│   ├── ens.ts            # ENS name resolution
│   ├── etherscan.ts      # Etherscan V2 API
│   └── ipfs.ts           # IPFS gateway
├── output/
│   ├── table.ts          # printTable(), printKeyValue()
│   └── json.ts           # printJson() with bigint handling
└── utils/
    ├── errors.ts         # BuilderCLIError, DAONotFoundError, etc.
    ├── format.ts         # Address truncation, ETH formatting, time formatting
    └── cache.ts          # LRU cache for repeated lookups
```

## Key abstractions

### DAOConfig

Resolved from a token address via Manager contract:

```typescript
interface DAOConfig {
  token: `0x${string}`
  auction: `0x${string}`
  governor: `0x${string}`
  treasury: `0x${string}`
  metadata: `0x${string}`
  chain: ChainName
  chainConfig: ChainConfig
}
```

Obtain with: `const dao = await getDAOConfig({ token, chain, rpc })`

### Command registration pattern

Commands self-register by calling `getCli()`:

```typescript
// In any command file:
const cli = getCli()
cli.command('proposal list', 'List proposals')
  .option('--limit <n>', 'Max results', { default: 20 })
  .action(async (options) => { /* ... */ })
```

Importing the file = command exists. No central registry.

### Write command flow

All write operations follow this sequence:

1. `getPrivateKey()` - validate key from flag or env
2. `getDAOConfig()` - resolve DAO contracts
3. `getWalletClient()` - create viem wallet client
4. Resolve parameters (proposal number → bytes32, ENS → address)
5. `walletClient.writeContract()` - execute transaction
6. `publicClient.waitForTransactionReceipt()` - confirm
7. Output: tx hash + explorer URL

### Subgraph queries

All read data comes from Goldsky-hosted subgraphs:

```
https://api.goldsky.com/api/public/{PROJECT_ID}/subgraphs/nouns-builder-{chain}-mainnet/latest/gn
```

Key entities: `dao`, `proposals`, `proposalVotes`, `auctions`, `daotokenOwners`, `tokens`.

## Adding a new command

1. Create `src/commands/mycommand.ts`
2. Import `getCli()` and register with `cli.command()`
3. Import the file in `src/index.ts`
4. If multi-word command, add to `SUBCOMMANDS` map in `index.ts`
5. Build: `pnpm build`

## Adding a new chain

1. Add chain config to `src/config/chains.ts` (manager address, RPC, explorer)
2. Add chain name to `ChainName` type
3. Import viem chain object from `viem/chains`

## Development

```bash
pnpm install        # Install deps
pnpm build          # Build to dist/
pnpm dev -- <cmd>   # Dev mode with args
pnpm test           # Run tests
pnpm typecheck      # Type checking only
```
