# PRD: builder-dao-cli — CLI para Agentes Interagirem com Builder DAOs

> **Status:** v1.1 — MVP + Write operations implementados
> **Data:** 2026-02-22
> **Autor:** r4to

---

## TL;DR

CLI open-source em TypeScript para agentes (e humanos) interagirem com qualquer DAO construída no Builder Protocol (Nouns Builder). Suporta auto-discovery de contratos via Manager, multi-chain (Ethereum, Base, Optimism, Zora), e integra ENS, Etherscan e IPFS. Operações de leitura e escrita implementadas.

---

## 1. Problema

**Para agentes de IA:**
- Não existe ferramenta CLI padronizada para interagir com Builder DAOs
- Cada DAO requer configuração manual de 5+ contratos (Token, Auction, Governor, Treasury, Metadata)
- Agentes precisam de output estruturado (JSON) para parsear resultados
- Operações on-chain (votar, propor, dar bid) exigem integração custom com cada DAO

**Para builders/devs:**
- Scripts ad-hoc para cada DAO (como os em gnars-website/scripts/)
- Sem padronização entre diferentes Builder DAOs
- Setup repetitivo para cada nova DAO

---

## 2. Solução

Uma CLI que:
1. **Auto-descobre** todos os contratos de uma DAO a partir do endereço do Token, usando o Manager contract
2. **Funciona com qualquer Builder DAO** — Gnars, Purple, Builder, etc.
3. **Output dual:** human-readable por default, `--json` para agentes
4. **Read + Write:** consultas (propostas, membros, auction) e ações (votar, propor, bid, queue, execute, settle, delegate)
5. **Integrações:** ENS (resolver nomes), Etherscan (links de tx), IPFS (resolver URIs de token)

---

## 3. Target Users

| User | Job-to-be-done |
|------|---------------|
| **AI Agents** (Claude, GPT via MCP/CLI) | Consultar e agir em DAOs programaticamente |
| **DAO Builders** | Administrar DAO via terminal, automações |
| **DAO Members** | Votar, acompanhar propostas, verificar treasury |
| **Developers** | Integrar DAO em workflows, scripts, CI/CD |

---

## 4. Arquitetura

### 4.1 Visão Geral

```
┌──────────────────────────────────────────────────────────────┐
│                        builder-dao-cli                        │
│                                                               │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Commands │  │DAO       │  │ Output   │  │ Integrations │  │
│  │          │  │Resolver  │  │Formatter │  │              │  │
│  │ dao      │  │          │  │          │  │ ENS      ✅  │  │
│  │ auction  │  │ Manager  │  │ table    │  │ Etherscan✅  │  │
│  │ proposal │  │ contract │  │ json     │  │ IPFS     ✅  │  │
│  │ member   │  │ → Token  │  │          │  │ Farcaster🔜  │  │
│  │ treasury │  │ → Auction│  │          │  │              │  │
│  │ token    │  │ → Gov    │  │          │  │              │  │
│  │ write    │  │ → Meta   │  │          │  │              │  │
│  └─────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Core Layer                             │ │
│  │  Viem (public + wallet client)  |  Subgraph Client       │ │
│  │  Config (env + discovery)       |  ABI Registry          │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 DAO Resolution Flow

```
Input: Token address OR ENS name
         │
         ▼
  ┌──────────────┐
  │ ENS Resolve? │──yes──► viem.getEnsAddress()
  └──────┬───────┘
         │ (address)
         ▼
  ┌──────────────────────────┐
  │ Manager.getAddresses()   │
  │ PUBLIC_MANAGER_ADDRESS   │
  │ per chain                │
  └──────────┬───────────────┘
             │
             ▼
  ┌─────────────────────────┐
  │ DAOConfig {             │
  │   token: 0x...          │
  │   auction: 0x...        │
  │   governor: 0x...       │
  │   treasury: 0x...       │
  │   metadata: 0x...       │
  │   chain: base | eth ... │
  │ }                       │
  └─────────────────────────┘
```

### 4.3 Configuração (3 níveis, cascata)

| Prioridade | Fonte | Uso |
|------------|-------|-----|
| 1 (maior) | `--token 0x... --chain base` | CLI flags |
| 2 | `.env` | Defaults por projeto |
| 3 (menor) | Auto-discovery via Manager | Fallback universal |

> **Decisão tomada:** `.builder-cli.toml` descartado — `.env` only. Suficiente para o uso atual.

**`.env` example:**
```bash
# DAO padrão (quando não passa --token)
BUILDER_TOKEN_ADDRESS=0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17
BUILDER_CHAIN=base

# RPCs
BASE_RPC_URL=https://mainnet.base.org
ETHEREUM_RPC_URL=https://eth.llamarpc.com
OPTIMISM_RPC_URL=https://mainnet.optimism.io
ZORA_RPC_URL=https://rpc.zora.energy

# Wallet (para write operations)
PRIVATE_KEY=[PRIVATE_KEY]

# Optional integrations
ETHERSCAN_API_KEY=[API_KEY]
GOLDSKY_PROJECT_ID=project_cm33ek8kjx6pz010i2c3w8z25
# NEYNAR_API_KEY=[API_KEY]  ← futuro (Farcaster)
```

---

## 5. Chains Suportadas

| Chain | ID | Manager Address | Subgraph |
|-------|----|-----------------|----------|
| Ethereum | 1 | `0xd310a3041dfcf14def5ccbc508668974b5da7174` | nouns-builder-ethereum-mainnet |
| Base | 8453 | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` | nouns-builder-base-mainnet |
| Optimism | 10 | `0x3ac0E64Fe2931f8e082C6Bb29283540DE9b5371C` | nouns-builder-optimism-mainnet |
| Zora | 7777777 | `0x3ac0E64Fe2931f8e082C6Bb29283540DE9b5371C` | nouns-builder-zora-mainnet |

> L2 chains compartilham o mesmo Manager address via deterministic CREATE2. ProtocolRewards (`0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B`) também é o mesmo em todas as chains.

**Subgraph base URL:**
```
https://api.goldsky.com/api/public/{GOLDSKY_PROJECT_ID}/subgraphs/{subgraph-name}/latest/gn
```

---

## 6. Comandos

> **Legenda:** ✅ implementado | 🔜 planejado

### 6.1 Read Operations

#### `builder dao info` ✅
Mostra informações gerais da DAO: contratos, supply, chain.

```bash
builder dao info --token 0x880f... --chain base
builder dao info --json
```

#### `builder dao discover <token>` ✅
Alias explícito para auto-discovery. Mesma saída que `dao info`.

```bash
builder dao discover 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base
```

#### `builder auction current` ✅
Mostra o auction ativo (tokenId, highBidder, highBid, endTime).

```bash
builder auction current
builder auction current --json
```

#### `builder auction history` ✅
Lista auctions passados (paginado com `--limit` / `--skip`).

```bash
builder auction history --limit 10
builder auction history --json
```

#### `builder proposal list` ✅
Lista propostas com filtro de status e paginação.

```bash
builder proposal list
builder proposal list --status ACTIVE
builder proposal list --limit 20 --skip 0 --json
```

Status: `PENDING` `ACTIVE` `SUCCEEDED` `QUEUED` `DEFEATED` `EXECUTED` `CANCELED` `VETOED`

#### `builder proposal get <id>` ✅
Detalhes completos de uma proposta (por número ou `0x` proposalId).

```bash
builder proposal get 42
builder proposal get 0x1234...
```

#### `builder proposal votes <id>` ✅
Votos de uma proposta (ordenados por peso, paginado).

```bash
builder proposal votes 42
builder proposal votes 42 --limit 50 --json
```

> 🔜 **Futuro:** `--support for|against|abstain` para filtrar por tipo de voto

#### `builder member list` ✅
Lista membros da DAO, ordenados por tokenCount.

```bash
builder member list
builder member list --sort votes --limit 20
```

> 🔜 **Futuro:** `--active` para filtrar membros que votaram recentemente

#### `builder member info <address>` ✅
Detalhe de um membro: tokens, votes, delegation. Suporta ENS.

```bash
builder member info 0x1234...
builder member info vitalik.eth
```

> 🔜 **Futuro:** `builder member info @username` via Farcaster handle

#### `builder treasury balance` ✅
Mostra saldo ETH do treasury.

```bash
builder treasury balance
builder treasury balance --json
```

> 🔜 **Futuro:** ERC-20 balances (USDC, WETH, etc.)

#### `builder token info <id>` ✅
Owner e tokenURI de um token específico.

```bash
builder token info 42
```

### 6.2 Write Operations (requer `PRIVATE_KEY`)

#### `builder vote <proposalId> <support>` ✅
Vota em uma proposta. Suporte: `for` / `against` / `abstain` (ou `0` / `1` / `2`).

```bash
builder vote 42 for
builder vote 42 against --reason "Budget too high"
builder vote 42 abstain --json
```

#### `builder propose` ✅
Cria uma proposta. Suporta inline ou via arquivo JSON.

```bash
builder propose \
  --title "Fund Community Event" \
  --description "Requesting 1 ETH for..." \
  --target 0x1234... \
  --value 1000000000000000000 \
  --calldata 0x

# Ou via arquivo:
builder propose --from proposal.json
```

**Formato do arquivo:**
```json
{
  "title": "Fund Community Event",
  "description": "Requesting 1 ETH...",
  "targets": ["0x..."],
  "values": ["1000000000000000000"],
  "calldatas": ["0x"]
}
```

#### `builder proposal queue <id>` ✅
Move uma proposta SUCCEEDED para QUEUED (timelock).

```bash
builder proposal queue 42
builder proposal queue 42 --json
```

#### `builder proposal execute <id>` ✅
Executa uma proposta QUEUED (após timelock expirar).

```bash
builder proposal execute 42
builder proposal execute 42 --json
```

#### `builder auction bid <amount>` ✅
Dá um bid no auction ativo. Amount em ETH.

```bash
builder auction bid 0.05
builder auction bid 0.05 --json
```

#### `builder auction settle` ✅
Encerra o auction (após end time) e inicia um novo.

```bash
builder auction settle
builder auction settle --json
```

#### `builder delegate <address>` ✅
Delega poder de voto. Suporta ENS.

```bash
builder delegate 0x1234...
builder delegate vitalik.eth
```

### 6.3 Config

#### `builder config init` ✅
Cria `.env.example` com todas as variáveis documentadas.

#### `builder config show` ✅
Mostra configuração ativa (token, chain, RPC, status da wallet).

---

## 7. Flags Globais

| Flag | Short | Description |
|------|-------|-------------|
| `--token <address>` | `-t` | Token address da DAO |
| `--chain <name>` | `-c` | Chain: ethereum, base, optimism, zora |
| `--json` | `-j` | Output em JSON (para agentes) |
| `--quiet` | `-q` | Output mínimo |
| `--rpc <url>` | | Custom RPC URL |
| `--private-key <key>` | | Private key para write ops (prefer .env) |
| `--help` | `-h` | Help |
| `--version` | `-v` | Version |

---

## 8. Integrações

### 8.1 ENS ✅

- Resolve nomes em inputs (address → ENS, ENS → address) e outputs
- Cache in-memory LRU (TTL 15min, 500 entradas)
- Resolução via mainnet client (viem built-in)

### 8.2 Etherscan V2 ✅

- Links de explorer em todos os outputs de write operations
- ABI fetch de contratos verificados (fallback)
- API unificada: uma key funciona em 50+ chains
- Chain-aware: etherscan.io / basescan.org / optimistic.etherscan.io / explorer.zora.energy

### 8.3 IPFS ✅

- Resolve `ipfs://` URIs para gateway URLs
- Gateways com fallback: ipfs.io → dweb.link → w3s.link

### 8.4 Farcaster (via Neynar) 🔜

- Profile enrichment: username, display name de membros
- `member info @username` → resolve address via Neynar
- Batch lookup para `member list`
- Ativa apenas se `NEYNAR_API_KEY` estiver configurada
- **Status:** não implementado

---

## 9. Stack Técnica

| Componente | Tecnologia | Decisão |
|------------|------------|---------|
| Runtime | Node.js (LTS) | Compatível com ecossistema |
| Linguagem | TypeScript (strict) | Type safety |
| CLI Framework | `cac` | Leve, sem overhead |
| Blockchain | `viem` | Type-safe, usado no ecossistema Builder |
| Subgraph | `graphql-request` | Leve, compatível com @buildeross/sdk |
| Schemas | `zod` | Validação de inputs e config |
| Build | `tsup` | Fast, ESM output |
| Test | `vitest` | TS-native |

**Decisão tomada:** `cac` vs `citty` — ficou com `cac`. Funciona bem para o scope atual.

### Dependências

```json
{
  "dependencies": {
    "viem": "^2.38.0",
    "graphql-request": "^7.1.0",
    "graphql": "^16.11.0",
    "cac": "^6.7.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0",
    "@zoralabs/coins-sdk": "^0.4.3"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsup": "^8.3.0",
    "vitest": "^2.1.0",
    "tsx": "^4.0.0",
    "@types/node": "^22.0.0"
  }
}
```

> 🔜 **Futuro:** `@neynar/nodejs-sdk` como optionalDependency quando Farcaster for implementado

---

## 10. Estrutura do Projeto

```
builder-dao-cli/
├── CLAUDE.md
├── README.md
├── docs/
│   └── PRD.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .env.example
├── .gitignore
├── src/
│   ├── index.ts                # Entry point + subcommand routing
│   ├── cli.ts                  # cac singleton + global flags
│   ├── config/
│   │   ├── index.ts            # Config loader (env + flags)
│   │   ├── chains.ts           # Chain definitions + Manager addresses
│   │   └── schema.ts           # Zod schemas
│   ├── core/
│   │   ├── resolver.ts         # DAO address resolution (Manager contract)
│   │   ├── subgraph.ts         # Goldsky GraphQL client
│   │   ├── client.ts           # Viem public + wallet client factory (cached)
│   │   └── abis/               # Contract ABIs
│   │       ├── manager.ts
│   │       ├── governor.ts
│   │       ├── auction.ts
│   │       ├── token.ts
│   │       ├── treasury.ts
│   │       └── metadata.ts
│   ├── commands/
│   │   ├── dao.ts              # dao info, dao discover
│   │   ├── auction.ts          # auction current, auction history
│   │   ├── proposal.ts         # proposal list, get, votes
│   │   ├── member.ts           # member list, member info
│   │   ├── treasury.ts         # treasury balance
│   │   ├── token.ts            # token info
│   │   ├── write.ts            # vote, propose, bid, settle, queue, execute, delegate
│   │   └── config.ts           # config init, config show
│   ├── integrations/
│   │   ├── ens.ts              # ENS resolve + reverse (cached)
│   │   ├── etherscan.ts        # Explorer URLs, ABI fetch
│   │   └── ipfs.ts             # IPFS gateway resolution
│   ├── output/
│   │   ├── formatter.ts        # Output mode detection (JSON, quiet)
│   │   ├── table.ts            # Table + key-value formatter
│   │   └── json.ts             # JSON output
│   └── utils/
│       ├── format.ts           # ETH, addresses, timestamps
│       ├── cache.ts            # LRU cache
│       └── errors.ts           # Custom errors + handler
└── tests/
    ├── utils/
    │   ├── format.test.ts
    │   └── cache.test.ts
    └── integrations/
        ├── etherscan.test.ts
        └── ipfs.test.ts
```

---

## 11. ABIs

Copiados de `@buildeross/sdk` (evita peer deps de React/Wagmi).

| Contrato | Funções-chave |
|----------|---------------|
| **Manager** | `getAddresses(token)` → [metadata, auction, treasury, governor] |
| **Token** | `getVotes`, `delegates`, `delegate`, `totalSupply`, `ownerOf`, `tokenURI` |
| **Auction** | `auction()` → estado atual, `createBid(tokenId)`, `settleCurrentAndCreateNewAuction()` |
| **Governor** | `propose`, `castVote`, `castVoteWithReason`, `queue`, `execute`, `state`, `proposalEta` |
| **Treasury** | (balance via publicClient.getBalance) |
| **Metadata** | `tokenURI(tokenId)` |

---

## 12. Subgraph Queries

**URL pattern:**
```
https://api.goldsky.com/api/public/{projectId}/subgraphs/nouns-builder-{chain}-mainnet/latest/gn
```

**Chain mapping:**
- `ethereum` → `nouns-builder-ethereum-mainnet`
- `base` → `nouns-builder-base-mainnet`
- `optimism` → `nouns-builder-optimism-mainnet`
- `zora` → `nouns-builder-zora-mainnet`

**Queries utilizadas:**
- Proposals list/detail (com targets, values, calldatas para execute)
- Proposal votes
- Token holders (members)
- Auction history

---

## 13. Output Format

### Human (default)

```
$ builder proposal list

 #  │ Title                          │ Status   │ For │ Against │ Quorum
────┼────────────────────────────────┼──────────┼─────┼─────────┼───────
 42 │ Sponsor Skater X               │ EXECUTED │  85 │      12 │     50
 41 │ Community Event Fund           │ ACTIVE   │  23 │       5 │     50
```

### JSON (--json)

```json
[
  {
    "proposalId": "0x...",
    "proposalNumber": 42,
    "title": "Sponsor Skater X",
    "status": "EXECUTED",
    "forVotes": "85",
    "againstVotes": "12",
    "quorumVotes": "50",
    "proposer": "0x1234...",
    "voteStart": "1704067200",
    "voteEnd": "1704672000"
  }
]
```

> 🔜 **Futuro:** `pagination` wrapper `{ items, total, limit, offset, hasMore }` no JSON output

---

## 14. Error Handling

| Cenário | Handling |
|---------|----------|
| Token inválido | Mensagem clara + hint |
| DAO não encontrada | "No DAO found at this address on {chain}" |
| RPC timeout | Erro com sugestão de custom RPC |
| Wallet não configurada | "Set PRIVATE_KEY in .env or use --private-key" |
| Bid abaixo do atual | "Bid must exceed current highest bid of X ETH" |
| Auction já encerrado | "Auction has ended" |
| Auction já settled | "Auction is already settled" |
| ENS resolution fail | Usa address sem nome, sem erro |
| Neynar ausente | 🔜 Silently skip Farcaster enrichment |

Erros em modo `--json`:
```json
{ "error": "Proposal not found", "hint": "Check proposal ID" }
```

---

## 15. Security

- **NUNCA** logar private keys
- Private key via `.env` (gitignored) ou `--private-key` (flag efêmera)
- Inputs validados com Zod antes de enviar on-chain
- `PRIVATE_KEY` pattern validado: `0x` + 64 hex chars

> 🔜 **Futuro:** confirmation prompt antes de write ops (`--yes` para skip em automações)

---

## 16. Status das Fases

### Fase 1 — Read operations ✅ Concluído

- `dao info`, `dao discover`
- `proposal list`, `proposal get`, `proposal votes`
- `auction current`, `auction history`
- `member list`, `member info`
- `treasury balance`
- `token info`
- `config init`, `config show`
- ENS + Etherscan links + IPFS + JSON output

### Fase 2 — Write operations ✅ Concluído

- `vote`, `propose`
- `auction bid`, `auction settle`
- `proposal queue`, `proposal execute`
- `delegate`

### Fase 3 — Enrichment & MCP 🔜 Planejado

1. Farcaster profile enrichment (Neynar)
2. `member info @username` via Farcaster handle
3. `--active` filter em `member list`
4. ERC-20 balances no `treasury balance`
5. Pagination wrapper no JSON output
6. MCP Server mode
7. `builder token traits` — download de trait images
8. Proposal search (semântico)
9. Gas estimation display em write ops
10. Confirmation prompt antes de write ops (`--yes` para skip)

---

## 17. Métricas

- `dao info` funciona com Gnars (Base), Purple (Ethereum), e pelo menos 1 DAO em cada chain
- `--json` output parseável por agente sem pós-processamento
- Zero config: `builder dao discover 0x880f... --chain base` funciona sem `.env`
- < 3s para qualquer read operation (p95)
- Write ops: tx confirmada em < 30s (exceto latência de rede)

---

## 18. Publicação

> 🔜 Não publicado no NPM ainda.

```bash
# Nome do pacote (a confirmar disponibilidade)
builder-dao-cli

# Binário
builder

# NPM (futuro)
npx builder-dao-cli dao info --token 0x... --chain base

# Global install (futuro)
pnpm add -g builder-dao-cli
```

**Decisão pendente:** `builder-dao-cli` vs `builder-cli` — verificar disponibilidade no NPM antes de publicar.

---

## 19. Referências

| Recurso | Path/URL |
|---------|----------|
| ABIs source | `/Users/r4to/Script/gnars-website/references/nouns-builder/packages/sdk/src/contract/abis/` |
| Service patterns | `/Users/r4to/Script/gnars-website/src/services/` |
| Builder SDK | `https://github.com/BuilderOSS/nouns-builder` |
| Goldsky Subgraphs | `https://api.goldsky.com/api/public/project_cm33ek8kjx6pz010i2c3w8z25/subgraphs/` |
| nouns.build | `https://nouns.build` |
| Nouns Protocol contracts | `https://github.com/ourzora/nouns-protocol` |
| Etherscan V2 API | `https://api.etherscan.io/v2/api` |
| Neynar API (Farcaster) | `https://docs.neynar.com/` |
| ProtocolRewards (all chains) | `0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B` |
