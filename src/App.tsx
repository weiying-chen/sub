import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'

import { analyzeLines } from './analysis/analyzeLines'
import { maxCharsRule } from './analysis/maxCharsRule'
import { cpsRule } from './analysis/cpsRule'
import { findingsDecorations } from './cm/findingsDecorations'
import { timestampLinkGutter } from './cm/timestampLinkGutter'
import type { Metric, Finding } from './analysis/types'

export default function App() {
  const [value, setValue] = useState(
    [
      '00:00:00:00\t00:00:02:00\t',
      'This line is way too long for two seconds.',
      '',
      '00:00:02:00\t00:00:04:00\t',
      'Short line.',
      '',
      '00:00:04:00\t00:00:06:00\t',
      'Short line.',
      '',
      '00:00:06:00\t00:00:08:00\t',
      'Short line.',
    ].join('\n')
  )

  const metrics = useMemo<Metric[]>(() => {
    return analyzeLines(value, [maxCharsRule(54), cpsRule()])
  }, [value])

  const cpsMetrics = useMemo(() => {
    return metrics.filter((m) => m.type === 'CPS')
  }, [metrics])

  const findings = useMemo<Finding[]>(() => {
    const out: Finding[] = []

    for (const m of metrics) {
      if (m.type === 'MAX_CHARS') {
        if (m.actual > m.maxAllowed) out.push(m)
        continue
      }

      if (m.type === 'CPS') {
        if (m.cps > m.maxCps) out.push(m)
        continue
      }
    }

    return out
  }, [metrics])

  useEffect(() => {
    console.log('ALL metrics:', metrics)
  }, [metrics])

  useEffect(() => {
    console.log('ALL CPS metrics:', cpsMetrics)
  }, [cpsMetrics])

  const cpsFindings = useMemo(() => {
    return findings.filter((f) => f.type === 'CPS')
  }, [findings])

  useEffect(() => {
    console.log('CPS findings:', cpsFindings)
  }, [cpsFindings])

  const extensions = useMemo(() => {
    return [
      timestampLinkGutter(findings),
      findingsDecorations(findings),
    ]
  }, [findings])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CodeMirror
        value={value}
        onChange={setValue}
        height="100vh"
        width="100vw"
        basicSetup={{ drawSelection: false }}
        extensions={extensions}
      />
    </div>
  )
}
