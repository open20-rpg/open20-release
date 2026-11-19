import assert from "node:assert/strict"
import { test } from "node:test"
import { formatNotes, HEADING, NOTHING, sentence } from "./release-notes.mjs"

test("labels each user-facing commit and leaves the rest out", () => {
  const notes = formatNotes([
    { subject: "fix: los rasgos vuelven a abrir su página" },
    { subject: "feat(mana): barra de maná" },
    { subject: "docs: README" },
    { subject: "perf: el mapa carga más rápido" },
    { subject: "ci: workflows" },
    { subject: "Merge branch 'feat/x'" },
  ])
  assert.equal(
    notes,
    [
      HEADING,
      "",
      "- **Nuevo**: Barra de maná.",
      "- **Mejora**: El mapa carga más rápido.",
      "- **Corrección**: Los rasgos vuelven a abrir su página.",
    ].join("\n"),
  )
})

test("lists breaking changes first, from the footer when there's one", () => {
  const notes = formatNotes([
    {
      subject: "feat: nuevo formato",
      body: "BREAKING CHANGE: los mapas viejos\nya no abren\n\nmore",
    },
    { subject: "fix!: atajos nuevos" },
  ])
  assert.deepEqual(notes.split("\n").slice(2), [
    "- **Cambio importante**: Los mapas viejos ya no abren.",
    "- **Cambio importante**: Atajos nuevos.",
    "- **Nuevo**: Nuevo formato.",
    "- **Corrección**: Atajos nuevos.",
  ])
})

test("drops repeated lines", () => {
  const notes = formatNotes([{ subject: "fix: algo" }, { subject: "fix: algo" }])
  assert.equal(notes.split("\n").length, 3)
})

test("says something when there's nothing to list", () => {
  assert.equal(formatNotes([{ subject: "chore: x" }]), `${HEADING}\n\n${NOTHING}`)
})

test("keeps a sentence's own punctuation", () => {
  assert.equal(sentence("hola (beta)"), "Hola (beta)")
  assert.equal(sentence("¿anda?"), "¿anda?")
})
