import { cac, type CAC } from 'cac'

let _cli: CAC | null = null

export function getCli(): CAC {
  if (!_cli) {
    _cli = cac('bdao')
    _cli
      .option('--token, -t <address>', 'Token address of the DAO')
      .option('--chain, -c <name>', 'Chain: ethereum, base, optimism, zora', { default: 'base' })
      .option('--json, -j', 'Output as JSON (for agents)')
      .option('--quiet, -q', 'Minimal output')
      .option('--rpc <url>', 'Custom RPC URL')

    _cli.help()
    _cli.version('0.1.0')
  }
  return _cli
}
