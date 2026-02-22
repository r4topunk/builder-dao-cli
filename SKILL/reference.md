# Command Reference

## Global flags

All commands accept these flags:

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--token <address>` | `-t` | Token contract address | `BUILDER_TOKEN_ADDRESS` env |
| `--chain <name>` | `-c` | Chain: ethereum, base, optimism, zora | `BUILDER_CHAIN` env or `base` |
| `--json` | `-j` | Output as JSON | false |
| `--quiet` | `-q` | Minimal output | false |
| `--rpc <url>` | | Custom RPC URL | Chain default |

---

## Read commands

### dao info

Show DAO overview: name, symbol, supply, owner count, contract addresses.

```bash
bdao dao info --token 0x... --chain base
```

### proposal list

List proposals with status, vote counts, quorum.

```bash
bdao proposal list [--limit 20] [--skip 0] [--status ACTIVE|PENDING|SUCCEEDED|DEFEATED|QUEUED|EXECUTED|VETOED|CANCELED]
```

### proposal get

Full details of a single proposal.

```bash
bdao proposal get <id>
# id: proposal number (42) or proposalId bytes32 (0x...)
```

### proposal votes

All votes on a proposal with voter, weight, support, reason.

```bash
bdao proposal votes <id> [--limit 100] [--skip 0]
```

### auction current

Active auction: token ID, highest bidder, bid amount, time remaining.

```bash
bdao auction current
```

### auction history

Past auctions with winners and prices.

```bash
bdao auction history [--limit 20]
```

### member list

DAO members with token count and delegation info.

```bash
bdao member list [--limit 20] [--skip 0] [--sort tokens|votes]
```

### member info

Specific member: tokens, votes, delegation, token IDs.

```bash
bdao member info <address|ens.eth>
```

### treasury balance

ETH balance of the DAO treasury.

```bash
bdao treasury balance
```

### token info

Owner and URI of a specific token.

```bash
bdao token info <tokenId>
```

### config show / config init

```bash
bdao config show    # Show current configuration
bdao config init    # Create .env.example
```

### config wallet

Show wallet address, ETH balance, and all DAO memberships across supported chains.
Requires `PRIVATE_KEY` env var.

```bash
bdao config wallet                  # Balance on default chain + all DAO memberships
bdao config wallet --chain ethereum # Balance on Ethereum
bdao config wallet --json           # JSON output for agent parsing
```

---

## Write commands

All write commands require `PRIVATE_KEY` env var or `--private-key` flag.

### vote

Cast a vote on a governance proposal.

```bash
bdao vote <proposalId> <for|against|abstain|0|1|2> [--reason "text"] [--private-key 0x...]
```

- `proposalId`: numeric proposal number or bytes32 hash
- Support: `for`/`1`, `against`/`0`, `abstain`/`2`
- Returns: tx hash, status, explorer URL

### propose

Create a governance proposal.

```bash
# Single action inline
bdao propose --title "..." --description "..." --target 0x... --value 0 --calldata 0x...

# Multiple actions from JSON
bdao propose --from proposal.json
```

JSON format for `--from`:
```json
{
  "title": "Proposal title",
  "description": "Proposal description",
  "targets": ["0x..."],
  "values": ["0"],
  "calldatas": ["0x..."]
}
```

### auction bid

Bid on the current auction.

```bash
bdao auction bid <amount_in_eth>
# Example: bdao auction bid 0.5
```

Validates: auction is active, amount > current highest bid.

### auction settle

Settle an ended auction and start a new one.

```bash
bdao auction settle
```

Validates: auction has ended.

### delegate

Delegate voting power to an address.

```bash
bdao delegate <address|ens.eth>
```

### proposal queue

Queue a succeeded proposal for execution (starts timelock).

```bash
bdao proposal queue <id>
```

### proposal execute

Execute a queued proposal after timelock expires.

```bash
bdao proposal execute <id>
```

---

## Supported chains

| Chain | Manager address | Explorer |
|-------|----------------|----------|
| ethereum | `0xd310a3041dfcf14def5ccbc508668974b5da7174` | etherscan.io |
| base | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` | basescan.org |
| optimism | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` | optimistic.etherscan.io |
| zora | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` | explorer.zora.energy |

---

## Error types

| Error | Cause | Fix |
|-------|-------|-----|
| `NoTokenConfiguredError` | No --token flag and no BUILDER_TOKEN_ADDRESS | Set one of them |
| `DAONotFoundError` | Token address not registered in Manager | Verify address and chain |
| `WalletNotConfiguredError` | PRIVATE_KEY missing for write command | Set env or --private-key |
