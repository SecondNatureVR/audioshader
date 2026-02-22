# AudioShader - Composer Reference Guide

**Purpose:** Comprehensive reference document for AI assistants (Composer) working on this codebase. This document captures current implementation state, architecture patterns, design decisions, and common workflows.

**Last Updated:** 2026-02-07  
**Branch:** `claude`  
**Status:** TypeScript refactor complete, visual parity work in progress

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Key Design Decisions](#key-design-decisions)
4. [Implementation Patterns](#implementation-patterns)
5. [File Structure & Responsibilities](#file-structure--responsibilities)
6. [Common Tasks & Quick Reference](#common-tasks--quick-reference)
7. [Testing Requirements](#testing-requirements)
8. [Known Issues & Gotchas](#known-issues--gotchas)
9. [Debugging & Development Tools](#debugging--development-tools)

---

## Project Overview

### What is AudioShader?
Audio-reactive WebGL visualizer that creates persistent visual trails using framebuffer ping-pong rendering. Users can control visual parameters via sliders, map audio metrics to parameters, save/load presets, and record GIFs/WebM videos.

### Current State
- ✅ **TypeScript refactor complete** - All modules extracted from `lucas.html`
- ✅ **Component system** - Lit web components for reusable UI
- ✅ **Testing infrastructure** - Vitest (unit) + Playwright (E2E)
- ⚠️ **Visual parity** - Close but not exact (Firefox closer than Chrome)
- ⚠️ **Audio capture** - Implemented but needs end-to-end verification

### Reference Implementation
**`lucas.html`** is the "ground truth" for visual behavior. When in doubt, compare against `lucas.html` for:
- Parameter ranges and defaults
- Shader uniform values
- Timing behavior (60fps fixed interval)
- Visual appearance

---

## Architecture

### Core Modules

```
src/
├── App.ts                    # Main application state, render loop, parameter management
├── main.ts                   # Entry point, wires up App, UIController, AudioAnalyzer
├── index.ts                  # Library exports
├── types/index.ts            # TypeScript type definitions
│
├── render/
│   ├── Renderer.ts           # WebGL rendering, framebuffer ping-pong, shader management
│   ├── Parameters.ts         # Parameter definitions, ranges, jiggle logic
│   ├── ParameterInterpolator.ts  # Spring physics and easing for smooth transitions
│   └── shaders.ts            # Shader loading utilities
│
├── audio/
│   ├── AudioAnalyzer.ts      # FFT analysis, audio metrics extraction
│   └── AudioMapper.ts        # Maps audio metrics to visual parameters
│
├── ui/
│   ├── UIController.ts       # All DOM interactions, sliders, presets, hotkeys
│   └── valueUtils.ts         # Value parsing and range expansion utilities
│
├── presets/
│   ├── PresetManager.ts      # Save/load/export presets with localStorage
│   └── defaultPresets.ts     # 49 built-in presets from lucas.html
│
├── mapping/
│   └── CurveMapping.ts       # Slider-to-value curve transformations
│
├── capture/
│   └── Capture.ts            # PNG snapshots, GIF recording (ping-pong loop), WebM recording
│
├── config/
│   ├── Resolution.ts         # Resolution configuration
│   ├── resolutions.ts        # Available resolutions (4k, pc, mobile, window)
│   └── paramLabels.ts        # Centralized parameter display labels
│
└── components/               # Lit web components
    ├── param-slider/
    │   └── ParamSlider.ts    # Slider with curve mapping, editable value
    ├── editable-value/
    │   └── EditableValue.ts  # Click-to-edit numeric value display
    ├── control-group/
    │   └── ControlGroup.ts   # Collapsible control group container
    └── types.ts              # Component event types
```

### Data Flow

```
User Input (Slider/Keyboard)
    ↓
UIController.handleSliderChange()
    ↓
App.setParam() → ParameterInterpolator.updateTarget()
    ↓
Render Loop (60fps setInterval)
    ↓
ParameterInterpolator.update() → Smooth transitions
    ↓
App.tick() → Renderer.render()
    ↓
WebGL Shaders (star.frag → dilation.frag)
    ↓
Canvas Display
```

### Audio Flow

```
Audio Source (Mic/Tab)
    ↓
AudioAnalyzer.getMetrics() (60fps)
    ↓
AudioMapper.applyMappings()
    ↓
App.setAudioMetrics() → Parameter offsets
    ↓
VisualParams (base + audio offsets)
    ↓
Renderer.render()
```

---

## Key Design Decisions

### 1. emanationRate vs VisualParams Separation

**Critical:** `emanationRate` is handled separately from `VisualParams`. This is intentional.

| Aspect | VisualParams | emanationRate |
|--------|--------------|---------------|
| Purpose | Visual appearance | Timing (shapes/second) |
| Interpolation | Smooth transitions | Instant changes |
| Curve mapping | Yes (non-linear sliders) | No (1:1 linear) |
| Preset storage | `preset.params` | `preset.emanationRate` |
| App storage | `this.params` + interpolator | `this.emanationRate` |

**Why:** `emanationRate` controls *when* shapes are captured, not *how* they look. Interpolating a rate value would cause unpredictable timing behavior.

### 2. Fixed 60fps Timing

**Decision:** Use `setInterval(render, 16.67)` instead of `requestAnimationFrame`

**Why:**
- Matches `lucas.html` behavior exactly
- More consistent across browsers
- Predictable frame timing for audio sync

**Implementation:** `App.ts` uses `setInterval(this.tick, App.FRAME_TIME)` where `FRAME_TIME = 1000 / 60`

### 3. Parameter Interpolation

**System:** Spring physics with configurable damping

**Behavior:**
- Smooth transitions when changing presets
- Instant snap when `setParams(..., immediate: true)` is called
- Rotation wrapping for shortest-path interpolation
- Per-parameter spring strength/damping

**Usage:**
```typescript
// Smooth transition (default)
app.setParams(newParams);

// Instant snap (for preset loading)
app.setParams(newParams, true);
```

### 4. Curve Mapping System

**Purpose:** Non-linear slider responses (power curves)

**Key Functions:**
- `mapSliderToValue(slider, settings)` - Convert 0-100 slider to parameter value
- `reverseMapValueToSlider(value, settings)` - Convert parameter value to 0-100 slider
- Special mappings: `DilationMapping`, `FadeMapping`, `EffectAmountMapping`, etc.

**Default Settings:** Defined in `PARAM_CURVE_DEFAULTS` in `CurveMapping.ts`

### 5. Component Architecture

**Framework:** Lit web components (v3)

**Components:**
- `<param-slider>` - Slider with curve mapping, editable value, curve editor button
- `<editable-value>` - Click-to-edit numeric display with formatters
- `<control-group>` - Collapsible container for related controls

**Registration:** Components auto-register when `src/components/index.ts` is imported (done in `main.ts`)

### 6. TypeScript Strict Mode

**Configuration:** `tsconfig.json` with:
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `strictNullChecks: true`
- `exactOptionalPropertyTypes: true`

**Rule:** All code must be TypeScript (.ts/.tsx). No JavaScript files in `src/`.

---

## Implementation Patterns

### Parameter Management Pattern

```typescript
// In App.ts
private params: VisualParams;           // Current interpolated values
private baseParams: VisualParams;       // Base values (before audio mapping)
private targetParams: VisualParams;     // Target values (for interpolation)

// Setting a parameter
setParam(name: keyof VisualParams, value: number, immediate = false): void {
  this.targetParams[name] = value;
  if (immediate) {
    this.interpolator.setCurrent(name, value);
    this.params[name] = value;
  }
}

// Getting current values
getParams(): VisualParams {
  return { ...this.params };
}
```

### Audio Mapping Pattern

```typescript
// In App.ts
setAudioMetrics(metrics: AudioMetrics): void {
  // Apply audio mappings to base params
  const mappedParams = this.audioMapper.applyMappings(
    this.baseParams,
    metrics
  );
  
  // Update target params (triggers interpolation)
  this.setParams(mappedParams);
}
```

### Preset Loading Pattern

```typescript
// In UIController.ts
loadPreset(name: string): void {
  const preset = this.app.getPresetManager().loadPreset(name);
  if (preset !== null) {
    // Immediate snap for preset loading
    this.app.setParams(preset.params, true);
    this.app.setEmanationRate(preset.emanationRate ?? 2.0);
    this.app.setBlendMode(preset.blendMode ?? 'additive');
    
    // Update audio mappings
    if (preset.audioMappings !== undefined) {
      this.app.getAudioMapper().setMappings(preset.audioMappings);
    }
    
    // Update UI sliders
    this.updateAllSliders();
  }
}
```

### Slider Update Pattern

**Important:** Do NOT call `updateAllSliders()` on every parameter change. This causes severe lag.

**Correct Pattern:**
- Update sliders on preset load
- Update sliders when jiggle is stopped
- Update individual slider when user changes it (bidirectional sync)

**Wrong Pattern:**
```typescript
// DON'T DO THIS - causes lag
app.onParamsChange(() => {
  ui.updateAllSliders(); // Updates ALL sliders on EVERY change
});
```

### Shader Uniform Pattern

```typescript
// In Renderer.ts
render(options: RenderOptions): void {
  // Set shape shader uniforms
  this.setUniforms(this.program, {
    u_time: options.uniforms.u_time,
    u_spikiness: options.uniforms.u_spikiness,
    // ... etc
  });
  
  // Render shape to current framebuffer
  
  // Set dilation shader uniforms
  this.setUniforms(this.dilationProgram, {
    u_time: options.uniforms.u_time,
    u_expansionFactor: options.dilationFactor,
    // ... etc
  });
  
  // Render dilation effect
}
```

---

## File Structure & Responsibilities

### Core Application Files

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/main.ts` | Entry point, initialization | - |
| `src/App.ts` | Application state, render loop | `App` class |
| `src/types/index.ts` | Type definitions | `VisualParams`, `AudioMetrics`, `Preset`, etc. |

### Rendering System

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/render/Renderer.ts` | WebGL rendering, framebuffers | `Renderer` class |
| `src/render/Parameters.ts` | Parameter defaults, ranges, jiggle | `createDefaultParams()`, `PARAM_RANGES`, `applyJiggle()` |
| `src/render/ParameterInterpolator.ts` | Smooth parameter transitions | `ParameterInterpolator` class |
| `src/render/shaders.ts` | Shader loading utilities | `loadAllShaders()` |

### Audio System

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/audio/AudioAnalyzer.ts` | FFT analysis, metrics | `AudioAnalyzer` class |
| `src/audio/AudioMapper.ts` | Audio-to-visual mapping | `AudioMapper` class |

### UI System

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/ui/UIController.ts` | DOM interactions, sliders, presets | `UIController` class |
| `src/ui/valueUtils.ts` | Value parsing, range expansion | `parseNumericValue()`, `calculateExpandedRange()` |

### Preset System

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/presets/PresetManager.ts` | Preset save/load/export | `PresetManager` class |
| `src/presets/defaultPresets.ts` | 49 built-in presets | `getDefaultPresetsMap()`, `getDefaultEmanationRate()` |

### Mapping System

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/mapping/CurveMapping.ts` | Slider-to-value curves | `CurveMapper`, `mapSliderToValue()`, `reverseMapValueToSlider()` |

### Capture System

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/capture/Capture.ts` | PNG/GIF/WebM recording | `takeSnapshot()`, `GifRecorder`, `ScreenRecorder` |

### Configuration

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/config/Resolution.ts` | Resolution management | `ResolutionKey`, `getResolutionDisplayString()` |
| `src/config/resolutions.ts` | Resolution definitions | `RESOLUTIONS` |
| `src/config/paramLabels.ts` | Parameter display labels | `PARAM_LABELS`, `getParamLabel()` |

### Components

| File | Responsibility | Key Exports/Classes |
|------|---------------|---------------------|
| `src/components/param-slider/ParamSlider.ts` | Slider component | `ParamSlider` class |
| `src/components/editable-value/EditableValue.ts` | Editable value component | `EditableValue` class |
| `src/components/control-group/ControlGroup.ts` | Control group component | `ControlGroup` class |
| `src/components/types.ts` | Component event types | `ParamChangeEventDetail`, etc. |

---

## Common Tasks & Quick Reference

### Adding a New Parameter

1. **Add to type definition:**
   ```typescript
   // src/types/index.ts
   export interface VisualParams {
     // ... existing params
     newParam: number;
   }
   ```

2. **Add to parameter ranges:**
   ```typescript
   // src/render/Parameters.ts
   export const PARAM_RANGES: Record<keyof VisualParams, [number, number]> = {
     // ... existing ranges
     newParam: [0, 1],
   };
   ```

3. **Add to curve defaults:**
   ```typescript
   // src/mapping/CurveMapping.ts
   export const PARAM_CURVE_DEFAULTS: Record<keyof VisualParams, CurveSettings> = {
     // ... existing defaults
     newParam: { min: 0, max: 1, power: 1.0, type: 'power' },
   };
   ```

4. **Add to default params:**
   ```typescript
   // src/render/Parameters.ts
   export function createDefaultParams(): VisualParams {
     return {
       // ... existing defaults
       newParam: 0.5,
     };
   }
   ```

5. **Add to renderer uniforms:**
   ```typescript
   // src/render/Renderer.ts
   export interface RenderUniforms {
     // ... existing uniforms
     u_newParam: number;
   }
   ```

6. **Add to shader:**
   ```glsl
   // shaders/star.frag or dilation.frag
   uniform float u_newParam;
   ```

7. **Add UI slider:**
   ```html
   <!-- index.html -->
   <param-slider param="newParam"></param-slider>
   ```

8. **Add label:**
   ```typescript
   // src/config/paramLabels.ts
   export const PARAM_LABELS = {
     // ... existing labels
     newParam: 'New Parameter',
   };
   ```

### Adding a Keyboard Shortcut

```typescript
// src/ui/UIController.ts
private handleKeyDown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'N': // Your new key
      // Your action
      break;
  }
}
```

### Adding a Preset

```typescript
// src/presets/defaultPresets.ts
export const DEFAULT_PRESETS: Record<string, RawPreset> = {
  // ... existing presets
  'My Preset': {
    spikiness: 0.5,
    scale: 0.8,
    // ... other params
  },
};
```

### Modifying Shader Behavior

1. Edit shader file: `shaders/star.frag` or `shaders/dilation.frag`
2. Update uniform interface in `src/render/Renderer.ts` if needed
3. Update uniform setting in `Renderer.render()`

### Adding Audio Mapping

```typescript
// In UIController or App
const mapping: AudioMappingConfig = {
  enabled: true,
  source: 'rms', // or 'bass', 'mid', 'high', etc.
  sensitivity: 1.0,
  smoothing: 0.8,
  multiplier: 1.0,
  offset: 0.0,
  invert: false,
  minValue: 0,
  maxValue: 1,
};

audioMapper.setMapping('spikiness', mapping);
```

### Testing a Change

```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run unit tests
npm run test:run

# Run E2E tests (requires dev server)
npm run test:e2e

# Full check
npm run check
```

---

## Testing Requirements

### Critical Rule
**CRITICAL: Every feature must have associated automated tests.**

### Acceptance Criteria
1. All new features MUST have unit tests covering their core functionality
2. All tests MUST pass before a feature is considered complete
3. When modifying existing features, verify tests exist and pass
4. UI interactions should have corresponding E2E tests where feasible

### Test Organization

- **Unit tests:** `tests/unit/*.test.ts` - Test individual functions and classes
- **E2E tests:** `tests/e2e/*.spec.ts` - Test full user flows with Playwright

### Test Commands

```bash
# Run all unit tests
npm run test:run

# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests (requires dev server)
npm run test:e2e

# Full check (typecheck + lint + test)
npm run check
```

### Agent Workflow
When working on any feature:
1. **Before starting:** Check if tests exist for the feature
2. **During development:** Write tests alongside code
3. **Before completing:** Run `npm run test:run` to verify all tests pass
4. **On failure:** Fix the failing tests before proceeding

### Existing Test Files

- `tests/unit/CurveMapping.test.ts` - Curve mapping tests
- `tests/unit/ParameterInterpolator.test.ts` - Interpolation tests
- `tests/unit/Parameters.test.ts` - Parameter utilities tests
- `tests/unit/PresetManager.test.ts` - Preset management tests
- `tests/unit/valueUtils.test.ts` - Value parsing tests
- `tests/e2e/smoke.spec.ts` - Basic smoke tests
- `tests/e2e/directValueInput.spec.ts` - Direct value input E2E tests

### Testing Requirements - Editable Value Displays

**Important:** ALL UI displays of parameter/mapping values must allow direct input on the number itself.

**Requirements:**
- Add unit tests for `setupEditableValue()` in UIController
- Add E2E tests for direct value input (clicking on value, typing, blur to apply)
- Test edge cases: invalid input, out-of-range values, special characters
- Verify value updates propagate correctly to underlying parameter

---

## Known Issues & Gotchas

### 1. Visual Parity with lucas.html

**Status:** Close but not exact

**Details:**
- Firefox renders closer to `lucas.html` than Chrome
- Chrome may have occasional "flash" artifacts
- Some presets show different values (may be display timing)

**Investigation needed:**
- Compare parameter values at runtime between both versions
- Compare shader uniform values
- Test specific presets side-by-side

### 2. Audio Capture

**Status:** Partially implemented

**Details:**
- Button IDs fixed (`audio-enable-btn`, `audio-tab-btn`) - must match `index.html`
- AudioAnalyzer is instantiated and wired up
- Audio Controls section is collapsed by default (user must expand it)
- 3 mappings enabled by default: scale, spikiness, fillSize

**To verify:**
- Test in Chrome: click "Capture Tab Audio", verify dialog appears
- Verify audio metrics flow to visualizer (check 'M' panel for meter movement)
- Check browser console for errors
- **Note:** Tab audio capture requires user gesture and "Share tab audio" checkbox

### 3. Slider Update Performance

**Gotcha:** Calling `updateAllSliders()` on every parameter change causes severe lag.

**Solution:** Only update sliders on:
- Preset load
- Jiggle stop
- Individual slider change (bidirectional sync)

### 4. Parameter Interpolation

**Gotcha:** Preset loading should use `immediate: true` to snap values instantly.

**Solution:**
```typescript
app.setParams(preset.params, true); // immediate snap
```

**Fix Applied:** `setParams()` now snaps interpolator values immediately by default when loading presets to avoid display timing issues (showing interpolated vs target values).

### 5. emanationRate Handling

**Gotcha:** `emanationRate` is NOT part of `VisualParams` and is NOT interpolated.

**Solution:** Handle separately:
```typescript
app.setEmanationRate(preset.emanationRate ?? 2.0);
```

### 6. Browser-Specific Behavior

**Chrome:**
- Primary target, some visual differences observed
- May have different `requestAnimationFrame` timing behavior (mitigated by using `setInterval`)
- Chrome's WebGL implementation may differ in floating-point precision
- Occasional flash artifacts observed
- Tab audio capture requires user gesture and "Share tab audio" checkbox

**Firefox:**
- Closer visual match to `lucas.html`
- More consistent rendering

**Safari:** Untested

**Edge:** Should work (Chromium-based)

### 7. Audio Mapping Panel

**Status:** 'M' hotkey toggles panel visibility

**Missing:** Full audio mapping UI implementation (parameter-to-metric bindings)

**Note:** Port the audio mapping UI from `lucas.html` to complete this feature.

---

## Debugging & Development Tools

### Global Debug Access

The following are exposed on `window` for console debugging:

```javascript
window.app              // App instance
window.ui                // UIController instance
window.audioAnalyzer     // AudioAnalyzer instance
```

### Useful Debug Commands

```javascript
// Get current parameter values
window.app.getParams()

// Get current preset name
window.ui.getCurrentPresetName()

// Check audio status
window.audioAnalyzer.isEnabled
window.audioAnalyzer.isStereoMode

// Get audio metrics
window.audioAnalyzer.getMetrics()

// Load a preset
window.ui.loadPreset('Preset Name')

// Set a parameter directly
window.app.setParam('spikiness', 0.8)

// Get renderer state
window.app.getRenderer()
```

### Development Server

```bash
npm run dev  # Starts Vite dev server on http://localhost:3000
```

**Note:** Vite config shows port 3000, but README mentions 5173. Check `vite.config.ts` for actual port.

### Comparing with lucas.html

**Reference Implementation:** `lucas.html` is the "ground truth" for visual behavior. When in doubt, compare against lucas.html.

**Comparison Process:**
1. Open both `index.html` and `lucas.html` side-by-side
2. Load the same preset in both
3. Compare visual appearance
4. Use browser DevTools to inspect:
   - Parameter values
   - Shader uniform values
   - Canvas rendering
5. Compare parameter values at runtime between both versions
6. Compare shader uniform values between lucas.html and TypeScript version
7. Test specific presets side-by-side

### Type Checking

```bash
npm run typecheck  # TypeScript type checking
```

**Rule:** All code must pass type checking before committing.

### Linting

```bash
npm run lint       # Check for linting errors
npm run lint:fix    # Auto-fix linting errors
```

---

## Important Constants & Defaults

### Timing Constants

```typescript
// App.ts
TARGET_FPS = 60
FRAME_TIME = 1000 / 60  // ~16.67ms
```

### Default Values

```typescript
// Parameters.ts
DEFAULT_PARAMS: VisualParams = {
  spikiness: 0.5,
  spikeFrequency: 5,
  spikeSharpness: 0.5,
  hue: 180,
  scale: 0.5,
  // ... see Parameters.ts for full list
}

// App.ts
DEFAULT_EMANATION_RATE = 2.0
DEFAULT_BLEND_MODE = 'additive'
```

### Parameter Ranges

See `src/render/Parameters.ts` → `PARAM_RANGES` for all parameter min/max values.

### Curve Defaults

See `src/mapping/CurveMapping.ts` → `PARAM_CURVE_DEFAULTS` for all curve settings.

---

## File Locations for Common Tasks

| Task | File(s) |
|------|---------|
| Add new parameter | `src/types/index.ts`, `src/render/Parameters.ts`, `src/mapping/CurveMapping.ts`, `src/config/paramLabels.ts` |
| Add keyboard shortcut | `src/ui/UIController.ts` → `handleKeyDown()` |
| Modify shader | `shaders/star.frag`, `shaders/dilation.frag` |
| Add preset | `src/presets/defaultPresets.ts` |
| Change audio analysis | `src/audio/AudioAnalyzer.ts` |
| Modify render pipeline | `src/render/Renderer.ts` |
| Change UI layout | `index.html`, `styles/main.css` |
| Add component | `src/components/` |
| Modify curve mapping | `src/mapping/CurveMapping.ts` |
| Change capture behavior | `src/capture/Capture.ts` |

---

## Code Standards

### TypeScript Only
**All code must be TypeScript (.ts/.tsx files).** Do not create JavaScript (.js/.jsx) files. This includes:
- Source code in `src/`
- Test files in `tests/`
- Scripts in `scripts/`
- Configuration files that support TypeScript (use .ts where possible)

All code must pass type checking (`npm run typecheck`).

### Naming Conventions
- Classes: PascalCase (`AudioAnalyzer`)
- Functions: camelCase (`getMetrics()`)
- Constants: UPPER_SNAKE_CASE (`PARAM_RANGES`)
- Types/Interfaces: PascalCase (`VisualParams`)

### File Organization
- One class/interface per file (generally)
- Related utilities grouped in same directory
- Exports via `index.ts` for clean imports

### Comments
- JSDoc comments for public APIs
- Inline comments for complex logic
- TODO comments for known issues

---

## Quick Reference: Key Functions

### App Class
```typescript
app.setParam(name, value, immediate?)
app.setParams(params, immediate?)
app.setEmanationRate(rate)
app.setBlendMode(mode)
app.getParams()
app.start()
app.stop()
app.pause()
app.resume()
```

### UIController Class
```typescript
ui.loadPreset(name)
ui.savePreset(name)
ui.updateAllSliders()
ui.updateAudioMetrics(metrics)
```

### AudioAnalyzer Class
```typescript
audioAnalyzer.enableAudio(deviceId?, preferStereo?)
audioAnalyzer.enableTabAudio()
audioAnalyzer.disableAudio()
audioAnalyzer.getMetrics()
```

### PresetManager Class
```typescript
presetManager.loadPreset(name)
presetManager.savePreset(name, params)
presetManager.deletePreset(name)
presetManager.exportPresets()
presetManager.importPresets(json)
```

---

## Next Steps / TODO

### High Priority
1. **Verify audio capture works end-to-end**
   - Test in Chrome: click "Capture Tab Audio", verify dialog appears
   - Verify audio metrics flow to visualizer (check 'M' panel for meter movement)
   - Check browser console for errors
   - **Note:** 3 mappings enabled by default: scale, spikiness, fillSize

2. **Visual parity debugging**
   - Add debug output to compare parameter values at runtime
   - Compare shader uniform values between lucas.html and TypeScript version
   - Test specific presets side-by-side

3. **Chrome flash issue**
   - Investigate browser-specific WebGL behavior
   - Check if related to framebuffer operations or timing

### Medium Priority
4. **Audio mapping UI**
   - Implement full audio mapping panel (bind audio metrics to parameters)
   - Port the audio mapping UI from lucas.html

5. **Audio device selection**
   - Wire up `audio-device-select` dropdown
   - Implement device enumeration

6. **Preset migration**
   - Verify old localStorage presets migrate correctly
   - Test preset export/import

### Low Priority
7. **Code cleanup**
   - Remove any unused code paths
   - Add missing TypeScript types
   - Improve error handling

8. **Testing - Editable Value Displays**
   - Ensure ALL UI displays of parameter/mapping values allow direct input on the number itself
   - Add unit tests for `setupEditableValue()` in UIController
   - Add E2E tests for direct value input (clicking on value, typing, blur to apply)
   - Test edge cases: invalid input, out-of-range values, special characters
   - Verify value updates propagate correctly to underlying parameter

9. **Testing - General**
   - Add more unit tests for CurveMapping edge cases
   - Add integration tests for preset loading
   - Add E2E tests for curve editor modal

## Important Fixes Applied

These fixes have been applied and should be maintained:

1. **Dilation mapping** - Fixed to use exact lucas.html formula with 0-200 slider range
2. **Slider lag** - Removed expensive `onParamsChange` callback that updated ALL sliders
3. **Jiggle toggle** - Fixed to use actual jiggle state instead of frozen state
4. **Preset loading** - Added `immediate` parameter to `setParams()` to snap interpolator
5. **Timing** - Switched from `requestAnimationFrame` to `setInterval` at 60fps
6. **totalRotation** - Changed from accumulated deltaTime to absolute time calculation
7. **emanationRate** - Changed default from 1.0 to 2.0
8. **Audio wiring** - Created AudioAnalyzer, wired to UIController, added M hotkey
9. **Button IDs** - Fixed to match index.html (`audio-enable-btn`, `audio-tab-btn`)
10. **Audio metrics UI** - Added `ui.updateAudioMetrics()` call to update the metrics table
11. **Default audio mappings** - Enabled scale, spikiness, fillSize mappings by default

## Key Differences from lucas.html (All Fixed)

| Aspect | lucas.html | TypeScript Version |
|--------|------------|-------------------|
| Timing | `setInterval(render, 16.67)` | `setInterval(tick, 16.67)` ✓ Fixed |
| totalRotation | `rotation + (time * speed)` | `rotation + (time * speed)` ✓ Fixed |
| emanationRate default | 2.0 | 2.0 ✓ Fixed |
| Dilation slider range | 0-200 | 0-200 ✓ Fixed |
| Dilation formula | Complex exponential | Matched exactly ✓ |

## Notes for Future Development

1. **Visual Parity:** Continue working toward exact match with `lucas.html`
2. **Audio Mapping UI:** Complete the full audio mapping panel implementation
3. **Testing:** Add more unit tests for edge cases, especially in `CurveMapping`
4. **Documentation:** Keep this file updated as the codebase evolves
5. **Performance:** Monitor slider update performance, avoid unnecessary DOM updates
6. **Browser Compatibility:** Test in Chrome, Firefox, Safari, Edge

---

**End of Reference Guide**
