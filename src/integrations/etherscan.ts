import { type ChainName, getChainConfig } from '../config/index.js'

export function getExplorerBaseUrl(chain: ChainName): string {
  return getChainConfig(chain).explorerUrl
}

export function getExplorerTxUrl(hash: string, chain: ChainName): string {
  return `${getExplorerBaseUrl(chain)}/tx/${hash}`
}

export function getExplorerAddressUrl(address: string, chain: ChainName): string {
  return `${getExplorerBaseUrl(chain)}/address/${address}`
}

export function getExplorerTokenUrl(address: string, chain: ChainName): string {
  return `${getExplorerBaseUrl(chain)}/token/${address}`
}

export function getEtherscanApiUrl(chain: ChainName): string {
  const chainConfig = getChainConfig(chain)
  return `https://api.etherscan.io/v2/api?chainid=${chainConfig.chainId}`
}

const CHAIN_ID_MAP: Record<ChainName, number> = {
  ethereum: 1,
  base: 8453,
  optimism: 10,
  zora: 7777777,
}

export async function fetchContractAbi(
  address: string,
  chain: ChainName
): Promise<unknown[] | null> {
  const apiKey = process.env['ETHERSCAN_API_KEY']
  if (!apiKey) return null

  const chainId = CHAIN_ID_MAP[chain]
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${address}&apikey=${apiKey}`

  try {
    const response = await fetch(url)
    const data = await response.json() as { status: string; result: string }
    if (data.status !== '1') return null
    return JSON.parse(data.result) as unknown[]
  } catch {
    return null
  }
}

export async function isContractVerified(
  address: string,
  chain: ChainName
): Promise<boolean> {
  const abi = await fetchContractAbi(address, chain)
  return abi !== null
}
