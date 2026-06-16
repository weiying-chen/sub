export function stripCpsSuppressionMarker(text: string): {
  text: string
  suppressCps: boolean
} {
  if (!/(?:^|[ \t])#\s*$/.test(text)) {
    return { text, suppressCps: false }
  }
  return { text: text.replace(/[ \t]*#\s*$/, ''), suppressCps: true }
}
