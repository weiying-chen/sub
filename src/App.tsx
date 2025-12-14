import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'

import { analyzeLines } from './analysis/analyzeLines'
import { maxCharsRule } from './analysis/maxCharsRule'
import { cpsRule } from './analysis/cpsRule'
import { violationsDecorations } from './cm/violationsDecorations'

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

  const violations = useMemo(() => {
    return analyzeLines(value, [
      maxCharsRule(30),
      cpsRule(), // now should return CPS entries for timestamp blocks
    ])
  }, [value])

  const cpsViolations = useMemo(() => {
    return violations.filter((v) => v.type === 'CPS')
  }, [violations])

  useEffect(() => {
    console.log('CPS violations:', cpsViolations)
  }, [cpsViolations])

  const extensions = useMemo(() => {
    return [violationsDecorations(violations)]
  }, [violations])

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
