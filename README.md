# ENTITY — INKEY$

An audio-driven, polygonal skull emerging face-up through a fluid floor. The braincase expands and distorts, the jaw holds a scream, and musical attacks drive whole-head lunges against a stretched membrane neck.

**[Open the visualiser](https://mikekelly.github.io/inkey-entity/)**

## Use

Tap **Enter the Entity** to start audio. Intensity defaults to **70%**. Use the waveform to seek, Space to play/pause, and the arrow keys to skip five seconds. Soft light reduces flashes and secondary movement. Fullscreen and mute controls are included.

## Develop

Requires Node.js 22 or newer.

```sh
npm ci
npm run build
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8000. Source lives in `src.js`, `visuals.js` and `jaw-response.js`; HTML, CSS, credits and assets live in `dist/`. The build bundles JavaScript into `dist/app.js`.

Every push to `main` builds and deploys `dist/` to GitHub Pages using the included Actions workflow. No backend or API keys are required.

## Audio and animation

Native HTML audio playback starts from a user gesture, with a retry if the browser blocks it. Offline analysis extracts 48 frequency bands, overall energy and sharp attacks. The player's current time drives the animation, including after seeking. Bass and overall energy control emergence; upper-head deformation, colour and whole-body struggle respond at different scales. The jaw holds through short gaps instead of chattering on every beat.

The 0–100% intensity control maps to a 0–1.6 internal multiplier. Rendering requires WebGL 2. Actual performance and audio behaviour vary by device.

## Models and attribution

The toothless skull and separate mandible derive from **BodyParts3D / Anatomography 4.3**, © The Database Center for Life Science (DBCLS), under **Creative Commons Attribution–ShareAlike 2.1 Japan**. The adapted anatomical and faceted geometry retains that licence. See [model credits](dist/credits.html) and [provenance](dist/assets/anatomy-provenance.json) for the source, exact parts, licence links and modifications.

`import-anatomy.mjs <directory-of-source-OBJ-files>` creates anatomical binaries from the listed source parts. `node facet-anatomy.mjs` creates the simplified flat-shaded variants. Both geometry sets are included, so neither conversion is needed for normal builds.

Third-party library licences are retained in the generated bundle. The included soundtrack is separate from the anatomical model licence; no music redistribution licence is granted by this README.
