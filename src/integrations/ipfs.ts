const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/',
]

export function resolveIpfsUrl(uri: string): string {
  if (!uri) return uri
  if (uri.startsWith('ipfs://')) {
    const cid = uri.slice(7)
    return `${IPFS_GATEWAYS[0]}${cid}`
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri
  }
  if (uri.startsWith('data:')) {
    return uri
  }
  return `${IPFS_GATEWAYS[0]}${uri}`
}

export function getIpfsGateways(cid: string): string[] {
  return IPFS_GATEWAYS.map(g => `${g}${cid}`)
}
