import { getCli } from '../cli.js'
import { getDAOConfig } from '../core/resolver.js'
import { getPublicClient } from '../core/client.js'
import { tokenAbi } from '../core/abis/token.js'
import { printKeyValue } from '../output/table.js'
import { printJson } from '../output/json.js'
import { isJsonMode } from '../output/formatter.js'
import { truncateAddress } from '../utils/format.js'
import { handleError } from '../utils/errors.js'

const cli = getCli()

cli.command('token info <id>', 'Show token information')
  .option('--token, -t <address>', 'Token address')
  .option('--chain, -c <chain>', 'Chain name', { default: 'base' })
  .option('--json, -j', 'JSON output')
  .action(async (id: string, options: { token?: string; chain?: string; json?: boolean }) => {
    try {
      const daoConfig = await getDAOConfig(options)
      const publicClient = getPublicClient(daoConfig.chain)
      const tokenId = BigInt(id)

      const [owner, tokenUri] = await Promise.all([
        publicClient.readContract({
          abi: tokenAbi,
          address: daoConfig.token,
          functionName: 'ownerOf',
          args: [tokenId],
        }) as Promise<`0x${string}`>,
        publicClient.readContract({
          abi: tokenAbi,
          address: daoConfig.token,
          functionName: 'tokenURI',
          args: [tokenId],
        }) as Promise<string>,
      ])

      if (isJsonMode(options)) {
        printJson({
          tokenId: id,
          owner,
          tokenUri,
        })
        return
      }

      console.log(`\nToken #${id}`)
      printKeyValue([
        ['Owner', truncateAddress(owner)],
        ['URI  ', tokenUri],
      ])
      console.log()
    } catch (error) {
      handleError(error)
    }
  })
