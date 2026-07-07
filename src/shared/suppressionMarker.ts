export function stripSuppressionMarker(text: string): {
  text: string
  hasMarker: boolean
} {
  if (!/(?:^|[ \t])#\s*$/.test(text)) {
    return { text, hasMarker: false }
  }
  return { text: text.replace(/[ \t]*#\s*$/, ''), hasMarker: true }
}
