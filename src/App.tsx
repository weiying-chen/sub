import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'

import { analyzeLines } from './analysis/analyzeLines'
import { maxCharsRule } from './analysis/maxCharsRule'
import { cpsRule } from './analysis/cpsRule'
import { findingsDecorations } from './cm/findingsDecorations'

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
      // same text + contiguous timing to test your merge logic:
      'Short line.',
      '',
      '00:00:06:00\t00:00:08:00\t',
      'Short line.',
    ].join('\n')
  )

  const findings = useMemo(() => {
    return analyzeLines(value, [
      maxCharsRule(30),
      cpsRule(), // now should return CPS entries for timestamp blocks
    ])
  }, [value])

  const cpsViolations = useMemo(() => {
    return findings.filter((v) => v.type === 'CPS')
  }, [findings])

  useEffect(() => {
    console.log('CPS findings:', cpsViolations)
  }, [cpsViolations])

  const extensions = useMemo(() => {
    return [findingsDecorations(findings)]
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
