# FARAWAY LANDSCAPES implementation plan

Build a browser-based, interactive 3D model that communicates the sculpture's exploration of impermanence through a changing fabric landscape and independently moving light. The first deliverable should be a compelling investor demonstration, followed by the complete configuration and choreography tools described in the project brief.

This plan is based on `Doc/FARAWAY LANDSCAPES.docx`, including its three mechanical diagrams and concept image, and the separate concept PNG in `Doc`. The folder currently contains reference material and no application code.

## 1. Scope and interpretation

The brief specifies a 2 m by 1.5 m addressable piston matrix, stretchable fabric attached to the pistons, a perimeter of addressable LEDs, and a Three.js browser simulation. It requires configurable hardware geometry, individual piston control, playable piston and LED patterns, realistic fabric movement, shadows and ambient lighting, camera rotation and zoom, room materials, and a person for scale.

Use the diagrams to establish the mechanism and the rendered concept image to guide atmosphere, materials, and presentation. The image is an artistic reference, not a dimensional drawing or proof of physically achievable lighting.

Provisional choices for the first prototype, all editable or replaceable:

- Interpret the panel as 2 m wide and 1.5 m tall, mounted vertically, with pistons moving perpendicular to its surface. Confirm orientation before final scene approval because the illustrations appear taller than wide.
- Start with an 8-column by 6-row matrix and 120 perimeter LEDs. These are software starting values, not specified hardware counts.
- Define piston size with separate body length, diameter, and tip radius. Interpret travel percentage as maximum stroke divided by body length, and display the resulting stroke in millimetres. Confirm this interpretation before completing the setup editor.
- Attach fabric to the piston tips. Compare a fixed perimeter against perimeter points that move with boundary pistons; the brief does not fully specify the edge restraint.
- Use a neutral gallery and a 1.7 m human figure with editable placement. Room dimensions, panel mounting height, and human height remain configurable.

The model will demonstrate appearance and choreography. Mechanical load calculations, fabric failure prediction, fabrication drawings, real hardware control, and financial projections are outside this implementation.

## 2. Investor experience

Provide two views of the same simulation:

**Presentation view:** a clean, full-screen gallery scene with a short project statement, Play/Pause, three demonstration chapters, camera presets, and an unobtrusive option to explore. A proposed 60â€“90 second sequence moves from a flat, quietly lit surface to a slowly shifting landscape, then holds the fabric still while light travels around it, and finally combines both movements at different tempos. This sequence should make the independence of geometry and light immediately understandable.

**Studio view:** expandable controls for system setup, piston selection, fabric tuning, piston patterns, LED patterns, room appearance, and playback. Keep advanced controls out of the initial presentation so the sculpture remains the focal point.

Visual direction: dark metal mechanism, pale textured fabric, restrained gallery surfaces, and deliberate grazing light. Use warm white as a baseline and colour as a selectable artistic treatment. Include front, three-quarter, side/mechanism, and room-wide camera presets. A mechanism view may hide the fabric to explain construction.

## 3. Technical structure

Use TypeScript, Three.js, and a lightweight Vite application with ordinary HTML/CSS controls. Keep the initial application static and client-side; there is no requirement for accounts, a database, or a server. Select and pin compatible dependency versions when implementation begins.

Separate the simulation from presentation controls:

| Component | Responsibility |
| --- | --- |
| Project configuration | Dimensions, piston grid, stroke, LEDs, fabric parameters, room, camera and versioned presets |
| Sculpture builder | Frame, piston bodies and moving rods, tip attachments and LED placement |
| Piston controller | Per-piston targets, travel limits, smooth speed-limited motion and overrides |
| Fabric solver | Attachment constraints, stretch, bending, gravity and damping |
| Light controller | Per-LED state and its approximation by scene lights |
| Pattern engine | Independent piston and LED tracks driven by a common transport |
| Scene renderer | Materials, shadows, room, person, camera and quality settings |
| Interface and storage | Presentation/studio controls, validation, save/load and JSON import/export |

Use metres internally and millimetres where useful in controls. Define a stable row/column piston ID and a documented clockwise LED order. Rebuild dependent geometry safely when grid size changes, resetting incompatible per-piston tracks with a clear explanation.

Use instancing for repeated piston and LED geometry where practical. Three.js provides [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) for this representation and [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) for orbit and zoom interaction.

## 4. Fabric implementation

Treat the fabric as the first technical milestone. Smooth deformation alone will not reproduce the tension, folds, and delayed settling that sell the sculpture.

1. Build a subdivided fabric mesh with attachment patches corresponding to piston tips, rather than sharp single-vertex spikes.
2. Prototype a position-based cloth solver with stretch, shear and bending constraints, gravity, damping, and a fixed simulation timestep. Start on the CPU and profile before introducing workers or GPU complexity.
3. Drive attachment targets from actual simulated piston positions. Keep geometric surface detail independent of piston count.
4. Add practical collision constraints around tips, frame and the rear support where required. Test extreme neighbouring piston offsets for penetration and instability.
5. Recompute normals as the mesh deforms; add subtle fabric texture and roughness without using texture to disguise incorrect geometry.
6. Expose a small set of understandable parameters such as tension, stretch resistance and damping. Keep solver tuning internal.

Prototype both edge-restraint interpretations before choosing the default. Validate rest, one extended piston, opposite neighbouring offsets, a travelling wave, and rapid pattern changes. Seek artist review of whether the surface should appear taut, softly folded, or substantially loose.

If full cloth simulation cannot sustain the target frame rate, reduce mesh resolution and solver iterations first. A smooth interpolated surface can be a clearly identified low-quality fallback, but it does not satisfy the realistic-fabric milestone. Physical calibration remains approximate until fabric samples and attachment details exist.

## 5. LEDs and shadows

Maintain separate representations for visible LED emitters and illumination. Every LED has an addressable colour and intensity, while a bounded number of nearby representative lights illuminate the scene. Emissive LED materials alone will not deliver the required projected lighting.

Prototype grazing illumination early, including the offset and aim of the LED rail relative to the fabric. Compare a small number of shadow-casting lights against a higher-quality reference configuration. Three.js shadow maps require additional scene rendering from each shadow-casting light, making unrestricted per-LED shadows an expensive baseline; see the official [shadow guide](https://threejs.org/manual/pages/shadows.html).

Start by profiling approximately 4â€“8 representative shadow lights on desktop, then set quality-tier budgets from measurements. Keep the light pool stable and vary its state smoothly to avoid visible jumps as lit regions move. Preserve individual visible LEDs even when their illumination is grouped. Document this approximation in the studio/help view.

Provide ambient intensity, LED brightness and colour, plus room material controls. Check shadows on the fabric itself, frame, floor and walls. Coloured shadow regions should result from coloured illumination and occlusion; do not paint fixed coloured shapes onto the fabric. Bloom is optional polish and cannot substitute for illumination.

## 6. Patterns and editing

Implement a shared transport with Play, Pause, Restart, loop duration and time position. Piston and LED tracks each have their own speed, phase, pattern, and enabled state, allowing synchronized or independent movement.

- Piston presets: flat, travelling wave, radial ripple, slow breathing and smoothly evolving seeded noise.
- LED presets: steady white, perimeter chase, travelling gradient and slow colour drift.
- Individual control: select a piston in the scene or grid, display its ID and position, and apply a manual target override with an explicit release action.
- Authoring: save parameterized patterns first; then add keyframes for selected pistons/groups and LED ranges, including duration and easing. Both are required for the complete editor.
- Persistence: store named projects locally and export/import versioned JSON. Include configuration, tracks, seed, room and camera settings. Offer curated built-in presets through shareable URL identifiers; arbitrary edited projects can travel as JSON files initially.

Make seeking deterministic by resetting and replaying the fixed-step simulation, adding cached checkpoints if needed. Do not assume a cloth state can be recovered solely from a pattern's target position at a given time.

## 7. Build sequence and estimates

These are planning estimates for one developer experienced in browser graphics, assuming timely artistic feedback. They exclude engineering validation of the physical sculpture and production of bespoke human assets.

| Phase | Estimated effort | Reviewable deliverable and exit condition |
| --- | --- | --- |
| 1. Confirm model conventions | 1â€“2 days | Dimensioned blockout and configuration schema; orientation, travel definition and boundary assumptions recorded |
| 2. Prove fabric and lighting | 4â€“6 days | Small piston grid with fabric and moving perimeter illumination; believable folds, stable attachments and clearly moving shadows on the chosen demo device |
| 3. Assemble investor demonstration | 4â€“6 days | Full-size sculpture, gallery, human figure, camera presets and a complete guided sequence; presentation works without opening studio controls |
| 4. Complete configuration and choreography | 4â€“6 days | All setup fields, individual control, separate tracks, keyframes and reliable save/load; each requirement in the brief is demonstrable |
| 5. Polish and release | 3â€“5 days | Browser/device verification, quality modes, fallback image, final copy, screenshots, hosted build and recorded demonstration |

Total estimated effort: 16â€“25 working days. An investor preview is targeted after phases 1â€“3, approximately 9â€“14 working days. Re-estimate after phase 2 because fabric appearance and light performance determine the remaining scope.

Do not invest heavily in editor polish until the fabric-and-light prototype passes visual review. A convincing presentation is the critical dependency.

## 8. Verification and acceptance

Choose and record a reference presentation laptop and a representative mobile device during phase 1. Proposed performance targets are at least 30 fps during the complete demonstration at 1080p on that laptop, with 60 fps as a stretch goal. Measure sustained performance and memory during a ten-minute loop. Mobile may use lower cloth and shadow quality.

Completion requires:

- The 2 m by 1.5 m configuration is represented consistently, with an appropriately scaled human and visible dimensional annotations in studio view.
- Changing piston counts, body dimensions, travel percentage and LED count rebuilds the model without stale controls, invalid geometry, or unbounded allocations. Supported limits are based on benchmarks.
- Individual pistons respond, respect travel bounds and carry their fabric attachments with them.
- Fabric settles without exploding, detaching or showing persistent obvious intersections under the supported patterns.
- Piston animation continues with the LED track paused, and vice versa. A stationary fabric surface visibly receives moving illumination and shadows.
- Ambient lighting, room surfaces, orbit, zoom and human placement work as specified.
- Saved projects reproduce configuration and choreography after reload; malformed or incompatible imports produce readable errors.
- Presentation controls support keyboard use, readable contrast and reduced-motion preferences. A still preview and explanation appear if the 3D renderer is unavailable.
- Verify the current desktop Chrome, Edge, Firefox and Safari, plus a representative mobile browser, using real devices or an available browser-testing service. Record any untested platform explicitly.

Automate meaningful checks for stroke conversion, target bounds, pattern determinism, independent track timing and project serialization. Combine these with interaction smoke tests and visual review of rest, maximum deformation, moving lights, and presentation framing.

## 9. Delivery and decisions

Deliver source code, setup/build instructions, a static production build, curated demo presets, a hosted investor link, selected screenshots, and a short recorded walkthrough as a backup for live meetings. Choose the host and public versus restricted access before publishing. Restricted access requires hosting-level protection; hiding a link alone is insufficient.

The decisions needed before visual sign-off are panel orientation, piston dimensions and stroke meaning, fabric edge attachment and tension, LED rail position, and intended room/mounting geometry. They need not delay the first prototype because the assumptions above are explicit and configurable. Final branding, contact information and any funding request must come from the artist before investor publication.

The next implementation step is phase 1 followed immediately by the small-grid fabric-and-light prototype. No application implementation or deployment is performed as part of this planning task.


## Implementation status — gallery and persistence

Completed: adjustable fabric and piston matrix; independent configurable perimeter LEDs; named browser configurations, startup default and validated JSON import/export; clean gallery presentation with white architectural surfaces, ceiling, stone floor and a stylized human scale figure; studio/presentation switching and camera presets.

The artist will author choreography later. A guided sequence, keyframe editor, physical material calibration, photoreal human asset, cross-browser/device verification and hosted investor release are not yet complete. The local presentation loads the saved startup configuration for that browser; exporting a configuration does not publish it globally.
