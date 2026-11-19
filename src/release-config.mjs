// Writes the semantic-release config for the `release` action from its inputs
// (passed as environment variables).
// Usage: node src/release-config.mjs > .releaserc.json
import { fileURLToPath } from "node:url"

// The same for every Open20 repo: every change visible to users is a patch,
// a breaking change a minor. Majors are never automatic.
export const RELEASE_RULES = [
  { breaking: true, release: "minor" },
  { type: "feat", release: "patch" },
  { type: "fix", release: "patch" },
  { type: "perf", release: "patch" },
]

const lines = (text = "") =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

/** The semantic-release config for these inputs. */
export function releaseConfig({
  prepare = "",
  commitAssets = "",
  releaseAssets = "",
  npm = "false",
  notesScript,
}) {
  const usesNpm = npm === "true"
  const exec = {
    // A lodash template for @semantic-release/exec, not a JS template string.
    generateNotesCmd: `node "${notesScript}" \${lastRelease.gitHead || ''}`,
    successCmd:
      'echo "version=${nextRelease.version}" >> "$GITHUB_OUTPUT" && ' +
      'echo "tag=${nextRelease.gitTag}" >> "$GITHUB_OUTPUT"',
  }
  if (prepare.trim()) exec.prepareCmd = prepare.trim()

  const committed = [
    ...(usesNpm ? ["package.json", "package-lock.json"] : []),
    ...lines(commitAssets),
  ]
  const attached = lines(releaseAssets).map((line) => {
    // "path # label" gives the file a label on the release page.
    const [path, label] = line.split(/\s+#\s+/)
    return label ? { path, label } : { path }
  })

  return {
    branches: ["main"],
    tagFormat: "v${version}",
    plugins: [
      [
        "@semantic-release/commit-analyzer",
        { preset: "conventionalcommits", releaseRules: RELEASE_RULES },
      ],
      ...(usesNpm ? [["@semantic-release/npm", { npmPublish: false }]] : []),
      ["@semantic-release/exec", exec],
      ...(committed.length > 0
        ? [
            [
              "@semantic-release/git",
              {
                assets: committed,
                message:
                  "chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
              },
            ],
          ]
        : []),
      [
        "@semantic-release/github",
        {
          ...(attached.length > 0 ? { assets: attached } : {}),
          successComment: false,
          failComment: false,
          releasedLabels: false,
        },
      ],
    ],
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env
  const config = releaseConfig({
    prepare: env.PREPARE,
    commitAssets: env.COMMIT_ASSETS,
    releaseAssets: env.RELEASE_ASSETS,
    npm: env.NPM,
    notesScript: fileURLToPath(new URL("./release-notes.mjs", import.meta.url)),
  })
  console.log(JSON.stringify(config, null, 2))
}
