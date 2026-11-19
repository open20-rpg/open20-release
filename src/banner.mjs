// The image under the Discord announcement: the app's own background, its
// icon, its name, and the release (version, date, how many changes of each
// kind). Drawn as SVG and rendered to PNG with resvg, with the fonts in fonts/.
import { readFileSync } from "node:fs"
import { extname } from "node:path"

export const WIDTH = 1200
export const HEIGHT = 400

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

// Labels as release-notes.mjs writes them, with singular and plural.
const KINDS = [
  ["Cambio importante", "cambio importante", "cambios importantes"],
  ["Nuevo", "novedad", "novedades"],
  ["Mejora", "mejora", "mejoras"],
  ["Corrección", "corrección", "correcciones"],
]

/** "19 nov 2026" */
export function formatDate(date) {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** "1 novedad · 2 correcciones", from the release notes. */
export function summarize(notes) {
  return KINDS.map(([label, one, many]) => {
    const count = (notes.match(new RegExp(`^- \\*\\*${label}\\*\\*:`, "gm")) ?? []).length
    return count === 0 ? "" : `${count} ${count === 1 ? one : many}`
  })
    .filter(Boolean)
    .join(" · ")
}

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
}

/** A file as a data URL, to embed it in the SVG. */
export function dataUrl(path) {
  const mime = MIME[extname(path).toLowerCase()]
  if (!mime) throw new Error(`${path}: the banner takes PNG, JPEG or SVG images`)
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`
}

/** The banner as SVG. Images are data URLs (or anything resvg can load). */
export function bannerSvg({ title, version, date, summary, icon, background }) {
  const details = [date, summary].filter(Boolean).join("  ·  ")
  const pill = 36 + version.length * 27
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#0b0b0c" stop-opacity=".94"/>
      <stop offset=".55" stop-color="#0b0b0c" stop-opacity=".78"/>
      <stop offset="1" stop-color="#0b0b0c" stop-opacity=".35"/>
    </linearGradient>
    <clipPath id="tile"><rect x="72" y="112" width="176" height="176" rx="38"/></clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0b0b0c"/>
  ${background ? `<image href="${background}" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/>` : ""}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>
  <rect x="72" y="112" width="176" height="176" rx="38" fill="#0b0b0c"/>
  ${icon ? `<image href="${icon}" x="72" y="112" width="176" height="176" clip-path="url(#tile)" preserveAspectRatio="xMidYMid meet"/>` : ""}
  <text x="292" y="146" font-family="Montserrat" font-weight="600" font-size="22" letter-spacing="4" fill="#e04a4a">NUEVA VERSIÓN</text>
  <text x="290" y="212" font-family="Montserrat" font-weight="800" font-size="58" fill="#ece6dd">${escape(title)}</text>
  <rect x="292" y="238" width="${pill}" height="56" rx="14" fill="#a70909"/>
  <text x="${292 + pill / 2}" y="279" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="38" fill="#ece6dd">${escape(version)}</text>
  <text x="${292 + pill + 22}" y="276" font-family="Montserrat" font-weight="600" font-size="24" fill="#b9b2a8">${escape(details)}</text>
  <rect y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="#a70909"/>
</svg>`
}

/** The banner as PNG, with resvg (from the path given, installed by the action). */
export async function renderBanner(svg, { resvg, fontsDir }) {
  const { Resvg } = resvg
  const fonts = ["Montserrat-SemiBold.ttf", "Montserrat-ExtraBold.ttf"].map(
    (f) => `${fontsDir}/${f}`,
  )
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH * 2 },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  }).render()
  return rendered.asPng()
}
