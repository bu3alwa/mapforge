# Mapforge

A browser-based map maker for tabletop RPGs. Paint terrain, draw dungeon rooms, place objects, or generate whole maps: dungeons, caves, towns and cities, forests, islands and lava fields. Export PNGs sized for Roll20, Foundry VTT or print.

## Run locally

```
npm install
npm run dev
```

## Build

```
npm run build
```

This outputs a static site to `dist/`, which can be hosted anywhere that serves static files.

## Deploy

```
npm run deploy
```

Builds the site and publishes it to the `gh-pages` branch, which GitHub Pages serves at https://bu3alwa.github.io/mapforge/.

## Code layout

- `src/main.ts`: editor UI, tools and input
- `src/render.ts`: terrain and object rendering, chunk cache
- `src/objects.ts`: object catalog and drawings
- `src/patterns.ts`: procedural terrain textures
- `src/gen/`: map generators
- `src/io.ts`: save/load, undo history, PNG export
