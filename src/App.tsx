import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'

import { analyzeLines } from './analysis/analyzeLines'
import { maxCharsRule } from './analysis/maxCharsRule'
import { cpsRule } from './analysis/cpsRule'
import { violationsDecorations } from './cm/violationsDecorations'

export default function App() {
  const [value, setValue] = useState(
    'This line is short.\n' +
      'This line is definitely going to exceed fifty-five characters easily.\n'
  )

  const violations = useMemo(() => {
    return analyzeLines(value, [
      maxCharsRule(30),
      cpsRule(), // stub for now
    ])
  }, [value])

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
