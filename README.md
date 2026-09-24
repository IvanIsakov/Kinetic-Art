# FARAWAY LANDSCAPES

An interactive Three.js fabric and lighting study for the kinetic sculpture described in `Doc/FARAWAY LANDSCAPES.docx`.

## Run locally

Use Node.js 22.12 or newer (or a later supported LTS release).

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

The `dist` folder is a static website. All runtime assets are local; no remote fonts, images, service, or credentials are needed. This milestone has not been published online.

## Explore the fabric

- Drag to orbit and scroll/pinch to zoom. The 3D, F and S buttons return to perspective, front and side views.
- Try Travelling wave and Radial ripple to see continuous movement. Circulating peak moves anticlockwise around the inner piston ring (viewed from the front), targeting 100% travel at one piston and 50% at its eight neighbours. Sequential pistons raises and lowers each piston in row order, skipping fixed perimeter pistons. It retracts the previous pattern first and limits tempo to permit full strokes. Percentages refer to the selected Travel; actual pistons slew between targets. Circulation advances every 0.5 pattern seconds (five times its original speed); fast targets may not reach full stroke because actuator speed remains limited. Rest / flat retracts the pistons; gravity and fabric ease still produce sag.
- Travel controls the pattern amplitude from 0 to 320 mm. Tempo changes the pattern speed. The actual pistons approach their targets at no more than 160 mm/s.
- Tension and stretch resistance now range from 0 to 3Ã—; 1Ã— is the old 100% maximum, not a physical unit. Tension removes excess fabric up to 1Ã— and adds prestrain above it (3Ã— uses rest lengths 20% shorter). Resistance above 1Ã— further reduces compliance. Both activate long-range tension constraints for a visibly tauter sheet.
- Damping controls how quickly movement settles.
- Fabric vertices offers 1,036, 1,813, 2,806, 4,015 (original), or 7,081 vertices. Lower levels reduce solver work and show coarser folds. Remeshing interpolates the existing surface and retains piston positions, manual overrides, material settings, and pattern time. Watch the cloth milliseconds and frame rate to compare. The coarse mesh changes the approximation; it is not a mechanically identical result.
- Piston-supported edges allow outer pistons to move; intervening edge vertices remain free. Fixed frame holds the whole perimeter and all outer pistons at zero extension, leaving (columns âˆ’ 2) Ã— (rows âˆ’ 2) interior pistons active. Switching edge modes resets the simulation to avoid abruptly moving attachments.
- Choose 5â€“10 columns and 4â€“10 rows in Piston matrix. Changing the grid restarts the simulation and clears manual overrides while retaining material, pattern, camera, and playback settings.
- Select a piston using the grid, or click near its attachment in the 3D view. Manual position overrides that piston. Release override returns it to the pattern. Selecting a new pattern clears all overrides.
- Softer shading applies one crease-aware averaging pass to the area-weighted vertex normals. Turn it off to compare the original normals. It changes neither the surface nor cast shadows.
- Mesh shows the simulation triangles. Mechanism hides the cloth to expose the piston assembly.
- Global Pause freezes fabric and LEDs. Animate fabric and Animate LEDs let you freeze either track independently. Restart resets both tracks, retaining the chosen configuration and manual piston overrides. Reduced-motion preferences start global playback paused.

## Explore the LEDs

Open the Lighting tab for 12â€“120 perimeter emitters, adjustable in single-LED increments. Choose Travelling spectrum, Perimeter chase, Rainbow perimeter chase, Steady color or Breathing light. Rainbow chase retains the moving chase envelope while cycling its hue once per lap. Distance from fabric rest plane moves the LED frame forward/backward from 50–1,500 mm (default 370 mm). It is measured from the flat sheet at zero piston travel, not from the currently deformed surface. Emitters and light sources follow, and supports extend back to the fixed frame. Change the cycle duration from 4â€“60 seconds, LED brightness from 0â€“300%, and ambient light from 0â€“100%. The color picker controls patterns other than Travelling spectrum and Rainbow perimeter chase. The small strip previews each LED in clockwise address order.

Uncheck Animate fabric in the Fabric tab, then use Perimeter chase to see lighting and shadows move across a stationary shape. Uncheck Animate LEDs to hold the lighting while the pistons continue. Turn off LED shadows to reduce rendering work. Turning LEDs off leaves only the ambient/studio lighting.

Every visible emitter has its own color and intensity. For performance, four representative spotlights provide the illumination and shadows, combining nearby LED states. This is an approximation, not an individual shadow map for every diode. Total illumination is normalized across LED counts so that a count comparison does not also change overall brightness. The forward rail defaults to 370 mm, ahead of the maximum 320 mm piston stroke, and connects to the rear frame with four standoffs.

## Model and numerical method

The panel is provisionally 2 m wide and 1.5 m tall. A configurable array of 20â€“100 addressable pistons supports an adjustable 36 Ã— 27 to 96 Ã— 72 subdivision mesh. The default is 72 Ã— 54, with 4,015 vertices. The cloth is a CPU position-based simulation with XPBD distance constraints for stretch and shear, weak two-hop distance constraints as a bending approximation, tension-only links to the four surrounding anchors at material settings above 1Ã—, gravity, velocity damping and deterministic initial imperfections. A 1/120-second fixed timestep separates physics from rendering; work per rendered frame is capped to avoid a catch-up spiral after interruptions.

Each piston pins a small multi-vertex patch. Both the visible head and rod stop behind the fabric: the head front has 10 mm clearance, and the rod stops at the head back. Free vertices are constrained by the frame opening, a rear clearance plane and the front faces of nearby piston heads. Positions and normals update the rendered mesh each frame. Independent perimeter LED patterns illuminate the fabric and room alongside adjustable studio lighting.

The diagnostic stretch values report extension of horizontal and vertical mesh edges relative to their eased rest lengths. Relief depth is the maximum minus minimum surface depth. High local strain identifies a demanding configuration; it is not a material-failure prediction.

The constraint approach is informed by the authors' [XPBD paper](https://matthias-research.github.io/pages/publications/XPBD.pdf) and [cloth notes](https://matthias-research.github.io/pages/tenMinutePhysics/14-cloth.pdf). Cloth rendering uses Three.js [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) with sheen and a subtle procedural weave.

## Current limits

This is a visual technical prototype, not validated mechanical engineering. There is no cloth self-collision, calibrated fabric elasticity, volumetric fabric thickness, full rod collision, tearing, or dihedral-angle bending model. Extremely loose or strongly deformed configurations can show numerical wrinkles or self-intersection. Physics slows under sustained frame rates below 20 fps rather than attempting unlimited catch-up. Material samples and hardware dimensions are needed for physical calibration.

Sheet dimensions remain fixed at 2 m Ã— 1.5 m. Keyframe editing, individual LED keyframe authoring, and deployment belong to later milestones in `IMPLEMENTATION_PLAN.md`.

## Verification

```sh
npm test
npm run build
```

The tests cover pattern bounds, speed and stroke limits, head/rod clearance, patch coverage across all 42 supported grids, fixed boundaries, abrupt pattern changes, extended material extremes, measured sag reduction, deterministic reset, settling, all five mesh resolutions, state-preserving remeshing, every LED count from 12â€“120, perimeter placement, bounded patterns and independent LED playback.

With the dev server running at port 5173 and Microsoft Edge installed:

```sh
node tests/browser-smoke.mjs
node tests/lighting-smoke.mjs
node tests/patterns-smoke.mjs
```

This checks live rendering, pause/resume, manual overrides, edge modes, camera presets, mesh and mechanism views, the 3Ã— material range, repeated grid rebuilds through 10 Ã— 10, actual rendered piston clearance, geometry cleanup, a narrow viewport and reduced motion. The lighting checks also cover resolution/UV rebuilding, pose preservation, LED count rebuilding, independent animation, shadow toggling, visible fabric illumination and resource cleanup. Both scripts save inspection screenshots under `tmp/qa`. A narrow desktop viewport is a layout test, not a real mobile-device performance test. Other browser engines and physical mobile devices have not yet been verified.

## Source layout

- `src/cloth.ts`: simulation, patterns, attachment mapping and diagnostics, independent of Three.js.
- `src/scene.ts`: geometry, material, studio lighting, camera and piston picking.
- `src/leds.ts`: perimeter layout and independently timed LED patterns.
- `src/led-scene.ts`: instanced emitters, rail and four representative shadow lights.
- `src/main.ts`: controls, fixed-step animation loop and browser diagnostics.
- `src/style.css`: responsive studio interface.
- `tests/cloth.test.ts`: numerical invariants and stability tests.
- `tests/leds.test.ts`: LED layout, bounds and pattern tests.
- `tests/browser-smoke.mjs` and `tests/lighting-smoke.mjs`: end-to-end browser checks and screenshots.

## Improving span behaviour

Equal-height adjacent pistons do not by themselves imply a straight fabric span: the rest of the two-dimensional sheet also pulls on it. Nevertheless, default slack, simplified bending and uncalibrated material properties can produce excessive ripples. The current two-hop bending constraints also share the in-plane rest-length scale, which should be separated.

Recommended next physics milestone: use a prestretched membrane with separately controlled stretch, shear and bending; replace two-hop bending with a dihedral-angle or isometric bending model; assign mass by surface area and scale material constraints consistently with mesh resolution. Validate a level-piston sheet, an isolated pair and a surrounding high/low configuration before tuning against real fabric samples. Higher tension can improve the current demonstration, but its 0–3× controls are not measured material properties.

Normals are recomputed from indexed triangles with Three.js computeVertexNormals (area-weighted shared-vertex averaging). Optional normal filtering only reduces shading noise; coarse geometry and shadow-map artifacts require separate treatment.


## Gallery presentation and saved configurations

The page opens in presentation mode: the sculpture in a white gallery with a ceiling, linear architectural lighting, a stone floor, and a realistic black 1.75 m human stencil. Room, perspective, front and side camera views are available. Open studio reveals all configuration controls; Back to gallery hides them. The human is a camera-facing, transparent silhouette. Gallery lighting follows the Ambient light control; LEDs retain independent brightness.

In Studio, enter a name and use Save named, or Save as favorite. Choose a saved configuration and Load to switch. Reusing a name replaces that saved configuration. All current fabric and light parameters are included: matrix, mesh resolution, material settings, piston pattern and overrides, travel, tempo, both animation switches, shading, inspection toggles, LED count/distance/pattern/color/period/brightness/ambient/shadows, global playback state, and the current fabric and piston pose. Loading preserves paused studies; reduced-motion preferences pause playback on startup. Inspection toggles are restored in the studio, while presentation always shows the fabric.

Saves are local to this browser and site address, not shared across devices or automatically published to investors. Export JSON backs up the current study; Import JSON validates and loads it, after which it can be saved locally. Browser storage limits produce a visible error and leave the existing library intact. Clearing browser data removes local configurations. Camera orbit and studio tab selection are not part of fabric/light configurations; startup uses the gallery camera.

The gallery and persistence milestone is implemented. User-authored choreography and online publication remain future work. Run `node tests/configurations-smoke.mjs` to verify default reload, full settings/override restoration, named switching, invalid imports, export/import, and desktop/mobile presentation layouts.


## GitHub Pages deployment

Pages uses the GitHub Actions source, with `.github/workflows/pages.yml` testing, building and deploying `dist` on every push to `main`. Vite uses relative asset URLs so the gallery and silhouette work beneath `/Kinetic-Art/`. The source TypeScript must not be served directly using Pages' branch publishing mode. Public site: https://ivanisakov.github.io/Kinetic-Art/ .

Gallery lighting now follows Ambient light, including ceiling illumination. The scale reference is a solid black, transparent photographic-style human stencil. Click the human and use arrow keys to move on the floor, Shift for larger steps, Escape or Done to deselect. The position is saved automatically in this browser and included in named/JSON configurations. Reloading restores the position in the published JSON; local named configurations can restore other placements. Localhost and the published site have separate browser storage; export/import transfers studies.

Asset: `public/assets/human-silhouette.png`, generated using the built-in image generation tool; the exact prompt is recorded alongside it. No external image service is needed at runtime.


## Shared startup configuration

The root `faraway-landscapes.json` is bundled into every production build and loaded on every page opening, including browsers with older local favorites. It contains the artist's shared startup settings, cloth pose, animation phase and human position. Reduced-motion preferences still pause autoplay. Local presets are retained for manual loading; Save as favorite marks a local preset without changing the public startup configuration. Load published default restores the shared configuration without reloading the page.

To change the default for everyone: export the desired study, replace `faraway-landscapes.json` at the repository root, commit and push to `main`. The Pages workflow publishes the new version automatically. The JSON is bundled with a content-hashed URL so new builds do not keep using an old cached configuration.

`node tests/published-default-smoke.mjs` verifies all control values, piston positions, overrides, animation phase and human placement in both clean and previously configured browsers.
