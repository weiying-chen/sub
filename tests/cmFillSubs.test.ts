// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

import { fillSelectedTimestampSubs } from "../src/cm/fillSubs"

describe("fillSelectedTimestampSubs", () => {
  const views: EditorView[] = []

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy()
    }
  })

  it("collapses the timestamp selection at the filled block end", () => {
    const doc = [
      "00:00:01:00\t00:00:02:00\tFirst",
      "00:00:02:00\t00:00:03:00\tSecond",
    ].join("\n")
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: EditorSelection.range(0, doc.length),
      }),
      parent: document.body,
    })
    views.push(view)

    fillSelectedTimestampSubs(view, "One line. Another line.", {
      maxChars: 20,
      inline: false,
    })

    expect(view.state.selection.main.empty).toBe(true)
    expect(view.state.selection.main.from).toBe(view.state.doc.length)
  })

  it("collapses to the filled block end when the selection head is at the end", () => {
    const doc = [
      "00:00:00:00\t00:00:01:00\tBefore",
      "Existing before.",
      "00:00:01:00\t00:00:02:00\tFirst",
      "00:00:02:00\t00:00:03:00\tSecond",
    ].join("\n")
    const selectedFrom = doc.indexOf("00:00:01:00")
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: EditorSelection.range(selectedFrom, doc.length),
      }),
      parent: document.body,
    })
    views.push(view)

    fillSelectedTimestampSubs(view, "One line. Another line.", {
      maxChars: 20,
      inline: false,
    })

    const nextDoc = view.state.doc.toString()
    const expectedCursor = nextDoc.indexOf(
      "\n00:00:02:00\t00:00:03:00\tSecond\nAnother line."
    ) + "\n00:00:02:00\t00:00:03:00\tSecond\nAnother line.".length

    expect(view.state.selection.main.empty).toBe(true)
    expect(view.state.selection.main.from).toBe(expectedCursor)
  })
})
