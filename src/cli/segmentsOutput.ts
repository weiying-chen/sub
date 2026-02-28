import { parseNews, parseSubs, type Segment } from '../analysis/segments'

export type BuildSegmentsOptions = {
  type: 'subs' | 'news'
  segmentIndex?: number | null
  ignoreEmptyLines?: boolean
}

export function buildSegmentsOutput(
  text: string,
  options: BuildSegmentsOptions
): Segment[] {
  const segments =
    options.type === 'subs'
      ? parseSubs(text, { ignoreEmptyLines: options.ignoreEmptyLines })
      : parseNews(text)

  if (
    options.segmentIndex == null ||
    options.segmentIndex < 0 ||
    options.segmentIndex >= segments.length
  ) {
    return segments
  }

  return [segments[options.segmentIndex]]
}
