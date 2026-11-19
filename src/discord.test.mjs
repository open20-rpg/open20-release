import assert from "node:assert/strict"
import { test } from "node:test"
import { buildMessages, DISCORD_LIMIT, noteLines } from "./discord.mjs"

const NOTES = `## Esta actualización incluye:

- **Nuevo**: Barra de maná.
- **Corrección**: Los rasgos vuelven a abrir su página.
`

const base = {
  tag: "v1.7.8",
  title: "Nivel21",
  notes: NOTES,
  releaseUrl: "https://github.com/open20-rpg/nivel21/releases/tag/v1.7.8",
  download: "https://open20.app/nivel21",
  status: "⏳ Preparando las descargas.",
}

test("leaves headings out of the notes", () => {
  assert.deepEqual(noteLines(NOTES), [
    "- **Nuevo**: Barra de maná.",
    "- **Corrección**: Los rasgos vuelven a abrir su página.",
  ])
})

test("shows the status only until it's finished", () => {
  const { pending, final } = buildMessages(base)
  assert.equal(
    pending,
    [
      "# ¡Nueva versión v1.7.8 de Nivel21!",
      "- **Nuevo**: Barra de maná.\n- **Corrección**: Los rasgos vuelven a abrir su página.",
      "**Descargar:** https://open20.app/nivel21",
      "⏳ Preparando las descargas.",
      "Más información: https://github.com/open20-rpg/nivel21/releases/tag/v1.7.8",
    ].join("\n\n"),
  )
  assert.equal(final, pending.replace("⏳ Preparando las descargas.\n\n", ""))
})

test("skips what's not given", () => {
  const { pending, final } = buildMessages({ ...base, download: "", status: "" })
  assert.equal(pending, final)
  assert.ok(!pending.includes("Descargar"))
})

test("fits Discord's limit and counts what was left out, the same in both versions", () => {
  const lines = Array.from({ length: 200 }, (_, i) => `- **Nuevo**: Cambio número ${i}.`)
  const { pending, final } = buildMessages({ ...base, notes: lines.join("\n") })
  assert.ok(pending.length <= DISCORD_LIMIT)
  const shown = pending.split("\n").filter((l) => l.startsWith("- ")).length
  assert.ok(pending.includes(`…y ${200 - shown} cambios más.`))
  assert.equal(final, pending.replace(`${base.status}\n\n`, ""))
})
