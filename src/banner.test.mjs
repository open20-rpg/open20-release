import assert from "node:assert/strict"
import { test } from "node:test"
import { bannerSvg, formatDate, summarize } from "./banner.mjs"

test("dates in Spanish", () => {
  assert.equal(formatDate(new Date("2026-11-19T08:00:00Z")), "19 nov 2026")
  assert.equal(formatDate(new Date("2027-01-02T23:00:00Z")), "2 ene 2027")
})

test("counts each kind of change, singular and plural", () => {
  const notes = [
    "## Esta actualización incluye:",
    "",
    "- **Cambio importante**: A.",
    "- **Nuevo**: B.",
    "- **Corrección**: C.",
    "- **Corrección**: D.",
  ].join("\n")
  assert.equal(summarize(notes), "1 cambio importante · 1 novedad · 2 correcciones")
  assert.equal(summarize("## Esta actualización incluye:\n\n- Correcciones y mejoras menores."), "")
})

test("shows the release and escapes the text", () => {
  const svg = bannerSvg({
    title: "Dungeons & <Maps>",
    version: "v1.2.3",
    date: "19 nov 2026",
    summary: "1 novedad",
    icon: "data:image/png;base64,AA==",
    background: "",
  })
  assert.match(svg, /Dungeons &amp; &lt;Maps&gt;/)
  assert.match(svg, />v1\.2\.3</)
  assert.match(svg, /19 nov 2026 {2}· {2}1 novedad/)
  assert.match(svg, /data:image\/png;base64,AA==/)
  assert.doesNotMatch(svg, /preserveAspectRatio="xMidYMid slice"/)
})
