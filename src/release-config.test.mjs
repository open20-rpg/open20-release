import assert from "node:assert/strict"
import { test } from "node:test"
import { RELEASE_RULES, releaseConfig } from "./release-config.mjs"

const plugin = (config, name) => config.plugins.find(([n]) => n === name)?.[1]

test("uses the shared rules and notes on main", () => {
  const config = releaseConfig({ notesScript: "/a/release-notes.mjs" })
  assert.deepEqual(config.branches, ["main"])
  assert.deepEqual(plugin(config, "@semantic-release/commit-analyzer").releaseRules, RELEASE_RULES)
  assert.match(
    plugin(config, "@semantic-release/exec").generateNotesCmd,
    /^node "\/a\/release-notes.mjs"/,
  )
})

test("without files to commit there's no release commit", () => {
  const config = releaseConfig({ notesScript: "x" })
  assert.equal(plugin(config, "@semantic-release/git"), undefined)
  assert.equal(plugin(config, "@semantic-release/exec").prepareCmd, undefined)
})

test("commits what prepare changes, and package.json with npm", () => {
  const config = releaseConfig({
    notesScript: "x",
    prepare: "node scripts/bump.mjs ${nextRelease.version}",
    commitAssets: "manifest.json\n popup/popup.html \n",
    npm: "true",
  })
  assert.equal(
    plugin(config, "@semantic-release/exec").prepareCmd,
    "node scripts/bump.mjs ${nextRelease.version}",
  )
  assert.deepEqual(plugin(config, "@semantic-release/git").assets, [
    "package.json",
    "package-lock.json",
    "manifest.json",
    "popup/popup.html",
  ])
  assert.ok(plugin(config, "@semantic-release/npm"))
})

test("attaches release assets, with an optional label", () => {
  const config = releaseConfig({
    notesScript: "x",
    releaseAssets: "dist/Pack.zip # Pack (última versión)\ndist/pack-*.zip",
  })
  assert.deepEqual(plugin(config, "@semantic-release/github").assets, [
    { path: "dist/Pack.zip", label: "Pack (última versión)" },
    { path: "dist/pack-*.zip" },
  ])
})
