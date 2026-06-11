import { describe, expect, it, vi } from "vitest"

import { fillSelectedTimestampSubs } from "../src/cm/fillSubs"

describe("fillSelectedTimestampSubs", () => {
  it("logs the chosen target cps", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const dispatch = vi.fn()
    const docText = "00:00:01:00\t00:00:03:00\tMarker\n"

    const view = {
      state: {
        doc: {
          length: docText.length,
          toString: () => docText,
          lineAt: () => ({ number: 1 }),
        },
        selection: {
          ranges: [{ from: 0, to: 0 }],
        },
      },
      dispatch,
    }

    fillSelectedTimestampSubs(view as never, "Hello world", {
      maxChars: 20,
    })

    expect(logSpy.mock.calls).toEqual(
      expect.arrayContaining([[ "[fillSubs] targetCps", expect.any(String) ]])
    )

    logSpy.mockRestore()
  })
})
