export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
    2
  ))
}

export function toJsonSafe(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ))
}
