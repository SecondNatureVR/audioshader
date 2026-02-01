# Feature: Kaleidoscope Mode with N-Way Symmetry

## Overview
Implement a kaleidoscope effect using fractional repetition to create n-way rotational symmetry. This will mirror and repeat slices of the rendered image to create symmetric patterns.

## Reference Implementation
Shadertoy example: https://www.shadertoy.com/view/4ss3WX

## Questions for Clarification

1. **Symmetry Configuration:**
   - Should `n` (number of segments) be configurable? (Range: 2-16? 2-32?)
   - Should symmetry be always enabled, or toggleable?
   - Should `n` be saved in presets?

2. **Implementation Location:**
   - **Option A**: Post-processing effect (applied to final rendered image)
   - **Option B**: Shader-level modification (modify star shader to render in slices)
   - **Option C**: Both (shader for performance, post-process for flexibility)

3. **Visual Behavior:**
   - Should the center point be fixed at screen center, or configurable?
   - Should rotation of the kaleidoscope pattern be controllable?
   - Should there be a "seam" between segments, or seamless blending?

4. **Performance:**
   - Is real-time performance critical? (60fps target?)
   - Acceptable performance trade-offs for higher `n` values?

5. **Integration:**
   - Should kaleidoscope work with existing effects (blur, noise, etc.)?
   - Should it work with the emanation/history system?
   - Should jiggle affect the kaleidoscope pattern?

## Implementation Plan

### Phase 1: Basic Kaleidoscope Shader

1. **Fragment Shader Modification**
   - Add `u_kaleidoscopeEnabled` uniform (bool)
   - Add `u_kaleidoscopeSegments` uniform (float, number of segments)
   - Implement fractional repetition logic

2. **Kaleidoscope Algorithm**
   ```glsl
   // Convert to polar coordinates
   vec2 center = u_resolution * 0.5;
   vec2 coord = fragCoord - center;
   float angle = atan(coord.y, coord.x);
   float radius = length(coord);
   
   // Fold into segment
   float segmentAngle = 2.0 * PI / u_kaleidoscopeSegments;
   angle = mod(angle, segmentAngle * 2.0);
   if (angle > segmentAngle) {
       angle = segmentAngle * 2.0 - angle; // Mirror
   }
   
   // Convert back to cartesian
   vec2 kaleidCoord = center + vec2(cos(angle), sin(angle)) * radius;
   
   // Sample original texture at kaleidCoord
   vec4 color = texture2D(u_texture, kaleidCoord / u_resolution);
   ```

3. **UI Controls**
   - Toggle checkbox: "Kaleidoscope"
   - Slider: "Segments" (2-16 or 2-32)
   - Display current segment count

### Phase 2: Post-Processing Approach (Recommended)

Since we already have a dilation/post-processing shader, we can add kaleidoscope as a post-process step:

1. **Modify Dilation Fragment Shader**
   - Add kaleidoscope uniforms
   - Apply kaleidoscope transformation before other effects
   - Ensure it works with existing blur/noise effects

2. **Advantages of Post-Process:**
   - Works with existing rendering pipeline
   - Can be toggled on/off easily
   - Doesn't require modifying star shader
   - Can be applied to history buffer too

### Phase 3: Enhanced Features

1. **Rotation Control**
   - Add `u_kaleidoscopeRotation` uniform
   - Rotate the pattern before folding
   - Control via slider or auto-rotation

2. **Center Point Control**
   - Make center point configurable (currently fixed at screen center)
   - Could be useful for creative effects

3. **Seamless Blending**
   - Smooth transitions between segments
   - Optional: fade edges to avoid harsh seams

## Technical Implementation

### Shader Code Structure

```glsl
// In dilation-fragment.glsl or new kaleidoscope pass

uniform bool u_kaleidoscopeEnabled;
uniform float u_kaleidoscopeSegments;
uniform float u_kaleidoscopeRotation;

vec2 kaleidoscopeTransform(vec2 uv, vec2 resolution) {
    if (!u_kaleidoscopeEnabled || u_kaleidoscopeSegments < 2.0) {
        return uv;
    }
    
    vec2 center = vec2(0.5, 0.5); // Normalized center
    vec2 coord = uv - center;
    
    // Convert to polar
    float angle = atan(coord.y, coord.x) + u_kaleidoscopeRotation;
    float radius = length(coord);
    
    // Fold into segment
    float segmentAngle = 6.28318530718 / u_kaleidoscopeSegments; // 2*PI / n
    angle = mod(angle, segmentAngle * 2.0);
    
    // Mirror if in second half of segment pair
    if (angle > segmentAngle) {
        angle = segmentAngle * 2.0 - angle;
    }
    
    // Convert back to cartesian (normalized)
    vec2 folded = vec2(cos(angle), sin(angle)) * radius;
    return center + folded;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    
    // Apply kaleidoscope transformation
    vec2 kaleidUV = kaleidoscopeTransform(uv, u_resolution);
    
    // Sample texture with transformed UV
    vec4 color = texture2D(u_historyTexture, kaleidUV);
    
    // Apply other effects (blur, noise, etc.)
    // ...
    
    gl_FragColor = color;
}
```

### JavaScript Integration

```javascript
// In sandbox.html

// State
let kaleidoscopeEnabled = false;
let kaleidoscopeSegments = 6; // Default 6-way symmetry
let kaleidoscopeRotation = 0.0;

// UI Elements
const kaleidoscopeToggle = document.getElementById('kaleidoscope-toggle');
const kaleidoscopeSegmentsSlider = document.getElementById('kaleidoscope-segments-slider');

// In render loop, pass uniforms:
renderer.setUniform('u_kaleidoscopeEnabled', kaleidoscopeEnabled);
renderer.setUniform('u_kaleidoscopeSegments', kaleidoscopeSegments);
renderer.setUniform('u_kaleidoscopeRotation', kaleidoscopeRotation);
```

## UI Design

### Dev Toolbox Section: "Kaleidoscope"
```
[ ] Enable Kaleidoscope
Segments: [====|----] 6
Rotation: [====|----] 0°
```

### Placement
- New section in dev toolbox, perhaps after "Effects" or "Filters"
- Could also be a toggle in status indicators for quick access

## Performance Considerations

### Computational Cost
- Kaleidoscope transformation: ~5-10 math operations per pixel
- At 1920x1080: ~2M pixels = ~10-20M operations per frame
- Modern GPUs handle this easily, should maintain 60fps

### Optimization Options
- Only apply when enabled (early return in shader)
- Lower resolution for kaleidoscope pass (if needed)
- Cache calculations if segments don't change

## Files to Modify

1. **shaders/dilation-fragment.glsl**
   - Add kaleidoscope uniforms
   - Add `kaleidoscopeTransform()` function
   - Apply transformation in main()

2. **sandbox.html**
   - Add UI controls for kaleidoscope
   - Add state variables
   - Pass uniforms to shader
   - Add to preset save/load

3. **gl/renderer.js** (if needed)
   - Ensure uniforms are passed correctly
   - May need to add uniform locations

## Testing Checklist

- [ ] Kaleidoscope creates correct n-way symmetry
- [ ] Segments are seamless (no visible seams)
- [ ] Rotation control works smoothly
- [ ] Toggle on/off works correctly
- [ ] Works with existing effects (blur, noise)
- [ ] Works with emanation/history system
- [ ] Performance maintained at 60fps
- [ ] Saves/loads in presets
- [ ] Edge cases handled (n=1, very large n, etc.)

## Edge Cases

1. **n = 1**: Should disable or show single segment?
2. **Very large n**: Performance impact? Visual quality?
3. **Screen edges**: How to handle pixels outside circle?
4. **Non-square resolutions**: Center point calculation

## Future Enhancements

1. **Radial Kaleidoscope**: Different pattern (radial slices instead of rotational)
2. **Multiple Kaleidoscope Layers**: Nested patterns
3. **Animated Segments**: Number of segments changes over time
4. **Audio-Reactive**: Segments respond to audio (more segments on beats?)
5. **Custom Patterns**: User-defined symmetry patterns

## Alternative: Shader-Level Implementation

If post-processing doesn't work well, we could modify the star shader directly:

**Pros:**
- More control over rendering
- Can optimize per-segment

**Cons:**
- More complex shader code
- Harder to toggle on/off
- May conflict with existing shader logic

**Recommendation**: Start with post-processing approach, move to shader-level if needed.


