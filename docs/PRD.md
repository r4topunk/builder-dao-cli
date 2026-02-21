# PRD: builder-cli — CLI para Agentes Interagirem com Builder DAOs

> **Status:** Draft v1.0
> **Data:** 2026-02-21
> **Autor:** r4to

---

## TL;DR

CLI open-source em TypeScript para agentes (e humanos) interagirem com qualquer DAO construída no Builder Protocol (Nouns Builder). Suporta auto-discovery de contratos via Manager, multi-chain (Ethereum, Base, Optimism, Zora), e integra ENS, Etherscan e Farcaster para enriquecer a UX.

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
4. **Read + Write:** consultas (propostas, membros, auction) e ações (votar, propor, bid)
5. **Integrações:** ENS (resolver nomes), Etherscan (verificar contratos), Farcaster (perfis de membros)

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
│                        builder-cli                            │
│                                                               │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Commands │  │DAO       │  │ Output   │  │ Integrations │  │
│  │          │  │Resolver  │  │Formatter │  │              │  │
│  │ dao      │  │          │  │          │  │ ENS          │  │
│  │ auction  │  │ Manager  │  │ table    │  │ Etherscan    │  │
│  │ proposal │  │ contract │  │ json     │  │ Farcaster    │  │
│  │ member   │  │ → Token  │  │ minimal  │  │ IPFS         │  │
│  │ treasury │  │ → Auction│  │          │  │              │  │
│  │ token    │  │ → Gov    │  │          │  │              │  │
│  │ vote     │  │ → Meta   │  │          │  │              │  │
│  │ propose  │  │ → Treas  │  │          │  │              │  │
│  └─────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Core Layer                             │ │
│  │  Viem (public + wallet client)  |  Subgraph Client       │ │
│  │  Config (env + discovery)       |  ABI Registry           │ │
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
| 2 | `.env` / `.builder-cli.toml` | Defaults por projeto |
| 3 (menor) | Auto-discovery via Manager | Fallback universal |

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
BASESCAN_API_KEY=[API_KEY]
NEYNAR_API_KEY=[API_KEY]
GOLDSKY_PROJECT_ID=project_cm33ek8kjx6pz010i2c3w8z25
```

---

## 5. Chains Suportadas

| Chain | ID | Manager Address | Subgraph |
|-------|----|-----------------|----------|
| Ethereum | 1 | `0xd310a3041dfcf14def5ccbc508668974b5da7174` | nouns-builder-ethereum-mainnet |
| Base | 8453 | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` | nouns-builder-base-mainnet |
| Optimism | 10 | `0x3ac0E64Fe2931f8e082C6Bb29283540DE9b5371C` | nouns-builder-optimism-mainnet |
| Zora | 7777777 | `0x3ac0E64Fe2931f8e082C6Bb29283540DE9b5371C` | nouns-builder-zora-mainnet |

> **Nota:** L2 chains (Base, Optimism, Zora) compartilham o mesmo Manager address (`0x3ac0...71c`) via deterministic CREATE2 deployment. ProtocolRewards (`0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B`) também é o mesmo em todas as chains.

**Subgraph base URL:**
```
https://api.goldsky.com/api/public/{GOLDSKY_PROJECT_ID}/subgraphs/{subgraph-name}/latest/gn
```

---

## 6. Comandos

### 6.1 Core — Read Operations

#### `builder dao info`
Mostra informações gerais da DAO.

```bash
builder dao info --token 0x880f... --chain base
builder dao info                    # usa defaults do .env

# Output:
# Gnars DAO (Base)
# Token:    0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17
# Auction:  0x494eaa55ecf6310658b8fc004b0888dcb698097f
# Governor: 0x3dd4e53a232b7b715c9ae455f4e732465ed71b4c
# Treasury: 0x72ad986ebac0246d2b3c565ab2a1ce3a14ce6f88
# Metadata: 0xdc9799d424ebfdcf5310f3bad3ddcce3931d4b58
# Supply:   1,234 tokens
# Owners:   456
```

#### `builder auction current`
Mostra o auction ativo.

```bash
builder auction current
builder auction current --json

# Output:
# Token #1235 — Current Auction
# Highest Bid: 0.042 ETH by vitalik.eth
# Ends: 2h 15m remaining
# Bids: 5
```

#### `builder auction history`
Lista auctions passados.

```bash
builder auction history --limit 10
builder auction history --json
```

#### `builder proposal list`
Lista propostas.

```bash
builder proposal list
builder proposal list --status active
builder proposal list --limit 20 --json

# Output:
# #  | Title                          | Status   | For  | Against | Quorum
# 42 | Sponsor Skater X               | EXECUTED | 85   | 12      | 50
# 41 | Community Event Fund           | ACTIVE   | 23   | 5       | 50
```

#### `builder proposal get <id>`
Detalhes de uma proposta.

```bash
builder proposal get 42
builder proposal get 0x1234...   # por proposalId hex

# Output completo com description, votes, calldatas, etc.
```

#### `builder proposal votes <id>`
Votos de uma proposta.

```bash
builder proposal votes 42
builder proposal votes 42 --support for
builder proposal votes 42 --json
```

#### `builder member list`
Lista membros da DAO.

```bash
builder member list
builder member list --sort votes
builder member list --active       # apenas membros ativos (votaram recentemente)
```

#### `builder member info <address>`
Detalhes de um membro.

```bash
builder member info 0x1234...
builder member info vitalik.eth    # resolve ENS
builder member info @username      # resolve via Farcaster

# Output:
# Member: vitalik.eth (0x1234...)
# Farcaster: @vitalik (1234 followers)
# Tokens: 3 (#12, #45, #67)
# Delegating to: self
# Proposals created: 5
# Votes cast: 42 (89% attendance)
```

#### `builder treasury balance`
Mostra o saldo do treasury.

```bash
builder treasury balance

# Output:
# Treasury: 0x72ad986ebac0246d2b3c565ab2a1ce3a14ce6f88
# ETH:  12.345
# USDC: 50,000.00
# WETH: 2.5
```

#### `builder token info <id>`
Informações de um token específico.

```bash
builder token info 42

# Output:
# Token #42
# Owner: vitalik.eth
# Image: https://ipfs.io/ipfs/Qm...
# Auction: Sold for 0.05 ETH on 2024-01-15
```

### 6.2 Core — Write Operations

#### `builder vote <proposalId> <support>`
Vota em uma proposta.

```bash
builder vote 42 for
builder vote 42 against --reason "Budget too high"
builder vote 42 abstain

# Requer PRIVATE_KEY no .env ou --private-key flag
```

#### `builder propose`
Cria uma proposta.

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

#### `builder auction bid <amount>`
Dá um bid no auction atual.

```bash
builder auction bid 0.05    # bid de 0.05 ETH
```

#### `builder delegate <address>`
Delega tokens para outro endereço.

```bash
builder delegate 0x1234...
builder delegate vitalik.eth
```

### 6.3 Discovery & Utilities

#### `builder discover <token-or-ens>`
Descobre e mostra todos os contratos de uma DAO.

```bash
builder discover 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base
builder discover gnars.eth --chain base

# Output:
# DAO Contracts discovered via Manager:
# token:    0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17
# auction:  0x494eaa55ecf6310658b8fc004b0888dcb698097f
# governor: 0x3dd4e53a232b7b715c9ae455f4e732465ed71b4c
# treasury: 0x72ad986ebac0246d2b3c565ab2a1ce3a14ce6f88
# metadata: 0xdc9799d424ebfdcf5310f3bad3ddcce3931d4b58
```

#### `builder config init`
Inicializa configuração local.

```bash
builder config init
# Cria .env.example e .builder-cli.toml
```

#### `builder config show`
Mostra configuração ativa.

```bash
builder config show
# Token: 0x880f... (from .env)
# Chain: base (from .env)
# RPC: https://mainnet.base.org
# Wallet: 0xABCD... (loaded)
```

---

## 7. Flags Globais

| Flag | Short | Description |
|------|-------|-------------|
| `--token <address>` | `-t` | Token address da DAO |
| `--chain <name>` | `-c` | Chain name: ethereum, base, optimism, zora |
| `--json` | `-j` | Output em JSON (para agentes) |
| `--quiet` | `-q` | Output mínimo (apenas dados essenciais) |
| `--rpc <url>` | | Custom RPC URL |
| `--private-key <key>` | | Private key para write ops (prefer .env) |
| `--help` | `-h` | Help |
| `--version` | `-v` | Version |

---

## 8. Integrações

### 8.1 ENS

- **Resolver nomes:** Converter ENS → address e address → ENS em toda a CLI
- **Onde:** Member addresses, proposer, voters, delegate targets
- **Como:** `viem`'s built-in `getEnsName()` / `getEnsAddress()` com mainnet client
- **Cache:** In-memory LRU cache (TTL 15min) para evitar queries repetidas

### 8.2 Etherscan V2 (Unified Multi-chain)

- **API unificada:** Uma API key funciona em 50+ chains
- **Base URL:** `https://api.etherscan.io/v2/api?chainid={CHAIN_ID}`
- **Contract info:** Verificar se contratos estão verificados
- **ABI fetch:** Fallback para buscar ABIs de contratos verificados (`module=contract&action=getabi`)
- **Transaction links:** Incluir links do explorer nos outputs
- **Rate limit:** 5 calls/sec com API key válida
- **Explorer URLs para links:**
  - Ethereum: `etherscan.io`
  - Base: `basescan.org`
  - Optimism: `optimistic.etherscan.io`
  - Zora: `explorer.zora.energy`

### 8.3 Farcaster (via Neynar)

- **Profile enrichment:** Mostrar username, display name, PFP de membros
- **Resolve por handle:** `builder member info @username` → busca address via Neynar
- **Batch lookup:** Para `member list`, batch-resolve addresses → FC profiles
- **Opcional:** Só ativa se `NEYNAR_API_KEY` estiver configurada

### 8.4 IPFS

- **Token images:** Resolver `ipfs://` URIs para gateway URLs
- **Proposal metadata:** Fetch de descrições armazenadas em IPFS
- **Gateways (fallback chain):**
  1. `https://ipfs.io`
  2. `https://dweb.link`
  3. `https://gateway.pinata.cloud`
  4. `https://w3s.link`

---

## 9. Stack Técnica

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| Runtime | Node.js (LTS) | Compatível com ecossistema |
| Linguagem | TypeScript (strict) | Type safety, DX |
| CLI Framework | `cac` | Leve, tree-shakeable, sem overhead |
| Blockchain | `viem` | Já usado no ecossistema Builder, type-safe |
| Subgraph | `graphql-request` | Leve, usado pela @buildeross/sdk |
| Schemas | `zod` | Validação de inputs e config |
| Output | Custom formatters | Table (humanos) + JSON (agentes) |
| Config | `dotenv` + TOML parser | Standard para CLI tools |
| Build | `tsup` | Fast, usado no monorepo Builder |
| Test | `vitest` | Fast, TS-native, usado no gnars-website |
| Lint | `eslint` + `prettier` | Standard |

### Dependências

```json
{
  "dependencies": {
    "viem": "^2.38.0",
    "graphql-request": "^7.1.0",
    "graphql": "^16.11.0",
    "cac": "^6.7.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsup": "^8.3.0",
    "vitest": "^2.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^22.0.0"
  },
  "optionalDependencies": {
    "@neynar/nodejs-sdk": "^2.0.0"
  }
}
```

**UNKNOWN:**
- `cac` vs `commander` vs `citty`: `cac` é mais leve e tree-shakeable, mas `citty` (do UnJS) é mais moderno. Decisão: começar com `cac` por ser provado no ecossistema (usado no mcp-subgraph). Avaliar `citty` se surgirem limitações.

---

## 10. Estrutura do Projeto

```
builder-cli/
├── CLAUDE.md                   # Instruções para LLMs
├── README.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .env.example
├── .gitignore
├── src/
│   ├── index.ts                # Entry point / CLI registration
│   ├── cli.ts                  # cac setup + global flags
│   ├── config/
│   │   ├── index.ts            # Config loader (env + toml + flags)
│   │   ├── chains.ts           # Chain definitions + Manager addresses
│   │   └── schema.ts           # Zod schemas for config validation
│   ├── core/
│   │   ├── resolver.ts         # DAO address resolution (Manager contract)
│   │   ├── subgraph.ts         # Subgraph GraphQL client
│   │   ├── client.ts           # Viem public + wallet client factory
│   │   └── abis/               # Contract ABIs
│   │       ├── manager.ts
│   │       ├── governor.ts
│   │       ├── auction.ts
│   │       ├── token.ts
│   │       ├── treasury.ts
│   │       └── metadata.ts
│   ├── commands/
│   │   ├── dao.ts              # dao info, dao discover
│   │   ├── auction.ts          # auction current, auction history, auction bid
│   │   ├── proposal.ts         # proposal list, proposal get, proposal votes
│   │   ├── member.ts           # member list, member info
│   │   ├── treasury.ts         # treasury balance
│   │   ├── token.ts            # token info
│   │   ├── vote.ts             # vote for/against/abstain
│   │   ├── propose.ts          # propose (create proposal)
│   │   ├── delegate.ts         # delegate tokens
│   │   └── config.ts           # config init, config show
│   ├── integrations/
│   │   ├── ens.ts              # ENS resolve + reverse
│   │   ├── etherscan.ts        # Etherscan API (contract info, tx links)
│   │   ├── farcaster.ts        # Neynar API (profiles, resolve handles)
│   │   └── ipfs.ts             # IPFS gateway resolution with fallback
│   ├── output/
│   │   ├── formatter.ts        # Output router (json/table/minimal)
│   │   ├── table.ts            # Human-readable table formatter
│   │   └── json.ts             # JSON output for agents
│   └── utils/
│       ├── format.ts           # ETH formatting, address truncation
│       ├── cache.ts            # In-memory LRU cache
│       └── errors.ts           # Error types and handling
├── tests/
│   ├── setup.ts
│   ├── core/
│   │   ├── resolver.test.ts    # DAO resolution tests
│   │   └── subgraph.test.ts    # Subgraph client tests
│   ├── commands/
│   │   ├── dao.test.ts
│   │   ├── proposal.test.ts
│   │   └── member.test.ts
│   └── integrations/
│       ├── ens.test.ts
│       └── farcaster.test.ts
└── bin/
    └── builder.ts              # Executable entry (#!/usr/bin/env node)
```

---

## 11. ABIs Necessários

Os ABIs estão disponíveis em `@buildeross/sdk/contract`:

| Contrato | Source | Funções-chave |
|----------|--------|---------------|
| **Manager** | `managerAbi` | `getAddresses(token)` → [metadata, auction, treasury, governor] |
| **Token** | `tokenAbi` | `getVotes(account)`, `getPastVotes(account, block)`, `delegates(account)`, `delegate(to)`, `totalSupply()`, `ownerOf(tokenId)`, `tokenURI(tokenId)` |
| **Auction** | `auctionAbi` | `auction()` → current auction, `createBid(tokenId)`, `settleCurrentAndCreateNewAuction()` |
| **Governor** | `governorAbi` | `propose(targets, values, calldatas, description)`, `castVote(proposalId, support)`, `castVoteWithReason(proposalId, support, reason)`, `state(proposalId)`, `proposalThreshold()`, `quorum()` |
| **Treasury** | `treasuryAbi` | `balance()`, `execute(target, value, data, description)` |
| **Metadata** | `metadataAbi` | `tokenURI(tokenId)`, property items |

**Decisão:** Copiar ABIs necessários da `@buildeross/sdk` para o projeto ao invés de depender do pacote inteiro (que puxa wagmi, React, etc. como peer deps). Extrair apenas os ABIs TypeScript.

---

## 12. Subgraph Queries

### Queries reutilizadas do gnars-website (adaptar para multi-DAO):

| Query | Source | Adaptação |
|-------|--------|-----------|
| DAO stats | `services/dao.ts` | Parametrizar `dao` ID |
| Proposals list | `services/proposals.ts` | Usar `@buildeross/sdk` ou query direta |
| Proposal detail + votes | `services/proposals.ts` | Já suporta by ID/number |
| Members list | `services/members.ts` | Parametrizar DAO |
| Member overview + votes | `services/members.ts` | Parametrizar DAO |
| Active members | `services/members.ts` | `fetchActiveMembers()` |
| Auctions | `services/auctions.ts` | Parametrizar DAO |
| Delegators | `services/members.ts` | `fetchDelegatorsWithCounts()` |

### Subgraph URL pattern:
```
https://api.goldsky.com/api/public/{projectId}/subgraphs/nouns-builder-{chain}-mainnet/latest/gn
```

**Chain mapping:**
- `ethereum` → `nouns-builder-ethereum-mainnet`
- `base` → `nouns-builder-base-mainnet`
- `optimism` → `nouns-builder-optimism-mainnet`
- `zora` → `nouns-builder-zora-mainnet`

---

## 13. Output Format

### Human (default)

```
$ builder proposal list

 #  │ Title                          │ Status   │ For │ Against │ Quorum
────┼────────────────────────────────┼──────────┼─────┼─────────┼───────
 42 │ Sponsor Skater X               │ EXECUTED │  85 │      12 │     50
 41 │ Community Event Fund           │ ACTIVE   │  23 │       5 │     50
 40 │ Website Redesign               │ DEFEATED │  15 │      30 │     50
```

### JSON (--json)

```json
{
  "dao": {
    "token": "0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17",
    "chain": "base",
    "chainId": 8453
  },
  "proposals": [
    {
      "proposalNumber": 42,
      "title": "Sponsor Skater X",
      "status": "EXECUTED",
      "forVotes": 85,
      "againstVotes": 12,
      "quorumVotes": 50,
      "proposer": "0x1234...",
      "proposerEns": "vitalik.eth",
      "voteStart": "2024-01-01T00:00:00Z",
      "voteEnd": "2024-01-08T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Minimal (--quiet)

```
42 EXECUTED "Sponsor Skater X"
41 ACTIVE "Community Event Fund"
```

---

## 14. Error Handling

| Cenário | Handling |
|---------|----------|
| Token address inválido | Mensagem clara + hint para `builder discover` |
| DAO não encontrada no Manager | "No DAO found at this address on {chain}" |
| RPC timeout | Retry 1x, depois erro com sugestão de custom RPC |
| Subgraph indisponível | Fallback para leitura on-chain quando possível |
| Wallet não configurada (write ops) | "Set PRIVATE_KEY in .env or use --private-key" |
| Insufficient funds / gas | Mensagem clara com balances |
| Neynar API key ausente | Silently skip Farcaster enrichment |
| ENS resolution fail | Usar address sem nome, sem erro |

---

## 15. Security

- **NUNCA** logar/exibir private keys
- Private key via `.env` (com `.gitignore`) ou `--private-key` (efêmero)
- Confirmar write operations antes de submeter tx (prompt y/n, skip com `--yes`)
- Validar todos os inputs com Zod antes de enviar on-chain
- Rate limiting para APIs externas (Etherscan: 5/s, Neynar: conforme plano)

---

## 16. MVP (Fase 1)

### Escopo

**Read operations (sem wallet):**
1. `builder dao info` — resolve + mostra contratos
2. `builder discover` — auto-discovery via Manager
3. `builder proposal list` — lista propostas
4. `builder proposal get` — detalhe de proposta
5. `builder proposal votes` — votos de proposta
6. `builder auction current` — auction ativo
7. `builder member list` — lista membros
8. `builder member info` — detalhe de membro
9. `builder treasury balance` — saldo do treasury
10. `builder config init` + `builder config show`

**Integrações MVP:**
- ENS resolve (nomes em outputs)
- Etherscan links em outputs
- Output JSON para agentes

**Fora do MVP:**
- Write operations (vote, propose, bid, delegate)
- Farcaster integration
- IPFS image resolution
- MCP server mode

### Métricas de Sucesso MVP

- [ ] `builder dao info` funciona com Gnars (Base), Purple (Ethereum), e pelo menos 1 DAO em cada chain suportada
- [ ] `--json` output parseável por agente
- [ ] Zero config: `builder discover 0x880f... --chain base` funciona sem .env
- [ ] < 3s para qualquer read operation (p95)

---

## 17. Fase 2: Write Operations

**Escopo:**
1. `builder vote <id> <for|against|abstain>`
2. `builder auction bid <amount>`
3. `builder delegate <address>`
4. `builder propose --from file.json`

**Requer:**
- Wallet integration via private key
- Transaction confirmation prompt
- Gas estimation + display
- Transaction tracking (hash + explorer link)

---

## 18. Fase 3: Enrichment & MCP

**Escopo:**
1. Farcaster profile enrichment
2. IPFS image resolution
3. MCP Server mode (reutilizar padrão do mcp-subgraph)
4. Proposal search (semantic, reutilizar padrão do mcp-subgraph)
5. `builder token traits` — download trait images

---

## 19. Implementação — Ordem

### Sprint 1: Foundation (Dias 1-3)
1. Setup projeto (package.json, tsconfig, tsup, vitest)
2. Config module (env + chains + Zod validation)
3. Core: Viem client factory
4. Core: DAO resolver (Manager contract)
5. Core: Subgraph client (GraphQL)
6. ABIs: Manager, Token, Governor, Auction, Treasury, Metadata
7. Tests: resolver, subgraph client

### Sprint 2: Read Commands (Dias 4-7)
1. CLI setup com `cac` + global flags
2. Output formatter (table + json + minimal)
3. `builder dao info` + `builder discover`
4. `builder proposal list` + `builder proposal get` + `builder proposal votes`
5. `builder auction current` + `builder auction history`
6. `builder member list` + `builder member info`
7. `builder treasury balance`
8. Tests para cada command

### Sprint 3: Integrations + Polish (Dias 8-10)
1. ENS integration
2. Etherscan links
3. `builder config init` + `builder config show`
4. Error handling + edge cases
5. README.md + CLAUDE.md
6. NPM publish prep

---

## 20. Publicação

```bash
# Nome do pacote
builder-dao-cli

# Binário
builder

# NPM
npx builder-dao-cli dao info --token 0x... --chain base

# Global install
pnpm add -g builder-dao-cli
builder dao info
```

---

## 21. UNKNOWN / Decisões Pendentes

- `TOML_CONFIG:` usar `.builder-cli.toml` ou só `.env`? → Começar com `.env` only, TOML se houver demanda
- `PACKAGE_NAME:` `builder-dao-cli` ou `builder-cli`? → Verificar disponibilidade no NPM
- `MCP_FIRST:` Priorizar MCP server mode no MVP? → Não, mas arquitetar para ser fácil adicionar (separar lógica dos commands)
- `MONO_OR_STANDALONE:` Monorepo com SDK separada ou pacote único? → Pacote único no MVP, split se crescer
- `EXISTING_SDK:` Usar `@buildeross/sdk` diretamente ou copiar o necessário? → Copiar ABIs + queries, evitar peer deps de React/Wagmi

---

## 22. Referências

| Recurso | Path/URL |
|---------|----------|
| Gnars CLI scripts (referência) | `/Users/r4to/Script/gnars-website/scripts/` |
| Gnars services (padrões) | `/Users/r4to/Script/gnars-website/src/services/` |
| Gnars config (addresses) | `/Users/r4to/Script/gnars-website/src/lib/config.ts` |
| Gnars MCP subgraph (padrão) | `/Users/r4to/Script/gnars-website/mcp-subgraph/` |
| Builder SDK (ABIs + subgraph) | `/Users/r4to/Script/gnars-website/references/nouns-builder/packages/sdk/` |
| Builder Constants (addresses) | `/Users/r4to/Script/gnars-website/references/nouns-builder/packages/constants/` |
| Builder monorepo | `https://github.com/BuilderOSS/nouns-builder` |
| Builder subgraphs (Goldsky) | `https://api.goldsky.com/api/public/project_cm33ek8kjx6pz010i2c3w8z25/subgraphs/` |
| nouns.build (frontend) | `https://nouns.build` |
| Builder docs | `https://docs.nouns.build` |
| Nouns Protocol contracts | `https://github.com/ourzora/nouns-protocol` |
| Nouns Protocol addresses | `https://github.com/ourzora/nouns-protocol/tree/main/addresses` |
| Etherscan V2 API | `https://api.etherscan.io/v2/api` (unified multi-chain) |
| Neynar API (Farcaster) | `https://docs.neynar.com/` |
| ProtocolRewards (all chains) | `0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B` |
