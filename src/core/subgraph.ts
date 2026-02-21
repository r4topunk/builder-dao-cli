import { GraphQLClient } from 'graphql-request'
import { type ChainName } from '../config/index.js'
import { getGoldskyProjectId } from '../config/index.js'

const clientCache = new Map<string, GraphQLClient>()

export function getSubgraphClient(chain: ChainName): GraphQLClient {
  const projectId = getGoldskyProjectId()

  const chainName = chain === 'ethereum' ? 'ethereum'
    : chain === 'base' ? 'base'
    : chain === 'optimism' ? 'optimism'
    : 'zora'

  const url = `https://api.goldsky.com/api/public/${projectId}/subgraphs/nouns-builder-${chainName}-mainnet/latest/gn`

  if (clientCache.has(url)) {
    return clientCache.get(url)!
  }

  const client = new GraphQLClient(url, {
    headers: { 'Content-Type': 'application/json' },
  })

  clientCache.set(url, client)
  return client
}

export async function querySubgraph<T>(
  chain: ChainName,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const client = getSubgraphClient(chain)
  try {
    return await client.request<T>(query, variables)
  } catch (error) {
    throw new Error(`Subgraph query failed on ${chain}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
