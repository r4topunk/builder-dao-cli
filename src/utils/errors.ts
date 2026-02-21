export class BuilderCLIError extends Error {
  constructor(
    message: string,
    public readonly hint?: string
  ) {
    super(message)
    this.name = 'BuilderCLIError'
  }
}

export class DAONotFoundError extends BuilderCLIError {
  constructor(address: string, chain: string) {
    super(
      `No DAO found at ${address} on ${chain}`,
      `Use 'builder discover ${address} --chain ${chain}' to verify the address, or check the chain.`
    )
    this.name = 'DAONotFoundError'
  }
}

export class NoTokenConfiguredError extends BuilderCLIError {
  constructor() {
    super(
      'No DAO token address configured',
      'Set BUILDER_TOKEN_ADDRESS in .env or pass --token 0x...'
    )
    this.name = 'NoTokenConfiguredError'
  }
}

export class WalletNotConfiguredError extends BuilderCLIError {
  constructor() {
    super(
      'Wallet not configured for write operations',
      'Set PRIVATE_KEY in .env or pass --private-key 0x...'
    )
    this.name = 'WalletNotConfiguredError'
  }
}

export function handleError(error: unknown): never {
  if (error instanceof BuilderCLIError) {
    console.error(`\nError: ${error.message}`)
    if (error.hint) console.error(`Hint: ${error.hint}`)
  } else if (error instanceof Error) {
    console.error(`\nError: ${error.message}`)
  } else {
    console.error(`\nUnknown error: ${String(error)}`)
  }
  process.exit(1)
}
