// The release announcement on Discord, all done by the Open20 bot:
//   announce  posts it when the release is created, with a status line while
//             the downloads are being prepared, and saves what's needed to
//             react to it and finish it later.
//   react     adds an emoji (found by name on the server) once a download or
//             a store is ready.
//   finish    drops the status line once everything is ready.
// Inputs come as environment variables (see the actions that call it):
// DISCORD_BOT_TOKEN always; MESSAGE_FILE; for announce TAG, TITLE, NOTES_FILE,
// RELEASE_URL, CHANNEL_ID, and optionally DOWNLOAD and STATUS; for react EMOJI.
// Usage: node src/discord.mjs announce|react|finish
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

// Discord rejects messages over 2000 characters.
export const DISCORD_LIMIT = 2000

const API_URL = "https://discord.com/api/v10"

/** The list lines of the release notes; headings and blank lines are left out. */
export function noteLines(notes) {
  return notes
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
}

/**
 * The announcement, with and without its status line. Lines that don't fit
 * Discord's limit (measured with the status) are summed up in a last line, so
 * both versions show the same changes.
 */
export function buildMessages({ tag, title, notes, releaseUrl, download = "", status = "" }) {
  const render = (lines, withStatus) =>
    [
      `# ¡Nueva versión ${tag} de ${title}!`,
      lines.join("\n"),
      download ? `**Descargar:** ${download}` : "",
      withStatus ? status : "",
      `Más información: ${releaseUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n")

  const all = noteLines(notes)
  let shown = all
  for (let count = all.length; count >= 0; count--) {
    const omitted = all.length - count
    shown = [...all.slice(0, count), ...(omitted > 0 ? [`…y ${omitted} cambios más.`] : [])]
    if (render(shown, true).length <= DISCORD_LIMIT) break
  }
  return { pending: render(shown, true), final: render(shown, false) }
}

async function discord(path, init, what) {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error("DISCORD_BOT_TOKEN is required")
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  })
  if (!response.ok) {
    throw new Error(`${what} failed: ${response.status} ${await response.text()}`)
  }
  return response.status === 204 ? null : response.json()
}

// SUPPRESS_EMBEDS: no preview cards for the links. No mentions: the text comes
// from commit messages.
const body = (content) =>
  JSON.stringify({ content, flags: 1 << 2, allowed_mentions: { parse: [] } })

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function announce() {
  const { pending, final } = buildMessages({
    tag: required("TAG"),
    title: required("TITLE"),
    notes: readFileSync(required("NOTES_FILE"), "utf8"),
    releaseUrl: required("RELEASE_URL"),
    download: process.env.DOWNLOAD,
    status: process.env.STATUS,
  })
  const channelId = required("CHANNEL_ID")
  const sent = await discord(
    `/channels/${channelId}/messages`,
    { method: "POST", body: body(pending) },
    "Send message",
  )
  writeFileSync(required("MESSAGE_FILE"), JSON.stringify({ channelId, messageId: sent.id, final }))
  console.log(`Announced ${process.env.TAG}`)
}

async function react() {
  const { channelId, messageId } = JSON.parse(readFileSync(required("MESSAGE_FILE"), "utf8"))
  const name = required("EMOJI")
  const channel = await discord(`/channels/${channelId}`, {}, "Get channel")
  const emojis = await discord(`/guilds/${channel.guild_id}/emojis`, {}, "List emojis")
  const emoji = emojis.find((e) => e.name === name)
  if (!emoji) throw new Error(`No emoji named ${name} on the server`)
  await discord(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(`${name}:${emoji.id}`)}/@me`,
    { method: "PUT" },
    "Add reaction",
  )
  console.log(`Reacted with ${name}`)
}

async function finish() {
  const { channelId, messageId, final } = JSON.parse(readFileSync(required("MESSAGE_FILE"), "utf8"))
  await discord(
    `/channels/${channelId}/messages/${messageId}`,
    { method: "PATCH", body: body(final) },
    "Edit message",
  )
  console.log("Announcement finished")
}

const COMMANDS = { announce, react, finish }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = COMMANDS[process.argv[2]]
  if (!command) {
    console.error("usage: node src/discord.mjs announce|react|finish")
    process.exit(1)
  }
  try {
    await command()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
