import 'dotenv/config'

// Import command modules (they self-register with getCli())
import './commands/dao.js'
import './commands/proposal.js'
import './commands/auction.js'
import './commands/member.js'
import './commands/treasury.js'
import './commands/token.js'
import './commands/config.js'
import './commands/write.js'

import { getCli } from './cli.js'
import { handleError } from './utils/errors.js'

// cac requires multi-word commands as a single argv element
const SUBCOMMANDS: Record<string, Set<string>> = {
  dao: new Set(['info']),
  proposal: new Set(['list', 'get', 'votes', 'queue', 'execute']),
  auction: new Set(['current', 'history', 'bid', 'settle']),
  member: new Set(['list', 'info']),
  treasury: new Set(['balance']),
  token: new Set(['info']),
  config: new Set(['init', 'show']),
}

function preprocessArgv(argv: string[]): string[] {
  const result = [...argv.slice(0, 2)]
  let i = 2
  while (i < argv.length) {
    const arg = argv[i]!
    const next = argv[i + 1]
    if (arg in SUBCOMMANDS && next && SUBCOMMANDS[arg]!.has(next)) {
      result.push(`${arg} ${next}`)
      i += 2
    } else {
      result.push(arg)
      i++
    }
  }
  return result
}

// cac auto-converts 0x hex strings to numbers, losing precision.
// Extract raw string values for --token/-t from process.argv.
function getRawArgValue(argv: string[], flags: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    for (const flag of flags) {
      if (arg === flag && argv[i + 1]) return argv[i + 1]
      if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1)
    }
  }
  return undefined
}

const rawToken = getRawArgValue(process.argv, ['--token', '-t'])

// Patch global options after parse to restore hex values
const cli = getCli()
const parsed = cli.parse(preprocessArgv(process.argv), { run: false })

// Restore the raw token value if it was mangled
if (rawToken && parsed.options['token'] !== undefined) {
  parsed.options['token'] = rawToken
}

const result = cli.runMatchedCommand()
if (result && typeof result.catch === 'function') {
  result.catch(handleError)
}
