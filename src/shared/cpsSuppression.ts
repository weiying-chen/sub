import { stripSuppressionMarker } from './suppressionMarker'

export function stripCpsSuppressionMarker(text: string): {
  text: string
  suppressCps: boolean
} {
  const stripped = stripSuppressionMarker(text)
  return { text: stripped.text, suppressCps: stripped.hasMarker }
}
