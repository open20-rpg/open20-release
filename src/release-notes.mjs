// Release notes for the people who use the app, from the Conventional Commits
// since the last release: one line per feat (Nuevo), perf (Mejora) or fix
// (Corrección), plus the breaking changes. semantic-release uses what this
// prints as the GitHub Release text, which is also what Discord announces.
// Usage: node src/release-notes.mjs [<last release commit>]
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const LABELS = { feat: "Nuevo", perf: "Mejora", fix: "Corrección" }
const BREAKING = "Cambio importante"
const ORDER = [BREAKING, "Nuevo", "Mejora", "Corrección"]

export const HEADING = "## Esta actualización incluye:"
export const NOTHING = "- Correcciones y mejoras menores."

/** A commit description as a sentence: capitalized, with a final period. */
export function sentence(text) {
  const clean = text.replace(/\s+/g, " ").trim()
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1)
  return /[.!?…)]$/.test(capitalized) ? capitalized : `${capitalized}.`
}

/** The notes for these commits ({ subject, body }), oldest first. */
export function formatNotes(commits) {
  const items = []
  for (const { subject, body = "" } of commits) {
    const match = /^(\w+)(?:\([^)]*\))?(!)?:\s*(.+)$/.exec(subject.trim())
    if (!match) continue
    const [, type, bang, description] = match
    // The footer runs until the next blank line, and can span several lines.
    const footer = /^BREAKING[ -]CHANGE:\s*/m.exec(body)
    const breaking = footer && body.slice(footer.index + footer[0].length).split("\n\n")[0]
    if (bang || breaking) items.push([BREAKING, sentence(breaking || description)])
    if (LABELS[type]) items.push([LABELS[type], sentence(description)])
  }
  const lines = [
    ...new Set(
      items
        .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
        .map(([label, text]) => `- **${label}**: ${text}`),
    ),
  ]
  return `${HEADING}\n\n${lines.length > 0 ? lines.join("\n") : NOTHING}`
}

function commitsSince(lastRelease) {
  // Fields split by \x1f, commits by \x1e: subjects and bodies can hold anything.
  const log = execFileSync(
    "git",
    [
      "log",
      "--no-merges",
      "--reverse",
      "--format=%s%x1f%b%x1e",
      lastRelease ? `${lastRelease}..HEAD` : "HEAD",
    ],
    { encoding: "utf8" },
  )
  return log
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject, body] = entry.split("\x1f")
      return { subject, body }
    })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(formatNotes(commitsSince(process.argv[2])))
}
