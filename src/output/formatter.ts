export interface OutputOptions {
  json?: boolean
  quiet?: boolean
}

export function isJsonMode(opts: OutputOptions): boolean {
  return opts.json === true
}

export function isQuietMode(opts: OutputOptions): boolean {
  return opts.quiet === true
}
