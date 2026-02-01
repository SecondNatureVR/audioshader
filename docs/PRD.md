Below is a **Cursor-readable, implementation-agnostic PRD** that consolidates everything so far.
It is written so Cursor can reason modularly, propose architectures, and mutate pieces without collapsing the concept.

You should be able to paste this directly into Cursor as **`PRD.md`**.

---

# Coherence Canvas

**Product Requirements Document (v0.6 – Concept-Locked, Stack-Open)**

---

## 1. Product Intent

Coherence Canvas is a **visual diagnostic instrument for music mixing and arrangement**.

It renders a continuously updating **visual coherence field** whose structure, stability, and clarity correspond to the perceptual coherence of an audio track (or set of tracks).

The canvas is not decorative, reactive, or beat-synced by default.
It is intended to **externalize mix intelligibility**, helping users *see* problems such as masking, phasing, harshness, overcompression, imbalance, and underdeveloped regions.

---

## 2. Core User Goal

> While composing or mixing music, I want a visual field that becomes clearer, more structured, and more stable as my mix becomes more coherent — and degrades in interpretable ways when my mix has problems.

---

## 3. Non-Goals (Explicit)

* Not a VJ or performance visualizer
* Not a spectrum analyzer replacement
* Not a DAW mixer, EQ, or compressor
* Not prescriptive (“fix this”)
* Not optimized for visual aesthetics over diagnostic clarity

---

## 4. Conceptual Model (Key)

### 4.1 Reframe

* Audio is **not visualized directly**
* Audio is **analyzed → reduced → mapped**
* The shader renders **diagnostic fields**, not waveforms or FFT bars

### 4.2 Design Principle

> JavaScript (or CPU side) performs **measurement and interpretation**
> Shaders perform **spatialization and exaggeration**

---

## 5. High-Level Architecture (Stack-Agnostic)

```
Audio Input (master or stems)
   ↓
Feature Extraction (CPU)
   ↓
Coherence Metrics
   ↓
Control Fields (scalars + low-res textures)
   ↓
Shader Rendering (GPU)
   ↓
Visual Coherence Canvas
```

---

## 6. Input Modalities

### 6.1 Audio Input

**v1 (Current):**
* Microphone input (mono) - implemented
* Basic stereo analysis placeholder

**v2 (Planned):**
* **Stereo system audio loopback** (primary)
  * Capture desktop audio (Spotify, DAW, etc.)
  * Platform-specific implementation:
    * Windows: WASAPI loopback or virtual audio cable
    * macOS: BlackHole or Soundflower
    * Browser: May require Electron wrapper or native app
* Optional multi-track / stem input (future)

Audio may originate from:
* System audio loopback (v2 primary)
* DAW loopback
* Microphone (fallback/testing)

### 6.2 Optional Future Inputs

* MIDI (symbolic modulation)
* User images (as textures / overlays)
  *(not required for v1 diagnostic focus)*

---

## 7. Audio Feature Extraction (CPU-Side)

### 7.1 Analysis Backbone

* Windowed STFT
* Per-frame magnitude and phase
* Band aggregation (low / mid / high or 6–12 bands)

### 7.2 Core Derived Metrics (Normalized 0–1)

| Metric         | Meaning                                  |
| -------------- | ---------------------------------------- |
| `mud`          | Spectral masking / midrange overcrowding |
| `phaseRisk`    | Phase instability / cancellation risk    |
| `compression`  | Loss of dynamic contrast                 |
| `harshness`    | Excess high-frequency energy / noise     |
| `lowImbalance` | Excess or hollow low-end                 |
| `emptiness`    | Persistent spectral gaps                 |
| `collision`    | Transient overlap / arrangement clashes  |
| `coherence`    | Aggregate inverse of above issues        |

### 7.3 Spatial Metrics (v2 - Planned)

For stereo input, per frequency band:

| Metric              | Meaning                                    |
| ------------------- | ------------------------------------------ |
| `stereoWidth`        | Correlation between L/R channels (0=mono, 1=wide) |
| `panPosition`       | L/R balance (-1=left, 0=center, 1=right)  |
| `spatialDepth`      | Phase relationships indicating depth       |
| `bandEnergy`        | Energy per band (low/mid/high) - **separate meters** |

**Spatial Characteristics by Frequency:**
* **Low (20-250 Hz)**: Typically mono/centered, lower in mix
* **Mid (250-4 kHz)**: Wider stereo image, front-center
* **High (4 kHz+)**: More panning, can be wide or focused

---

## 8. Diagnostic Cases (Canonical)

The system must be able to express the following conditions **through visual degradation or clarity**, not explicit labels:

1. Balanced / coherent mix (reference state)
2. Muddied midrange (masking)
3. Phase cancellation / phasing
4. Overcompressed dynamics
5. Harsh high frequencies
6. Low-end imbalance
7. Underdeveloped / empty regions
8. Clashing transients / arrangement collisions

These are **interpretive invariants** — visual semantics must remain consistent across sessions.

---

## 9. Control Interface Between CPU and Shader

### 9.1 Scalar Uniforms (Always Available)

```glsl
uniform float u_time;
uniform vec2  u_resolution;

uniform float u_coherence;
uniform float u_mud;
uniform float u_phaseRisk;
uniform float u_compression;
uniform float u_harshness;
uniform float u_lowImbalance;
uniform float u_emptiness;
uniform float u_collision;
```

### 9.2 Optional Vector Uniforms

```glsl
uniform vec3 u_bandEnergy;   // low / mid / high
uniform vec3 u_bandConflict;
uniform vec3 u_bandPhase;
```

### 9.3 Control Textures (Preferred for Spatial Mapping)

Low-resolution textures updated per frame or per audio block:

* `texEnergy` – energy by band over time
* `texConflict` – masking / collisions
* `texPhase` – phase instability

These textures are **semantic**, not raw FFT buffers.

---

## 10. Shader Responsibilities

The shader must:

* Spatialize coherence metrics into a continuous field
* Exaggerate diagnostic features
* Maintain stability under small parameter changes
* Degrade in interpretable ways when metrics worsen

The shader must **not**:

* Perform FFTs
* Access audio APIs
* Contain audio-specific logic

---

## 11. Visual Semantics (Interpretive Contract)

| Audio Condition   | Visual Effect                             |
| ----------------- | ----------------------------------------- |
| High coherence    | Clear structure, stable geometry          |
| Mud               | Blur, collapsed contours                  |
| Phase issues      | Interference patterns, flickering nulls   |
| Overcompression   | Flattened contrast, reduced motion        |
| Harshness         | Fine noise, jagged edges                  |
| Low-end excess    | Heavy visual mass, slow motion            |
| Emptiness         | Stable voids                              |
| Transient clashes | Sharp intersections, shock-like artifacts |

These mappings should remain **consistent**, not stylistic.

---

## 12. Geometry / Spatial Model

### 12.1 v1 Implementation (Current)
* Radial (radius ≈ frequency, angle ≈ structure)
* 2D coherence field with diagnostic overlays
* Band energy drives structure and color

### 12.2 v2 Design Direction (Planned)

**Spatial Visualization: Room-like 3D Scene**

The visualization will evolve into a **room-like spatial representation** where:

* **Base Layer**: 3D spatial scene representing the stereo field
  * Objects/particles positioned by pan (left ↔ right) and frequency (low ↔ high)
  * Frequency bands manifest as different object types:
    * **Low frequencies**: Heavy, central, floor-level objects (warm colors)
    * **Mid frequencies**: Mid-height, wider spread, front-center objects (neutral colors)
    * **High frequencies**: Light, pannable, upper-region objects (cool colors)

* **Overlay Layer**: Coherence texture as subtle diagnostic overlay
  * Normal state: Subtle, transparent texture affecting clarity
  * Diagnostic issues become **salient** when they occur:
    * Mud → blur increases, objects lose definition
    * Harshness → noise texture appears, objects flicker
    * Compression → contrast flattens, objects become uniform
    * Collision → sharp spikes/artifacts appear
    * Phase issues → interference patterns emerge

**Spatial Characteristics:**
* X-axis: Pan position (left ↔ right)
* Y-axis: Frequency (low ↔ high) or depth
* Z-axis: Depth or spatial positioning
* Object size: Energy level
* Object color: Frequency band
* Object position: Spatial characteristics (pan, width, depth)

---

## 13. UX Constraints

* Real-time feedback
* Safe failure (audio dropouts or shader errors don’t crash app)
* Visible but minimal controls
* No dense UI panels
* Visual field is primary interface

---

## 14. Cursor-First Development Constraints

The codebase must be structured so Cursor can:

* Explain any module in isolation
* Modify shaders without touching analysis code
* Extend metrics without refactoring the pipeline
* Reason about feature → visual causality

### Therefore:

* Analysis modules are isolated
* Shader files are self-contained
* Uniform names are literal and stable
* Boilerplate is centralized and static

---

## 15. Success Criteria (v1)

* Visual coherence improves when common mix problems are corrected
* Different failure modes look meaningfully different
* User can diagnose issues without meters
* The canvas becomes a trusted secondary sense
* The system remains intelligible under iteration

---

## 16. v2 Design Evolution

### 16.1 Spatial Visualization Architecture

**Two-Layer System:**

1. **Spatial Scene Layer** (3D Room)
   * Objects/particles positioned by pan and frequency
   * Frequency-dependent object types and behaviors
   * Real-time spatial positioning based on stereo analysis
   * Visual representation of how audio occupies space

2. **Coherence Overlay Layer** (Diagnostic Texture)
   * Subtle shader overlay affecting scene clarity
   * Becomes salient when diagnostic issues occur
   * Does not obscure spatial information
   * Enhances understanding of mix problems

### 16.2 Implementation Phases

**Phase 1: Stereo Input**
* System audio loopback implementation
* L/R channel analysis
* Spatial metric calculation (width, pan, depth)

**Phase 2: Basic Spatial Visualization**
* 3D scene setup (Three.js or WebGL)
* Objects positioned by pan and frequency
* Stereo width visualization

**Phase 3: Room-like Visualization**
* Depth and dimension
* Frequency-dependent object types
* Spatial relationships

**Phase 4: Coherence Overlay**
* Subtle texture system
* Diagnostic salience
* Issue highlighting

### 16.3 Visual Design Principles

* **Spatial = Primary**: The room visualization is the main interface
* **Coherence = Overlay**: Diagnostic texture is subtle until issues occur
* **Salience = Responsive**: Problems become visually prominent when they happen
* **Frequency = Vertical**: Low (bottom), Mid (center), High (top)
* **Pan = Horizontal**: Left ↔ Right
* **Energy = Size/Intensity**: More energy = larger/more visible objects

---

## 17. Explicit Open Questions (Deferred)

* Raw WebGL vs Three.js vs WebGPU (v2 may require 3D library)
* System audio loopback UX per OS (v2 requirement)
* Multi-track routing standards
* Persistence / snapshots
* Performance tuning
* 3D scene navigation (fixed view vs interactive)

These are **implementation details**, not blockers.

---

## 18. One-Sentence Product Definition

**v1 (Current):**
> Coherence Canvas is a real-time visual diagnostic field that externalizes the perceptual coherence of a music mix, allowing producers to see masking, phasing, imbalance, and structural gaps as spatial phenomena rather than meters.

**v2 (Planned):**
> Coherence Canvas is a real-time 3D spatial visualization of stereo audio where frequency bands manifest as objects in a room-like space, with diagnostic coherence overlays that become salient when mix problems occur, helping producers see both spatial characteristics and mix quality simultaneously.

---

If you want next, I can:

* Compress this to a **1-page PRD**
* Generate a **Cursor bootstrap prompt** (“build the smallest vertical slice”)
* Define the **exact v1 audio feature set**
* Propose **one canonical shader spec** that covers all cases
* Pressure-test this against real mixing workflows (EDM, orchestral, ambient)

Just say which direction to push.
