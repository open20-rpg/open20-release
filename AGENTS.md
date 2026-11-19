# open20-release

Acciones de GitHub compartidas por los repos de Open20 (Open20 Battle Maps,
Nivel21, Open20 Essentials) para publicar versiones y anunciarlas en Discord.
Ver el [README](README.md) para qué hace cada una y cómo se usan.

## Estructura

- `release/`, `discord-announce/`, `discord-react/`, `discord-finish/`: una
  acción compuesta (`action.yml`) por carpeta. Solo pasan sus inputs como
  variables de entorno a los scripts de `src/`.
- `src/release-config.mjs`: la configuración de semantic-release (reglas de
  versión, plugins). `src/release-notes.mjs`: las notas.
  `src/discord.mjs`: el anuncio, las reacciones y la edición final.
  `src/banner.mjs`: la imagen del anuncio (SVG a PNG con resvg, que la acción
  instala al usarla; no es una dependencia del repo).
- `fonts/`: Montserrat para el banner (licencia OFL, `fonts/OFL.txt`).
- `emojis/`: los emojis de las plataformas que se suben al servidor de Discord.

Node.js sin dependencias: los tests usan `node:test` (`npm test`; con
`RESVG_DIR` apuntando a una instalación de `@resvg/resvg-js` también prueban
el banner renderizado).

## Reglas

- **Nunca trabajes en `main`.** Cada push a `main` publica una versión y el
  tag `v1` que usan todos los repos pasa a apuntar a ella: un error acá rompe
  los releases de todas las apps. Trabajá en una rama propia
  (`feat/…`, `fix/…`) y no mergees sin que te lo pidan.
- Las reglas de versión y el formato de las notas son los mismos para todos
  los repos a propósito: no agregues opciones para que un repo sea distinto.
- Un cambio que obliga a los repos a cambiar sus workflows es un breaking
  change y va en una versión mayor nueva (`v2`), no en `v1`.
- Lógica nueva en `src/` lleva su test en el `*.test.mjs` de al lado.
- Conventional Commits en español, igual que los otros repos. Commits a
  nombre de quien los hace (`user.name` y `user.email` de git), sin trailers
  ni líneas de atribución (`Co-Authored-By` u otros).
