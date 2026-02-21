# builder-dao-cli

> CLI open-source para agentes e humanos interagirem com qualquer DAO do [Builder Protocol](https://nouns.build).

## O que é

Uma ferramenta de linha de comando que auto-descobre e interage com qualquer DAO construída no Builder Protocol (Nouns Builder) — Gnars, Purple, Builder DAO, etc. Funciona em Ethereum, Base, Optimism e Zora.

Projetado para ser usado por agentes de IA e por humanos via terminal.

## Status

> **Pre-development** — PRD em [`docs/PRD.md`](docs/PRD.md).

## Features (planejadas)

- **Auto-discovery:** Resolve todos os contratos da DAO (Token, Auction, Governor, Treasury, Metadata) a partir do endereço do Token via Manager contract
- **Multi-chain:** Ethereum, Base, Optimism, Zora
- **Output dual:** Human-readable (tabela) ou `--json` para agentes
- **ENS:** Resolve nomes em todos os outputs
- **Etherscan V2:** Links de transação, verificação de contratos
- **Farcaster:** Perfis de membros via Neynar (opcional)

## Uso rápido

```bash
# Descobrir contratos de qualquer Builder DAO
builder discover 0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17 --chain base

# Listar propostas (output padrão)
builder proposal list

# Listar propostas (para agentes)
builder proposal list --json

# Detalhe de proposta
builder proposal get 42

# Auction atual
builder auction current

# Info de membro (com ENS)
builder member info vitalik.eth

# Treasury
builder treasury balance
```

## Config

```bash
# .env
BUILDER_TOKEN_ADDRESS=0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17
BUILDER_CHAIN=base
BASE_RPC_URL=https://mainnet.base.org

# Opcional
ETHERSCAN_API_KEY=
NEYNAR_API_KEY=
```

## Stack

| | |
|--|--|
| Runtime | Node.js LTS |
| Linguagem | TypeScript (strict) |
| CLI | `cac` |
| Blockchain | `viem` |
| Subgraph | `graphql-request` (Goldsky) |
| Validação | `zod` |
| Build | `tsup` |
| Tests | `vitest` |

## Chains suportadas

| Chain | Manager Address |
|-------|----------------|
| Ethereum | `0xd310a3041dfcf14def5ccbc508668974b5da7174` |
| Base | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` |
| Optimism | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` |
| Zora | `0x3ac0e64fe2931f8e082c6bb29283540de9b5371c` |

## Roadmap

- **MVP (Fase 1):** Read operations — dao, proposals, auction, members, treasury + ENS + Etherscan + JSON output
- **Fase 2:** Write operations — vote, propose, bid, delegate
- **Fase 3:** Farcaster enrichment + MCP server mode

Ver [`docs/PRD.md`](docs/PRD.md) para spec completa.

## Referências

- [Builder Protocol](https://nouns.build) — Frontend das DAOs
- [BuilderOSS/nouns-builder](https://github.com/BuilderOSS/nouns-builder) — SDK + subgraph
- [ourzora/nouns-protocol](https://github.com/ourzora/nouns-protocol) — Smart contracts
- [Goldsky Subgraph](https://api.goldsky.com/api/public/project_cm33ek8kjx6pz010i2c3w8z25/subgraphs/) — Indexer público

## Licença

MIT
