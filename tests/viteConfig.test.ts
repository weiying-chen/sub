import { describe, expect, it } from "vitest"

import config from "../vite.config"
import packageJson from "../package.json"

describe("vite bundle config", () => {
  it("splits codemirror and react into separate manual chunks", () => {
    const build = config.build
    const output = build?.rollupOptions?.output
    const manualChunks =
      output && !Array.isArray(output) ? output.manualChunks : undefined

    expect(typeof manualChunks).toBe("function")
    if (typeof manualChunks !== "function") return

    expect(manualChunks("/virtual/node_modules/@uiw/react-codemirror/index.js")).toBe(
      "codemirror"
    )
    expect(manualChunks("/virtual/node_modules/@codemirror/view/dist/index.js")).toBe(
      "codemirror"
    )
    expect(manualChunks("/virtual/node_modules/react/index.js")).toBe("react-vendor")
  })

  it("does not keep eruda in runtime dependencies", () => {
    expect("eruda" in (packageJson.dependencies ?? {})).toBe(false)
  })
})
