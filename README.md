# open20-release

Los releases de las apps de [Open20](https://open20.app), iguales en todos los
repos: versión, notas y GitHub Release con semantic-release, y el anuncio en el
Discord de Open20. Son acciones de GitHub que cada repo usa desde sus
workflows con `@v1`.

## Cómo se publica una versión

Cada push a `main` corre `release`. Lee los commits
([Conventional Commits](https://www.conventionalcommits.org)) desde la última
versión y, si hay alguno que ve quien usa la app, publica una nueva:

| Commit                                 | Versión | En las notas          |
| -------------------------------------- | ------- | --------------------- |
| `feat:`                                | patch   | **Nuevo**             |
| `perf:`                                | patch   | **Mejora**            |
| `fix:`                                 | patch   | **Corrección**        |
| `!` o footer `BREAKING CHANGE:`        | minor   | **Cambio importante** |
| `docs:`, `chore:`, `ci:`, `refactor:`… | ninguna | —                     |

El asunto del commit **es** la línea de las notas: se escribe en español, para
quien usa la app. Las notas quedan así:

```markdown
## Esta actualización incluye:

- **Nuevo**: Barra de maná con la regla opcional de puntos de conjuro.
- **Corrección**: Los rasgos y dotes vuelven a abrir su página en el panel.
```

## Acciones

### `release`

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0
- uses: actions/setup-node@v7
  with:
    node-version: 24
- uses: open20-rpg/open20-release/release@v1
  id: release
  with:
    # Opcionales:
    prepare: node scripts/bump-version.mjs ${nextRelease.version}
    commit-assets: |
      manifest.json
    release-assets: |
      dist/App.zip # App (última versión)
    npm: "true" # también package.json y package-lock.json
# steps.release.outputs.version / .tag: vacíos si no se publicó nada.
```

El repo no lleva `.releaserc.json`: la configuración sale de la acción. Si
`prepare` cambia archivos, van en `commit-assets` y semantic-release los
commitea como `chore(release): vX.Y.Z [skip ci]`.

### `discord-announce`, `discord-react` y `discord-finish`

El bot de Open20 anuncia la versión en `#anuncios` apenas se crea la release,
con una línea de estado mientras se preparan las descargas. Cada build
reacciona con el emoji de su plataforma cuando su descarga está lista, y al
final se quita la línea de estado.

```yaml
- uses: open20-rpg/open20-release/discord-announce@v1
  with:
    tag: ${{ steps.release.outputs.tag }}
    title: Open20 Battle Maps
    download: https://open20.app/battle-maps
    status: "⏳ Las descargas se están preparando: cada plataforma suma su ✅ cuando está lista."
    bot-token: ${{ secrets.DISCORD_BOT_TOKEN }}

# En cada build, cuando su descarga ya está en la release:
- uses: open20-rpg/open20-release/discord-react@v1
  with:
    tag: v1.2.3
    emoji: windows_ready
    bot-token: ${{ secrets.DISCORD_BOT_TOKEN }}

# Cuando todo terminó (también si algún build falló):
- uses: open20-rpg/open20-release/discord-finish@v1
  with:
    tag: v1.2.3
    bot-token: ${{ secrets.DISCORD_BOT_TOKEN }}
```

- `DISCORD_BOT_TOKEN` es un secret de la organización. Sin él, las tres
  acciones no hacen nada.
- El bot necesita, en el canal: ver el canal, enviar mensajes, leer el
  historial y agregar reacciones.
- Los emojis se buscan por nombre en el servidor. Los de las plataformas están
  en [`emojis/`](emojis): `windows_ready`, `macos_silicon_ready`,
  `macos_intel_ready`, `linux_ready` y `android_ready`. Nivel21 usa
  `github_ready`, `chrome_ready` y `firefox_ready`.
- `discord-react` nunca hace fallar el job: un emoji que no está o un anuncio
  que no existe son solo un aviso.
- El anuncio guarda los IDs del mensaje en la release
  (`discord-message.json`), así que rehacer un build de una versión vieja
  reacciona al mismo mensaje.

## Versiones de este repo

Se publica a sí mismo con `release`, y el tag `v1` sigue a la última versión
`1.x`. Un cambio que rompe a los repos que lo usan es un breaking change: sube
a `v2` a mano, moviendo los repos de a uno.
