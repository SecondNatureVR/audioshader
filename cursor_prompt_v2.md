Here's a **Cursor-ready prompt for v2** that extends the v1 prototype with stereo spatial visualization and room-like 3D scene rendering.

It builds on the v1 foundation (audio → metrics → uniforms → shader) and adds:
* Stereo audio input (system audio loopback)
* Spatial analysis (pan, width, depth per frequency band)
* 3D room-like visualization
* Coherence as subtle overlay texture

---

## Cursor Prompt: Spatial Visualization (v0.2)

Extend the existing Coherence Canvas v0.1 to add **stereo spatial visualization** with a room-like 3D scene where frequency bands manifest as spatial objects, and coherence diagnostics appear as subtle overlay textures.

### Constraints

* Build on existing v0.1 codebase (keep modular structure)
* Use **Three.js** for 3D rendering (or WebGL if preferred, but 3D scene management is needed)
* Keep native JavaScript (no build step)
* Maintain existing diagnostic meters and UI
* Stereo input is the primary goal (system audio loopback)

### Functional Requirements

#### 1. Stereo Audio Input

**System Audio Loopback:**
* Implement platform-specific audio capture:
  * **Windows**: Use WASAPI loopback or guide user to set up virtual audio cable
  * **macOS**: Use BlackHole or guide user to set up BlackHole
  * **Browser fallback**: If direct capture not possible, provide clear setup instructions
* Alternative: Electron wrapper for native audio access (if needed)

**Stereo Analysis:**
* Split audio into L/R channels
* Per frequency band, calculate:
  * `stereoWidth` - Correlation between L/R (0 = mono, 1 = wide stereo)
  * `panPosition` - L/R balance (-1 = left, 0 = center, 1 = right)
  * `spatialDepth` - Phase relationships indicating depth
  * `bandEnergy` - Energy per band (low/mid/high) - already have this

**New Uniforms:**
```glsl
uniform vec3 u_stereoWidth;    // [low, mid, high] width
uniform vec3 u_panPosition;   // [low, mid, high] pan (-1 to 1)
uniform vec3 u_spatialDepth;  // [low, mid, high] depth (0-1)
```

#### 2. 3D Spatial Scene

**Room-like Visualization:**
* Create 3D scene with perspective camera
* Position objects/particles based on:
  * **X-axis**: Pan position (left ↔ right)
  * **Y-axis**: Frequency (low = bottom, mid = center, high = top)
  * **Z-axis**: Depth (front ↔ back)

**Frequency Band Objects:**
* **Low frequencies (20-250 Hz)**:
  * Large, heavy objects (spheres/cubes)
  * Position: Center-bottom (pan ≈ 0, y ≈ 0)
  * Color: Warm (red/orange)
  * Behavior: Stable, foundational, mono/centered
  
* **Mid frequencies (250-4 kHz)**:
  * Medium objects (bars/planes)
  * Position: Mid-height, wider horizontal spread
  * Color: Neutral (yellow/green)
  * Behavior: Wider stereo, front-center
  
* **High frequencies (4 kHz+)**:
  * Small, light objects (particles/sparks)
  * Position: Upper regions, can pan outward
  * Color: Cool (cyan/blue)
  * Behavior: More panning, can spread

**Object Properties:**
* Size = energy level
* Position = spatial characteristics (pan, width)
* Color = frequency band
* Motion = stability and coherence

#### 3. Coherence Overlay Texture

**Subtle Diagnostic Overlay:**
* Render coherence field as a subtle shader overlay on the 3D scene
* Normal state: Transparent, barely visible, affects clarity subtly
* When diagnostic issues occur, overlay becomes **salient**:

| Issue        | Overlay Effect                                    |
| ------------ | ------------------------------------------------- |
| Mud          | Blur increases, objects lose definition           |
| Harshness    | Noise texture appears, objects flicker             |
| Compression  | Contrast flattens, objects become uniform         |
| Collision    | Sharp spikes/artifacts appear                      |
| Phase issues | Interference patterns emerge                       |

**Implementation:**
* Render 3D scene to texture
* Apply coherence overlay as post-process shader
* Or: Apply overlay directly in 3D scene as transparent plane/effect

#### 4. Spatial Metrics Display

**Update Diagnostic Meters:**
* Add separate meters for:
  * `bandLow` - Low frequency energy (warm colors)
  * `bandMid` - Mid frequency energy (neutral colors)
  * `bandHigh` - High frequency energy (cool colors)
* Each band meter shows:
  * Current energy level
  * Stability over 1/2/4 bars
  * Spatial characteristics (width, pan) - optional

### Project Structure (Extended)

Keep existing structure, add:

* `audio/stereo-analyzer.js` - Stereo analysis and spatial metrics
* `spatial/scene.js` - 3D scene setup and object management
* `spatial/objects.js` - Frequency band object types
* `shaders/spatial-vertex.glsl` - 3D vertex shader
* `shaders/spatial-fragment.glsl` - 3D fragment shader
* `shaders/coherence-overlay.glsl` - Post-process overlay shader

### Technical Approach

**Option A: Three.js (Recommended)**
* Use Three.js for 3D scene management
* Render scene to texture
* Apply coherence overlay as post-process
* Easier 3D management, camera controls

**Option B: Raw WebGL**
* Manual 3D scene setup
* More control, more code
* Better for understanding internals

**Recommendation**: Start with Three.js for faster iteration, can optimize later.

### Deliverables

* Stereo audio input working (system audio or clear setup instructions)
* 3D spatial scene showing frequency bands as objects
* Objects positioned by pan and frequency
* Coherence overlay as subtle texture (salient when issues occur)
* Updated diagnostic meters showing band energy separately
* Clear visual distinction between spatial visualization and diagnostic overlay

### Acceptance Test

* When playing stereo audio:
  * Low frequencies appear as large objects at center-bottom (warm colors)
  * Mid frequencies appear as medium objects spread horizontally at mid-height (neutral colors)
  * High frequencies appear as small objects that can pan left/right (cool colors)
  * Panning audio moves objects left/right
  * Wide stereo spreads objects horizontally
  * Coherence overlay is subtle when mix is good
  * Diagnostic issues (mud, harshness, etc.) make overlay salient and affect scene clarity

### Implementation Notes

* Start with mock stereo data if system audio is complex
* Focus on getting 3D scene working first, then add real spatial analysis
* Coherence overlay can start as simple transparency/blur effect
* Iterate on object types and positioning to match spatial characteristics
* Keep existing v1 diagnostic meters - they're still useful

---

## Quick Setup Notes

**System Audio Setup (Platform-Specific):**

* **Windows**: 
  * Use WASAPI loopback API (may require Electron)
  * Or: Virtual Audio Cable setup instructions
  
* **macOS**:
  * Install BlackHole (free virtual audio driver)
  * Route system audio through BlackHole
  * Capture BlackHole as input

* **Browser Limitations**:
  * Direct system audio capture is limited in browsers
  * May need Electron wrapper for native audio access
  * Or: Provide clear setup instructions for virtual audio routing

---

This v2 extends v1's diagnostic foundation with spatial understanding, creating a more intuitive and informative visualization that shows both "where" audio lives in space and "how coherent" the mix is.

