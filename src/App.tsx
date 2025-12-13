import { useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { overflowRule } from './cm/overflowRule'

export default function App() {
  const [value, setValue] = useState(
    'This line is short.\n' +
      'This line is definitely going to exceed fifty-five characters easily.\n'
  )

  const extensions = useMemo(() => [overflowRule(30)], [])

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
