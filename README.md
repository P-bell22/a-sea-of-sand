# A Sea of Sand

An interactive aerial dune simulation with wind controls, a continuous desert view, and a separate diagram showing how grains move over a dune.

[Open the public simulation](https://p-bell22.github.io/a-sea-of-sand/)

## Run the simulation

Download [a-sea-of-sand.html](./a-sea-of-sand.html) and open it in a browser with hardware acceleration enabled. The file contains its JavaScript and styles and works offline; it does not require a server or an account.

- Drag the landscape or use the left and right arrow keys to turn the camera.
- Switch between Aerial, Above and Grain journey.
- Adjust wind strength, direction and viewing height, or enable automatic wind variation.
- Pause, restart, or change the speed target up to 1,000 model cycles per second. The actual-rate readout shows the achieved speed.

## Model and limitations

The terrain stores sand on a 256 × 256 grid with 6 m spacing. Wind transfers sand between cells, sheltered areas promote deposition, and gravity relaxes steep slopes toward a 32° repose criterion. Periodic boundaries conserve sand and let the simulated patch repeat into the distance.

At speeds up to 20 cy/s, the model uses detailed individual cycles. Higher settings use larger, approximate transport steps to fast-forward the landscape. They advance model time and move more sand per update, but do not reproduce every individual detailed cycle. Strong and changing winds use shorter steps. The simulation is a simplified bulk-sediment model, not a calibrated reconstruction of a real desert; model cycles are not calendar years. Fine surface ripples are smaller than the grid and are omitted.

## Build the HTML

Use Node.js 22.13 or newer and npm:

```sh
npm ci
npm run build:html
```

This regenerates `index.html` for GitHub Pages, the root `a-sea-of-sand.html` download, and the copy in `public/`. GitHub Pages serves the `main` branch root; rebuilding and pushing updates the public simulation. The standalone build uses `standalone.tsx` and `standalone.config.ts`. The separate `npm run dev` and `npm run build` commands retain the original Sites/Vinext development and hosting setup.

## Source and checks

- `app/sediment.ts`: sand transport, deposition, creep and avalanching.
- `app/wind.ts`: playback, wind variation and fast-forward integration.
- `app/terrain.ts`: WebGL terrain rendering and the grain diagram.
- `app/page.tsx`: controls, readouts and scientific notes.

```sh
node --experimental-strip-types tests/sediment.mjs
node --experimental-strip-types tests/fast-forward.mjs
node --experimental-strip-types tests/playback.mjs
node --experimental-strip-types tests/rendering.mjs
```

See [tests/README.md](./tests/README.md) for validation scope and performance measurements.

## Background

- [Werner (1995), Eolian dunes: Computer simulations and attractor interpretation](https://sseh.uchicago.edu/doc/Werner_1995.pdf)
- [USGS: Dune types](https://pubs.usgs.gov/gip/deserts/dunes/)
- [USGS: Geology of Great Sand Dunes National Park](https://www.usgs.gov/geology-and-ecology-of-national-parks/geology-great-sand-dunes-national-park)
