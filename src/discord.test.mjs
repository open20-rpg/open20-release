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

test("announces with the banner as an attachment, and saves the final text", async () => {
  const { mkdtempSync, writeFileSync, readFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { announce } = await import("./discord.mjs")
  const dir = mkdtempSync(join(tmpdir(), "announce-"))
  writeFileSync(join(dir, "notes.md"), NOTES)
  writeFileSync(
    join(dir, "icon.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>',
  )
  Object.assign(process.env, {
    DISCORD_BOT_TOKEN: "x",
    TAG: "v1.7.8",
    TITLE: "Nivel21",
    NOTES_FILE: join(dir, "notes.md"),
    RELEASE_URL: base.releaseUrl,
    STATUS: base.status,
    CHANNEL_ID: "123",
    MESSAGE_FILE: join(dir, "message.json"),
    BANNER_ICON: join(dir, "icon.svg"),
    RESVG_DIR: process.env.RESVG_DIR ?? "",
  })
  const sent = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init })
    return new Response(JSON.stringify({ id: "456" }), { status: 200 })
  }
  try {
    await announce()
  } finally {
    globalThis.fetch = realFetch
  }
  assert.equal(sent.length, 1)
  assert.equal(sent[0].url, "https://discord.com/api/v10/channels/123/messages")
  const saved = JSON.parse(readFileSync(join(dir, "message.json"), "utf8"))
  assert.deepEqual(Object.keys(saved), ["channelId", "messageId", "final"])
  assert.equal(saved.messageId, "456")
  assert.ok(!saved.final.includes(base.status))
  if (process.env.RESVG_DIR) {
    // With resvg installed, the banner goes as a PNG next to the JSON payload.
    const form = sent[0].init.body
    assert.ok(form instanceof FormData)
    assert.ok(JSON.parse(form.get("payload_json")).content.includes(base.status))
    const png = new Uint8Array(await form.get("files[0]").arrayBuffer())
    assert.deepEqual([...png.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47])
  }
})
