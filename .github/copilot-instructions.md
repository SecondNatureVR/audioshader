# Coherence Canvas — Agent Instructions

Short, actionable notes for AI coding agents working in this repo.

## Big picture
- Purpose: real-time audio-driven visuals. Audio -> `audio/analyzer.js` computes normalized metrics -> `main.js` collects metrics and ripple history -> `gl/renderer.js` passes uniforms to shaders in `shaders/` to render the canvas.
- Core integration points: `main.js` (app loop), `AudioAnalyzer` in `audio/analyzer.js` (provides `getMetrics()`), `Renderer.render(uniforms)` in `gl/renderer.js` (expects uniforms like `u_time`, `u_resolution`, `u_coherence`, `u_bandEnergy`, etc.).
- Sandbox integration: `sandbox.html` combines visual experimentation with audio reactivity. Audio metrics can be mapped to visual parameters with configurable influence levels and metric selection.

## Key patterns & conventions (do not break)
- Metrics use `u_` prefix (e.g. `u_coherence`, `u_mud`, `u_audioAmp`, `u_bandEnergy`) and are passed directly from JS `metrics` object to `renderer.render()`.
- Ripple history: `main.js` keeps `rippleHistory` of length `MAX_RIPPLE_HISTORY` (20). Shaders expect arrays: `u_rippleCount`, `u_rippleTimes[20]`, `u_rippleAmps[20]`, `u_rippleBandEnergy[20]`, etc. If you change history length, update both JS and GLSL sizes.
- DOM/id conventions used by UI modules:
  - Meters: `meter-<metricName>` and `value-<metricName>` (see `ui/meters.js`).
  - Legend canvases: ids like `legend-coherence`, `legend-mud`, `legend-bandEnergy` (see `ui/legend.js`).
  - Audio mapping: `audio-<param>-enable`, `audio-<param>-metric`, `audio-<param>-influence` for sandbox audio controls.
- Script load order in `index.html` matters: `audio/analyzer.js`, `gl/renderer.js`, `ui/legend.js`, `ui/meters.js`, then `main.js`.
- Audio integration in sandbox: `window.AudioIntegration` provides `isEnabled()`, `getMetrics()`, `setMapping(param, enabled, influence, metric)` for real-time audio-visual mapping.

## Debugging & developer workflows
- Quick local serve (required for fetch-based shader loading and getUserMedia):
  ```bash
  python -m http.server 8000
  # then open http://localhost:8000
  ```
- Browser audio requires permission; `main.js` logs metrics every ~60 frames. Use the console to inspect `Renderer` shader compilation/link errors (exceptions include shader info logs).
- Shaders are loaded with `fetch` in `Renderer.loadShader(url)` — do not run from `file://` (fetch and getUserMedia will fail).

## Where to look for concrete examples
- Metric smoothing, stereo handling and metric calculations: [audio/analyzer.js](audio/analyzer.js)
- Render loop, metric wiring, ripple creation and uniforms: [main.js](main.js)
- WebGL program lifecycle, uniform array handling, and setUniform logic: [gl/renderer.js](gl/renderer.js)
- Ripple + color math and array uniform usage: [shaders/fragment-water.glsl](shaders/fragment-water.glsl)
- UI widgets and DOM id patterns: [ui/meters.js](ui/meters.js), [ui/legend.js](ui/legend.js)
- Audio-visual parameter mapping and real-time integration: [sandbox.html](sandbox.html) (AudioIntegration section)

## Safe edit rules for agents
- Preserve `u_` uniform names and the `metrics` object keys. Renaming requires coordinated updates in JS and GLSL.
- When changing ripple history length, update: `MAX_RIPPLE_HISTORY` in `main.js`, the arrays passed to `renderer.render()`, and all fixed-size GLSL arrays (e.g. `u_rippleTimes[20]`) in `shaders/`.
- If modifying shader fetch paths, ensure the static server serves the same relative paths; shader URLs are relative strings passed into `Renderer.init()` (see `main.js`).

If you want me to expand any section (uniform name mapping, a change checklist for shaders, or examples of metric normalization), say which one and I'll refine it.
