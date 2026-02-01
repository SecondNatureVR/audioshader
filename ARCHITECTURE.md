# AudioShader Architecture

## Overview

AudioShader is a WebGL-based audio-reactive visualizer built with TypeScript. The codebase is organized into modular components that separate concerns and enable easy testing.

## Directory Structure

```
src/
├── index.ts              # Main exports (library entry point)
├── main.ts               # Application entry point
├── App.ts                # Main application state and render loop
├── types/
│   └── index.ts          # Core TypeScript type definitions
├── render/
│   ├── Renderer.ts       # WebGL rendering with framebuffer ping-pong
│   ├── ParameterInterpolator.ts  # Spring physics & easing interpolation
│   ├── Parameters.ts     # Parameter defaults, ranges, utilities
│   └── shaders.ts        # Shader loading utilities
├── audio/
│   ├── AudioAnalyzer.ts  # FFT analysis, stereo processing, metrics
│   └── AudioMapper.ts    # Audio-to-visual parameter mapping
├── presets/
│   └── PresetManager.ts  # Preset save/load/export with localStorage
├── mapping/
│   └── CurveMapping.ts   # Power curves, slider-to-value mapping
├── capture/
│   └── Capture.ts        # PNG snapshots, GIF & WebM recording
└── config/
    └── Resolution.ts     # Canvas resolution management
```

## Core Modules

### Renderer (`render/Renderer.ts`)
WebGL 1.0 renderer using a framebuffer ping-pong technique for persistent visual trails. Handles:
- Shader compilation and program linking
- Framebuffer management for history/current textures
- Blend mode configuration (additive, alpha, multiply, screen)
- Full-screen quad rendering

### ParameterInterpolator (`render/ParameterInterpolator.ts`)
Smooth parameter transitions using:
- Time-based easing (linear, easeIn, easeOut, easeInOut)
- Spring physics with configurable damping
- Rotation wrapping for shortest-path interpolation

### AudioAnalyzer (`audio/AudioAnalyzer.ts`)
Web Audio API integration providing:
- Microphone and tab audio capture
- Stereo channel analysis
- FFT-based frequency band energy (bass, mid, high)
- Derived metrics: harshness, mud, compression, coherence
- Adaptive min/max normalization

### AudioMapper (`audio/AudioMapper.ts`)
Maps audio metrics to visual parameters with:
- Per-parameter sensitivity and smoothing
- Multiplier, offset, and inversion
- Configurable min/max output ranges

### PresetManager (`presets/PresetManager.ts`)
Preset system with:
- Save/load/delete/rename operations
- localStorage persistence
- JSON import/export
- Unsaved changes detection

### CurveMapping (`mapping/CurveMapping.ts`)
Parameter value transformations:
- Power curves for exponential response
- Slider (0-100) to parameter value mapping
- Bidirectional conversion
- Per-parameter default curves

### Capture (`capture/Capture.ts`)
Canvas recording utilities:
- PNG snapshot download
- GIF recording with ping-pong looping
- WebM video recording (MediaRecorder API)

## Type System

All types are defined in `src/types/index.ts`:

```typescript
interface VisualParams {
  spikiness: number;
  spikeFrequency: number;
  // ... 15+ visual parameters
}

interface AudioMetrics {
  rms: number;
  bass: number;
  mid: number;
  high: number;
  // ... analysis metrics
}

interface Preset {
  name: string;
  params: VisualParams;
  audioMappings?: AudioMappings;
}
```

## Build & Development

```bash
npm run dev         # Start Vite dev server
npm run build       # Production build
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint
npm run test        # Vitest unit tests
npm run check       # All checks (typecheck + lint + test)
```

## Key Design Decisions

1. **Framework-agnostic core**: All rendering, audio, and mapping logic is independent of any UI framework, enabling future migration to React/Lit if needed.

2. **Strict TypeScript**: Using `noUncheckedIndexedAccess`, `strictNullChecks`, and other strict options to catch errors at compile time.

3. **Modular architecture**: Each module has a single responsibility and can be tested independently.

4. **No magic numbers**: All parameter ranges and defaults are defined in `PARAM_RANGES` and `PARAM_CURVE_DEFAULTS`.

5. **Bidirectional mapping**: Every slider-to-value transformation has an inverse function for proper UI synchronization.
