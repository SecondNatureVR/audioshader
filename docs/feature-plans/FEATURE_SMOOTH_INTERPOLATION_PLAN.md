# Feature: Smooth Interpolation System

## Overview
Implement smooth interpolation for all parameter changes to eliminate jitteriness when:
- Switching presets
- Using arrow keys for acceleration/deceleration
- Adjusting rotation (manual or auto)
- Any parameter changes via sliders

## Current Issues Identified

1. **Preset Switching**: Instant value changes cause visual jumps
2. **Arrow Key Acceleration**: Direct value modification causes jitter
3. **Rotation Changes**: Manual rotation slider and auto-rotation cause shape jumps
4. **General Parameter Changes**: Any slider adjustment can cause discontinuities

## Questions for Clarification

1. **Interpolation Method:**
   - **Easing Functions**: Which easing? (Linear, Ease-in-out, Exponential, Spring physics?)
   - **Duration**: How long should interpolation take? (Fixed time? Per-parameter? Configurable?)
   - **Per-Parameter Settings**: Should some params interpolate faster/slower than others?

2. **Rotation-Specific:**
   - Should rotation interpolation handle wrapping? (359° → 1° should go through 360°, not backwards)
   - Should manual and auto rotation be interpolated separately or combined?
   - Current code uses `totalRotation = rotation + (currentTime * autoRotationSpeed)` - should this be interpolated?

3. **Preset Switching:**
   - Should all parameters interpolate simultaneously?
   - Should interpolation be interruptible? (If user switches presets mid-interpolation)
   - Should interpolation duration be configurable per preset?

4. **Acceleration/Deceleration:**
   - Should arrow key presses set target values that interpolate, or directly modify with smoothing?
   - Current implementation directly modifies values - should this change to target-based?

5. **Performance:**
   - How many parameters need interpolation? (All 17+ parameters?)
   - Should interpolation be frame-rate independent?
   - Acceptable interpolation overhead? (target: <1ms per frame)

## Implementation Plan

### Phase 1: Core Interpolation System

1. **Interpolation State Structure**
   ```javascript
   // For each parameter, track:
   {
       current: value,      // Actual value being used
       target: value,       // Target value to interpolate to
       velocity: 0,         // For physics-based interpolation
       interpolationType: 'linear' | 'ease' | 'spring'
   }
   ```

2. **Interpolation Manager Class**
   - Track all interpolating parameters
   - Update all interpolations each frame
   - Handle parameter bounds/clamping
   - Support different interpolation types

3. **Basic Interpolation Types**
   - **Linear**: Simple lerp with fixed duration
   - **Ease-in-out**: Smooth acceleration/deceleration
   - **Spring**: Physics-based with damping (for natural feel)

### Phase 2: Parameter Integration

1. **Separate Current vs Target Values**
   - Current values: Used for rendering (smoothly interpolated)
   - Target values: Set by user input, presets, hotkeys
   - Interpolation bridges the gap

2. **Update Render Loop**
   - Use interpolated `current` values for rendering
   - Update interpolation each frame
   - Ensure 60fps performance

3. **Update Input Handlers**
   - Sliders set `target` values (not `current`)
   - Preset loading sets `target` values
   - Arrow keys modify `target` values

### Phase 3: Rotation-Specific Handling

1. **Rotation Interpolation**
   - Handle angle wrapping (359° → 1° goes forward, not backward)
   - Separate interpolation for manual rotation
   - Auto-rotation continues smoothly during interpolation

2. **Total Rotation Calculation**
   - Interpolate manual rotation separately
   - Add auto-rotation on top (already time-based, smooth)
   - Ensure no jumps when auto-rotation speed changes

### Phase 4: Preset Switching Enhancement

1. **Smooth Preset Transitions**
   - When loading preset, set all `target` values
   - Interpolation system handles smooth transition
   - Configurable transition duration (e.g., 0.5s default)

2. **Interrupt Handling**
   - If new preset loaded mid-interpolation, update targets
   - Don't reset interpolation, just change destination

## Technical Approach

### Option A: Simple Lerp (Easiest)
```javascript
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Each frame:
currentValue = lerp(currentValue, targetValue, 0.1); // 10% per frame
```

**Pros**: Simple, predictable
**Cons**: Fixed speed, may feel mechanical

### Option B: Easing Functions (Recommended)
```javascript
function easeInOut(t) {
    return t < 0.5 
        ? 2 * t * t 
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function interpolate(start, end, progress, duration) {
    const t = easeInOut(Math.min(progress / duration, 1));
    return lerp(start, end, t);
}
```

**Pros**: Smooth, natural feel
**Cons**: Slightly more complex

### Option C: Spring Physics (Most Natural)
```javascript
class SpringInterpolator {
    constructor(spring = 0.1, damping = 0.8) {
        this.spring = spring;
        this.damping = damping;
        this.velocity = 0;
    }
    
    update(current, target, deltaTime) {
        const distance = target - current;
        const force = distance * this.spring;
        this.velocity = (this.velocity + force) * this.damping;
        return current + this.velocity * deltaTime;
    }
}
```

**Pros**: Very natural, handles interruptions well
**Cons**: More complex, less predictable timing

## Recommended Approach

**Hybrid**: Use easing functions for most parameters, spring physics for rotation (since it's most noticeable).

### Implementation Structure

```javascript
class ParameterInterpolator {
    constructor() {
        this.params = new Map(); // paramName -> {current, target, startTime, duration}
        this.springParams = new Map(); // For rotation: paramName -> {current, target, velocity}
    }
    
    setTarget(paramName, targetValue, duration = 0.5) {
        const current = this.params.get(paramName)?.current ?? targetValue;
        this.params.set(paramName, {
            current,
            target: targetValue,
            startTime: Date.now(),
            duration: duration * 1000 // Convert to ms
        });
    }
    
    update() {
        const now = Date.now();
        this.params.forEach((state, paramName) => {
            const elapsed = now - state.startTime;
            const progress = Math.min(elapsed / state.duration, 1);
            
            if (progress >= 1) {
                state.current = state.target;
            } else {
                const t = easeInOut(progress);
                state.current = lerp(state.startValue ?? state.current, state.target, t);
            }
        });
        
        // Update spring-based params (rotation)
        this.springParams.forEach((state, paramName) => {
            const deltaTime = 1/60; // Assume 60fps
            const distance = state.target - state.current;
            const force = distance * 0.1; // Spring constant
            state.velocity = (state.velocity + force) * 0.8; // Damping
            state.current += state.velocity * deltaTime;
        });
    }
    
    getCurrent(paramName) {
        return this.params.get(paramName)?.current ?? 
               this.springParams.get(paramName)?.current ?? 
               0;
    }
}
```

## Files to Modify

1. **sandbox.html**
   - Add `ParameterInterpolator` class
   - Modify all parameter setters to use `setTarget()`
   - Update render loop to use interpolated values
   - Fix preset loading to use interpolation
   - Fix arrow key handlers to set targets
   - Fix rotation handling (manual + auto)

2. **Preset System**
   - Ensure preset loading triggers interpolation
   - Consider saving interpolation preferences

## Rotation-Specific Solution

### Current Problem
```javascript
// Current code captures rotation instantly:
const totalRotation = rotation + (currentTime * autoRotationSpeed);
```

### Solution
```javascript
// Interpolate manual rotation separately:
let currentManualRotation = rotation; // Interpolated
let targetManualRotation = rotation;   // Set by slider

// In render loop:
currentManualRotation = interpolate(currentManualRotation, targetManualRotation, ...);
const totalRotation = currentManualRotation + (currentTime * autoRotationSpeed);
```

## Testing Checklist

- [ ] Preset switching is smooth (no jumps)
- [ ] Arrow key acceleration/deceleration is smooth
- [ ] Rotation changes don't cause shape jumps
- [ ] Slider adjustments are smooth
- [ ] Rotation wrapping works correctly (359° → 1°)
- [ ] Auto-rotation continues smoothly during manual rotation changes
- [ ] Performance maintained at 60fps
- [ ] Multiple rapid preset switches handled gracefully
- [ ] Interpolation completes in reasonable time

## Performance Considerations

- Interpolation calculations are O(n) where n = number of parameters
- With 17+ parameters, should still be <1ms per frame
- Consider batching updates
- Cache easing function results if needed

## Future Enhancements

- Per-parameter interpolation settings (speed, easing type)
- Visual interpolation preview/indicator
- Interpolation curves editor (like curve editor for params)
- Audio-reactive interpolation (faster transitions on beats)


