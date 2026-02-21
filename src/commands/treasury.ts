import { getCli } from '../cli.js'
import { getDAOConfig } from '../core/resolver.js'
import { getPublicClient } from '../core/client.js'
import { printKeyValue } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { formatEth, truncateAddress } from '../utils/format.js'
import { handleError } from '../utils/errors.js'

const cli = getCli()

cli.command('treasury balance', 'Show treasury balance')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .action(async (options: { token?: string; chain?: string; json?: boolean }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const publicClient = getPublicClient(daoConfig.chain)

      const ethBalance = await publicClient.getBalance({ address: daoConfig.treasury })

      if (isJsonMode(options)) {
        printJson({
          treasury: daoConfig.treasury,
          chain: daoConfig.chain,
          ethBalance: ethBalance.toString(),
          ethFormatted: formatEth(ethBalance),
        })
        return
      }

      console.log(`\nTreasury: ${truncateAddress(daoConfig.treasury)}`)
      printKeyValue([
        ['ETH', formatEth(ethBalance)],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })
