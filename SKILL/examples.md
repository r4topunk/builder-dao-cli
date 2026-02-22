# Usage Examples

## Common workflows

### 1. Explore a DAO

```bash
# Discover all contracts for a DAO on Base
node dist/index.js dao info --token 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base

# Same DAO, JSON output for parsing
node dist/index.js dao info --token 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base --json
```

### 2. Monitor governance

```bash
# List active proposals
node dist/index.js proposal list --status ACTIVE --json

# Get full details of proposal #42
node dist/index.js proposal get 42

# See who voted and how
node dist/index.js proposal votes 42 --limit 50
```

### 3. Participate in governance

```bash
# Vote FOR proposal 42 with a reason
node dist/index.js vote 42 for --reason "Aligns with treasury diversification goals"

# Delegate voting power to someone
node dist/index.js delegate vitalik.eth
```

### 4. Full proposal lifecycle

```bash
# 1. Create proposal
node dist/index.js propose \
  --title "Fund community event" \
  --description "Allocate 1 ETH for community meetup" \
  --target 0xRECIPIENT \
  --value 1000000000000000000 \
  --calldata 0x

# 2. After voting succeeds, queue it
node dist/index.js proposal queue 42

# 3. After timelock expires, execute
node dist/index.js proposal execute 42
```

### 5. Auction participation

```bash
# Check current auction
node dist/index.js auction current

# Place a bid of 0.5 ETH
node dist/index.js auction bid 0.5

# Settle ended auction (starts new one)
node dist/index.js auction settle

# View past auctions
node dist/index.js auction history --limit 10
```

### 6. Member analysis

```bash
# Top token holders
node dist/index.js member list --sort tokens --limit 10

# Check a specific member
node dist/index.js member info 0xADDRESS

# Check via ENS
node dist/index.js member info somename.eth
```

### 7. Multi-chain usage

```bash
# Ethereum mainnet DAO
node dist/index.js dao info --token 0x... --chain ethereum

# Optimism DAO
node dist/index.js dao info --token 0x... --chain optimism

# Zora DAO
node dist/index.js dao info --token 0x... --chain zora
```

### 8. Wallet inspection

```bash
# Check your wallet address, ETH balance, and all DAO memberships
bdao config wallet

# Check balance on a specific chain
bdao config wallet --chain ethereum

# JSON output for programmatic use
bdao config wallet --json
```

### 9. Using .env for defaults

```bash
# .env file eliminates repetitive flags
BUILDER_TOKEN_ADDRESS=0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17
BUILDER_CHAIN=base
PRIVATE_KEY=0x...

# Now commands are shorter
node dist/index.js dao info
node dist/index.js proposal list
node dist/index.js vote 42 for
```

---

## Agent integration patterns

### Parse JSON output

All commands support `--json` for structured output. Use this mode when processing results programmatically.

```bash
# Get proposal data as JSON, pipe to jq
node dist/index.js proposal get 42 --json | jq '.status'

# List members as JSON
node dist/index.js member list --json --limit 100
```

### Batch operations

```bash
# Check multiple DAOs
for token in 0xAAA 0xBBB 0xCCC; do
  node dist/index.js dao info --token $token --chain base --json
done
```

### Error handling

The CLI exits with code 1 on errors. Errors include a `hint` field with suggested fixes. In `--json` mode, errors are also JSON-formatted for parsing.
