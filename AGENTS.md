# AudioShader - Agent Handoff Document

## Project Overview

AudioShader is an audio-reactive WebGL visualizer. This project is a **TypeScript refactor** of the original `lucas.html` monolithic implementation. The goal is feature parity with lucas.html while having a maintainable, modular codebase.

**Reference Implementation:** `lucas.html` - This is the "ground truth" for visual behavior. When in doubt, compare against lucas.html.

## Architecture

```
src/
├── App.ts                 # Main application state, render loop, parameter management
├── main.ts                # Entry point, wires up App, UIController, AudioAnalyzer
├── index.ts               # Exports
├── types/index.ts         # TypeScript type definitions
├── render/
│   ├── Renderer.ts        # WebGL rendering, framebuffer ping-pong, shader management
│   ├── Parameters.ts      # Parameter definitions, ranges, jiggle logic
│   ├── ParameterInterpolator.ts  # Spring physics and easing for smooth transitions
│   └── shaders.ts         # Shader loading utilities
├── audio/
│   ├── AudioAnalyzer.ts   # FFT analysis, audio metrics extraction
│   └── AudioMapper.ts     # Maps audio metrics to visual parameters
├── ui/
│   └── UIController.ts    # All DOM interactions, sliders, presets, hotkeys
├── presets/
│   ├── PresetManager.ts   # Save/load/export presets
│   └── defaultPresets.ts  # 49 built-in presets from lucas.html
├── mapping/
│   └── CurveMapping.ts    # Slider-to-value curve transformations
├── capture/
│   └── Capture.ts         # PNG snapshots and GIF recording
└── config/
    ├── Resolution.ts      # Resolution configuration
    └── resolutions.ts     # Available resolutions
```

## Key Files

- **lucas.html** - Original monolithic implementation (reference for visual parity)
- **shaders/star.frag** - Star shape fragment shader
- **shaders/dilation.frag** - Dilation/expansion effect shader
- **index.html** - Main HTML with all UI elements

## Design Decisions

### emanationRate vs VisualParams

`emanationRate` is handled separately from `VisualParams` in the codebase. This is intentional:

| Aspect | VisualParams | emanationRate |
|--------|--------------|---------------|
| Purpose | Visual appearance | Timing (shapes/second) |
| Interpolation | Smooth transitions | Instant changes |
| Curve mapping | Yes (non-linear sliders) | No (1:1 linear) |
| Preset storage | `preset.params` | `preset.emanationRate` |
| App storage | `this.params` + interpolator | `this.emanationRate` |

This separation exists because emanationRate controls *when* shapes are captured, not *how* they look. Interpolating a rate value would cause unpredictable timing behavior.

## Current State

### What Works
- Basic rendering pipeline (star shape, dilation, history buffer)
- Preset loading from defaultPresets.ts
- Slider controls with curve mapping
- Jiggle effect
- Keyboard shortcuts (Space, R, H, J, S, G, M, arrows, etc.)
- Fixed 60fps timing (matching lucas.html's setInterval approach)
- Audio capture UI wired up (buttons exist)

### Known Issues / Bugs

#### 1. Visual Parity with lucas.html
- **Status:** Close but not exact
- **Details:** Firefox renders closer to lucas.html than Chrome
- **Chrome-specific:** May still have occasional "flash" artifacts
- **Investigation needed:** Compare parameter values at runtime between both versions

#### 2. Audio Capture
- **Status:** Partially implemented
- **Details:**
  - Button IDs fixed (`audio-enable-btn`, `audio-tab-btn`)
  - AudioAnalyzer is instantiated and wired up
  - Audio Controls section is collapsed by default (user must expand it)
- **To verify:** Test that `getDisplayMedia` dialog appears and audio metrics flow through

#### 3. Preset Value Discrepancies
- **Example:** User reported "Braid" preset shows different values in new version vs lucas.html
- **Root cause:** May be display timing (showing interpolated vs target values)
- **Fix applied:** `setParams()` now snaps interpolator values immediately by default

#### 4. Audio Mapping Panel
- **Status:** 'M' hotkey toggles panel visibility
- **Missing:** Full audio mapping UI implementation (parameter-to-metric bindings)

## Key Differences from lucas.html

| Aspect | lucas.html | TypeScript Version |
|--------|------------|-------------------|
| Timing | `setInterval(render, 16.67)` | `setInterval(tick, 16.67)` ✓ Fixed |
| totalRotation | `rotation + (time * speed)` | `rotation + (time * speed)` ✓ Fixed |
| emanationRate default | 2.0 | 2.0 ✓ Fixed |
| Dilation slider range | 0-200 | 0-200 ✓ Fixed |
| Dilation formula | Complex exponential | Matched exactly ✓ |

## Fixes Applied This Session

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

## Testing Requirements

**CRITICAL: Every feature must have associated automated tests.**

### Acceptance Criteria
1. All new features MUST have unit tests covering their core functionality
2. All tests MUST pass before a feature is considered complete
3. When modifying existing features, verify tests exist and pass
4. UI interactions should have corresponding E2E tests where feasible

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

### Test Organization
- **Unit tests:** `tests/unit/*.test.ts` - Test individual functions and classes
- **E2E tests:** `tests/e2e/*.spec.ts` - Test full user flows with Playwright

### Agent Workflow
When working on any feature:
1. **Before starting:** Check if tests exist for the feature
2. **During development:** Write tests alongside code
3. **Before completing:** Run `npm run test:run` to verify all tests pass
4. **On failure:** Fix the failing tests before proceeding

## Code Standards

### TypeScript Only
**All code must be TypeScript (.ts/.tsx files).** Do not create JavaScript (.js/.jsx) files. This includes:
- Source code in `src/`
- Test files in `tests/`
- Scripts in `scripts/`
- Configuration files that support TypeScript (use .ts where possible)

All code must pass type checking (`npm run typecheck`).

## Development Commands

```bash
# Install dependencies
npm install

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests (watch mode)
npm test

# Run tests (single run)
npm run test:run

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Full check (typecheck + lint + test)
npm run check
```

## Debugging Tips

1. **Compare with lucas.html:** Open both side-by-side, load same preset, compare visuals
2. **Console access:** `window.app`, `window.ui`, `window.audioAnalyzer` are exposed globally
3. **Parameter inspection:** `window.app.getParams()` returns current parameter values
4. **Audio status:** `window.audioAnalyzer.isEnabled`, `window.audioAnalyzer.isStereoMode`

## File Locations for Common Tasks

| Task | File(s) |
|------|---------|
| Add new parameter | `src/types/index.ts`, `src/render/Parameters.ts`, `src/mapping/CurveMapping.ts` |
| Add keyboard shortcut | `src/ui/UIController.ts` → `handleKeyDown()` |
| Modify shader | `shaders/star.frag`, `shaders/dilation.frag` |
| Add preset | `src/presets/defaultPresets.ts` |
| Change audio analysis | `src/audio/AudioAnalyzer.ts` |
| Modify render pipeline | `src/render/Renderer.ts` |

## Browser Compatibility

- **Chrome:** Primary target, some visual differences observed
- **Firefox:** Closer visual match to lucas.html
- **Safari:** Untested
- **Edge:** Should work (Chromium-based)

## Known Browser-Specific Issues

- Chrome may have different `requestAnimationFrame` timing behavior
- Chrome's WebGL implementation may differ in floating-point precision
- Tab audio capture requires user gesture and "Share tab audio" checkbox
