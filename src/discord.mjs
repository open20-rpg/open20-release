// The release announcement on Discord, all done by the Open20 bot:
//   announce  posts it when the release is created, with a status line while
//             the downloads are being prepared, and saves what's needed to
//             react to it and finish it later.
//   react     adds an emoji (found by name on the server) once a download or
//             a store is ready.
//   finish    drops the status line once everything is ready.
// Inputs come as environment variables (see the actions that call it):
// DISCORD_BOT_TOKEN always; MESSAGE_FILE; for announce TAG, TITLE, NOTES_FILE,
// RELEASE_URL, CHANNEL_ID, and optionally DOWNLOAD, STATUS and, for the banner
// image, BANNER_BACKGROUND, BANNER_ICON and RESVG_DIR (where resvg is
// installed); for react EMOJI.
// Usage: node src/discord.mjs announce|react|finish
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { bannerSvg, dataUrl, formatDate, renderBanner, summarize } from "./banner.mjs"

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
  // A FormData body sets its own multipart Content-Type.
  const json = typeof init.body === "string" ? { "Content-Type": "application/json" } : {}
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, ...json },
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

/** The banner PNG for this release, or null when the repo gives no images. */
async function banner({ tag, title, notes }) {
  const background = process.env.BANNER_BACKGROUND
  const icon = process.env.BANNER_ICON
  if (!background && !icon) return null
  const resvg = createRequire(`${required("RESVG_DIR")}/`)("@resvg/resvg-js")
  const svg = bannerSvg({
    title,
    version: tag,
    date: formatDate(new Date()),
    summary: summarize(notes),
    background: background && dataUrl(background),
    icon: icon && dataUrl(icon),
  })
  return renderBanner(svg, {
    resvg,
    fontsDir: fileURLToPath(new URL("../fonts", import.meta.url)),
  })
}

export async function announce() {
  const tag = required("TAG")
  const title = required("TITLE")
  const notes = readFileSync(required("NOTES_FILE"), "utf8")
  const { pending, final } = buildMessages({
    tag,
    title,
    notes,
    releaseUrl: required("RELEASE_URL"),
    download: process.env.DOWNLOAD,
    status: process.env.STATUS,
  })
  // A banner that fails to render must not hold back the announcement.
  const image = await banner({ tag, title, notes }).catch((error) => {
    console.log(`::warning::No banner: ${error.message}`)
    return null
  })
  const channelId = required("CHANNEL_ID")
  const send = (message) =>
    discord(`/channels/${channelId}/messages`, { method: "POST", body: message }, "Send message")
  let sent
  if (image) {
    // The image goes as an attachment, shown under the text. Editing the text
    // later (finish) keeps it.
    const message = new FormData()
    message.set("payload_json", body(pending))
    message.set("files[0]", new Blob([image], { type: "image/png" }), "banner.png")
    // Attaching needs its own permission ("Attach Files"): without it, or if
    // Discord rejects the file, the announcement goes out without the banner.
    sent = await send(message).catch((error) => {
      console.log(`::warning::Sent without the banner: ${error.message}`)
      return null
    })
  }
  sent ??= await send(body(pending))
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
  // Announcements from before open20-release don't keep their final text.
  if (!final) {
    console.log("This announcement has no final text: left as it is")
    return
  }
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
