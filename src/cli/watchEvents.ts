export function shouldRunForWatchEvent(
  event: string,
  initialScanComplete: boolean
): boolean {
  return event === 'change' || (event === 'add' && initialScanComplete)
}
