# Audio System Audit

## Current Architecture Overview

The audio system consists of two main components:

### 1. `audio/analyzer.js` - AudioAnalyzer Class (1210 lines)

**Purpose**: Captures audio input, performs FFT analysis, and computes audio metrics.

**Key Properties**:
```javascript
{
  audioContext: AudioContext,
  analyser: AnalyserNode,           // Combined/mono analyser
  analyserLeft: AnalyserNode,       // Stereo left channel
  analyserRight: AnalyserNode,      // Stereo right channel
  source: MediaStreamAudioSourceNode,
  stream: MediaStream,
  isEnabled: boolean,
  isTabCapture: boolean,            // NEW: true when using getDisplayMedia
  isStereo: boolean,
  fftSize: 2048,
  smoothingFactor: 0.85,
  smoothedMetrics: {...},           // EMA-smoothed values
  metricHistory: {...},             // Rolling window for normalization
  minMax: {...},                    // Per-metric min/max tracking
  normalizedMetrics: {...}          // 0-1 normalized values
}
```

**Key Methods**:
| Method | Purpose |
|--------|---------|
| `getAudioDevices()` | Lists available mic/input devices. **BUG: Calls getUserMedia() for permission** |
| `enableAudio(deviceId, preferStereo)` | Captures from mic/device via getUserMedia |
| `enableTabAudio()` | **NEW**: Captures browser tab audio via getDisplayMedia |
| `disableAudio()` | Stops capture, cleans up resources |
| `getMetrics()` | Returns current audio metrics (raw + normalized) |
| `setupMonoAnalysis()` | Configures single-channel FFT |
| `setupStereoAnalysis()` | Configures L/R channel splitter + FFT |

**Computed Metrics**:
| Metric | Range | Meaning | Calculation |
|--------|-------|---------|-------------|
| `audioAmp` | 0-1 | Overall loudness | RMS of time-domain data |
| `bandEnergy[3]` | 0-1 | Low/mid/high energy | Sum of FFT bins per band |
| `harshness` | 0-1 | High-freq excess | Ratio of high bins to total |
| `mud` | 0-1 | Muddy midrange | Mid-low frequency buildup |
| `compression` | 0-1 | Dynamic range loss | Peak-to-RMS ratio |
| `collision` | 0-1 | Transient overlap | Spectral flux (positive changes) |
| `lowImbalance` | 0-1 | Bass imbalance | Low vs mid energy ratio |
| `emptiness` | 0-1 | Spectral gaps | Count of quiet bins |
| `coherence` | 0-1 | Mix quality | Inverse of problems |
| `phaseRisk` | 0-1 | Phase cancellation | L/R correlation (stereo only) |
| `stereoWidth[3]` | 0-1 | Stereo spread | L/R difference per band |
| `panPosition[3]` | -1 to 1 | Pan position | L/R balance per band |
| `spatialDepth[3]` | 0-1 | Depth perception | Phase-based depth |

---

### 2. `lucas.html` - Audio Integration (lines 5300-6300)

**Audio Mapping Configuration**:
```javascript
const audioMappings = {
  spikiness: 'collision',
  spikeFrequency: 'bandEnergy',    // Uses mid band [1]
  spikeSharpness: 'harshness',
  hue: 'coherence',
  scale: 'audioAmp',
  dilationSpeed: 'mud',
  fadeAmount: 'compression',
  hueShiftAmount: 'phaseRisk',
  rotation: 'audioAmp',
  fillSize: 'bandEnergy',
  fillOpacity: 'bandEnergy',
  blendOpacity: 'collision'
};
```

**Per-Mapping Configuration**:
```javascript
{
  enabled: boolean,       // Whether this mapping is active
  sensitivity: 1.0,       // Input gain (0-3)
  smoothing: 0.8,         // EMA factor (0.5-0.99)
  multiplier: 1.0,        // Output scale (-5 to 5)
  offset: 0.0             // Output offset (-1 to 1)
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AUDIO SOURCE                                   │
│  ┌──────────────────┐    ┌──────────────────┐                           │
│  │   Microphone     │    │   Browser Tab    │                           │
│  │  getUserMedia()  │    │ getDisplayMedia()│                           │
│  └────────┬─────────┘    └────────┬─────────┘                           │
│           │                       │                                      │
│           └───────────┬───────────┘                                      │
│                       ▼                                                  │
│              MediaStreamSource                                           │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────────┐
│                     AUDIO ANALYZER                                       │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │   Splitter   │──▶│  Left FFT    │──▶│  Left Freq   │                 │
│  │   (stereo)   │   └──────────────┘   │    Data      │                 │
│  │              │   ┌──────────────┐   └──────────────┘                 │
│  │              │──▶│  Right FFT   │──▶│  Right Freq  │                 │
│  └──────────────┘   └──────────────┘   │    Data      │                 │
│         │                              └──────────────┘                 │
│         ▼                                                                │
│  ┌──────────────┐   ┌──────────────────────────────────┐                │
│  │  Merged FFT  │──▶│  Metric Calculations             │                │
│  │  (combined)  │   │  - RMS, Band Energy, Harshness   │                │
│  └──────────────┘   │  - Mud, Compression, Collision   │                │
│                     │  - Phase, Stereo Width, etc.     │                │
│                     └──────────────────┬───────────────┘                │
│                                        │                                 │
│                     ┌──────────────────▼───────────────┐                │
│                     │  Smoothing (EMA)                 │                │
│                     │  smoothed = prev * α + new * (1-α)               │
│                     └──────────────────┬───────────────┘                │
│                                        │                                 │
│                     ┌──────────────────▼───────────────┐                │
│                     │  Min/Max Normalization           │                │
│                     │  Rolling 30-second window        │                │
│                     │  norm = (val - min) / (max - min)│                │
│                     └──────────────────┬───────────────┘                │
└────────────────────────────────────────┼────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼────────────────────────────────┐
│                      AUDIO MAPPING (lucas.html)                          │
│                                                                          │
│  For each mapped parameter:                                              │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  offset = (normalizedMetric - 0.5) * sensitivity * multiplier  │     │
│  │  smoothedOffset = prevOffset * smoothing + offset * (1-smoothing)   │
│  │  finalValue = baseValue + smoothedOffset * paramRange          │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Parameters are clamped to their valid ranges                            │
└────────────────────────────────────────┬────────────────────────────────┘
                                         │
                                         ▼
                              WebGL Shader Uniforms
```

---

## Known Issues

### BUG 1: Double Permission Prompt (HIGH PRIORITY)
**Location**: `audio/analyzer.js:98-101`, `lucas.html:5366`

**Problem**: When clicking "Capture Tab Audio", user sees TWO prompts:
1. Microphone permission (from `getAudioDevices()`)
2. Tab capture permission (from `getDisplayMedia()`)

**Cause**:
```javascript
// In getAudioDevices() - line 101
await navigator.mediaDevices.getUserMedia({ audio: true });  // Triggers mic prompt!
```

This is called during `initAudioAnalyzer()` → `loadAudioDevices()` on page load.

**Fix**: Defer device enumeration until mic input is actually needed, or use a permission-less enumeration fallback.

---

### BUG 2: Duplicate Function Definition
**Location**: `lucas.html:2774` and `lucas.html:2954`

**Problem**: `updateDebugOutput()` is defined twice. The second definition overwrites the first.

---

### BUG 3: Eager Initialization
**Location**: `lucas.html:6195-6209`

**Problem**: Audio system initializes on page load even if user never uses audio:
```javascript
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeAudioMapping();  // Calls initAudioAnalyzer → loadAudioDevices
}
```

This triggers permission prompts before user interaction.

---

### ISSUE 4: No Audio Source Indicator
**Problem**: When tab capture is active, there's no visual indication of WHICH tab is being captured.

---

### ISSUE 5: Mixed Responsibility
**Problem**: `lucas.html` contains ~1000 lines of audio-related code mixed with visualization code. Should be modularized.

---

### ISSUE 6: Render Loop Uses setInterval
**Location**: `lucas.html:4950`

**Problem**: Uses `setInterval(render, FRAME_TIME)` instead of `requestAnimationFrame`. Can cause:
- Visual tearing
- Wasted CPU when tab is hidden
- Inconsistent frame timing

---

## What Works Well

1. **Stereo Analysis**: Properly splits L/R channels for phase and width analysis
2. **Metric Smoothing**: EMA prevents jittery visuals
3. **Adaptive Normalization**: Rolling min/max window adapts to audio dynamics
4. **Per-Parameter Mapping**: Each visual parameter can have independent sensitivity/multiplier
5. **Tab Capture**: Successfully captures browser tab audio (once double-prompt is fixed)
6. **Preset System**: Audio mapping configs are saved/restored with presets

---

## Recommended Refactoring

### Phase 1: Fix Critical Bugs
1. Fix double permission prompt
2. Remove duplicate `updateDebugOutput()`
3. Defer audio init until user clicks a button

### Phase 2: Modularize
1. Extract audio system to separate module
2. Create clean interface between audio and visualization
3. Use ES6 modules instead of global state

### Phase 3: Improve UX
1. Add visual indicator for active audio source
2. Show captured tab name/icon
3. Add "Test Audio" feature to verify input is working

### Phase 4: Performance
1. Switch to `requestAnimationFrame`
2. Only compute metrics when audio mapping is enabled
3. Consider Web Workers for FFT (optional)

---

## File Structure After Refactor (Proposed)

```
audioshader/
├── index.html              # Entry point
├── src/
│   ├── audio/
│   │   ├── AudioCapture.js     # getUserMedia, getDisplayMedia
│   │   ├── AudioAnalyzer.js    # FFT, metrics calculation
│   │   └── AudioMapper.js      # Metric → parameter mapping
│   ├── visual/
│   │   ├── Renderer.js         # WebGL setup, render loop
│   │   ├── Shaders.js          # Shader sources
│   │   └── Parameters.js       # Visual parameter management
│   ├── ui/
│   │   ├── Controls.js         # Slider/button handlers
│   │   ├── AudioPanel.js       # Audio mapping UI
│   │   └── PresetManager.js    # Save/load presets
│   └── main.js                 # App initialization
├── styles/
│   └── main.css
└── shaders/
    ├── star.vert
    ├── star.frag
    ├── dilation.vert
    └── dilation.frag
```
