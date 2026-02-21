import { formatEther } from 'viem'

export function formatEth(value: bigint, decimals = 4): string {
  const eth = parseFloat(formatEther(value))
  return eth.toFixed(decimals).replace(/\.?0+$/, '') + ' ETH'
}

export function truncateAddress(address: string, chars = 6): string {
  if (address.length < chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-4)}`
}

export function formatAddress(address: string, ensName?: string | null): string {
  if (ensName) return `${ensName} (${truncateAddress(address)})`
  return truncateAddress(address)
}

export function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString()
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) return 'ended'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (parts.length === 0) parts.push('< 1m')

  return parts.join(' ')
}

export function formatTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000)
  const remaining = endTime - now
  if (remaining <= 0) return 'ended'
  return `${formatDuration(remaining)} remaining`
}

export function formatNumber(n: number | bigint): string {
  return Number(n).toLocaleString()
}

export function shortenHash(hash: string, chars = 8): string {
  return `${hash.slice(0, chars + 2)}...${hash.slice(-4)}`
}

export function explorerTxLink(hash: string, explorerUrl: string): string {
  return `${explorerUrl}/tx/${hash}`
}

export function explorerAddressLink(address: string, explorerUrl: string): string {
  return `${explorerUrl}/address/${address}`
}
