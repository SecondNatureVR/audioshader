Here’s a **Cursor-ready “vertical slice” prompt** you can paste into a new Cursor chat (or into a `cursor_prompt.md`) to get a first working prototype that proves the concept without locking tech choices too early.

It’s designed to produce a small codebase where:

* audio → metrics → uniforms → shader → canvas
* mud/harshness/compression/phaseRisk/collision visibly change the render
* everything is modular and easy for Cursor to mutate

---

## Cursor Prompt: Vertical Slice (v0.1)

Build a minimal browser app called **Coherence Canvas** that renders a full-screen shader on a `<canvas>` and drives it using real-time audio analysis.

### Constraints

* Use **native JavaScript** (no build step). Keep it runnable via a simple static server.
* Use **Web Audio API** for audio analysis.
* Use either **raw WebGL1** or **Three.js**. Choose whichever yields fewer lines and cleaner structure, but keep the code modular so we can swap later.
* Keep the entire prototype under ~6–8 files.

### Functional Requirements (must work)

1. **Audio input selection**

   * Provide a button: “Enable Audio”
   * Use `getUserMedia({ audio: true })` (mic input is OK for v0.1)
   * Create an `AudioContext`, connect an `AnalyserNode`

2. **Feature extraction (CPU)**

   * Per animation frame, compute:

     * `u_audioAmp` (RMS envelope, normalized 0–1)
     * `u_bandEnergy` as vec3 (low/mid/high) from FFT bins, normalized 0–1
     * `u_harshness` (high energy + high spectral flatness proxy if easy; otherwise just high ratio)
     * `u_mud` (mid energy ratio)
     * `u_compression` (simple proxy: 1 - normalized crest factor using peak vs RMS over short window)
     * `u_phaseRisk` (proxy using stereo correlation if available; if only mono/mic, set to 0 for now but keep plumbing)
     * `u_collision` (proxy using spectral flux spikes)
     * `u_coherence` = 1 - weighted sum of mud/harshness/compression/collision/phaseRisk, clamped 0–1

   Notes:

   * For v0.1, use crude but stable metrics. Focus on “changes produce visible changes.”
   * Add smoothing (EMA) to avoid jitter.

3. **Shader rendering (GPU)**

   * Full-screen quad render loop
   * Uniforms (exact names):

     ```glsl
     uniform float u_time;
     uniform vec2  u_resolution;

     uniform float u_coherence;
     uniform float u_mud;
     uniform float u_phaseRisk;
     uniform float u_compression;
     uniform float u_harshness;
     uniform float u_lowImbalance; // can be 0 for v0.1
     uniform float u_emptiness;    // can be 0 for v0.1
     uniform float u_collision;

     uniform float u_audioAmp;
     uniform vec3  u_bandEnergy; // low/mid/high
     ```
   * The fragment shader must implement interpretable visual semantics:

     * High `u_coherence` → sharp, stable structure
     * High `u_mud` → blur / collapsed contours
     * High `u_harshness` → fine noise / jagged edges / flicker in high-frequency details
     * High `u_compression` → flattened contrast and reduced motion amplitude
     * High `u_collision` → sharp angular spikes or shockwave artifacts
     * `u_audioAmp` and `u_bandEnergy` should modulate motion/intensity but not overwhelm diagnostics

4. **Debug UI (minimal)**

   * Show a small overlay in top-left with live numeric values:

     * coherence, mud, harshness, compression, collision, amp, bandEnergy
   * Use plain HTML/CSS; no frameworks.

### Project Structure (suggested)

* `index.html`
* `main.js` (app boot + render loop)
* `audio/analyzer.js` (WebAudio + metrics)
* `gl/renderer.js` (webgl init + uniforms)
* `shaders/vertex.glsl`
* `shaders/fragment.glsl`
* `ui/debug.js` (overlay)

If you choose fewer files, that’s OK, but keep the separation between audio metrics and rendering.

### Deliverables

* Working app that runs locally
* Clear comments explaining each metric, normalization, and smoothing
* The shader should look “instrument-like,” not decorative (coherence field)

### Acceptance Test

* When I speak into the mic or play music near it:

  * bass-heavy sound increases low band energy
  * bright hissy sound increases harshness and adds visible fine noise
  * dense midrange sound increases mud and visibly blurs/collapses structure
  * percussive bursts increase collision and cause spikes/shock artifacts
  * overall coherence responds and changes stability/clarity

---

## Quick run instructions (Cursor should include in README)

* `python -m http.server 8000` then open localhost
* user clicks “Enable Audio” and grants mic permissions

---

If you want, I can also give you a **second prompt** that’s “v0.2” aimed at **system audio loopback** + optional **stems** (where feasible), but this v0.1 is the right proof-of-concept: it proves the full causal chain and gives you a shader canvas to iterate on.