# Emanating Ripple Effect - Technical Specification

## Overview
Create a visual effect where the central parameterized star stays in the foreground, and every 0.5 seconds (2 Hz), a copy of the current shape is generated and expands outward, persisting until it leaves the frame.

## Architecture

### Rendering Pipeline (Multi-Pass)

**Framebuffer Objects (FBOs):**
- `historyTexture` + `historyFramebuffer`: Stores accumulated shapes from all previous frames
- `currentTexture` + `currentFramebuffer`: Temporary buffer for rendering operations
- Both textures: RGBA format, same resolution as canvas

**Rendering Steps (per frame):**

1. **Dilation Pass**: 
   - Bind `historyTexture` as input (source)
   - Render to `currentFramebuffer`
   - Shader samples from `historyTexture` with UV coordinates scaled outward
   - Scale factor: `1.01` per frame (1% expansion per frame)
   - This expands all previous shapes outward
   - Formula: `scaledUV = (uv - center) * scaleFactor + center`
   - Preserves alpha channel for transparency

2. **Current Shape Pass**:
   - Continue rendering to `currentFramebuffer` (additive blend)
   - Draw current star shape at center (0.5, 0.5) with current parameters
   - Only draw if it's time to generate a new shape (every 0.5 seconds)
   - OR: Always draw current shape, but only "capture" it every 0.5s

3. **Display Pass**:
   - Render `currentTexture` to screen (default framebuffer)

4. **Copy Pass**:
   - Copy `currentTexture` to `historyTexture` for next frame
   - This preserves the accumulated history

### Shape Generation Timing

**Timing Logic:**
- Track time since last shape generation
- Every 0.5 seconds (2 Hz):
  - Capture current shape parameters (spikes, hue, scale)
  - Draw shape to history buffer
- Between captures: continue dilating existing shapes

**Implementation Options:**

**Option A: Always Draw Current Shape**
- Current star always visible at center
- Every 0.5s, a "snapshot" is taken and added to history
- History dilates continuously
- Simpler logic, current shape always visible

**Option B: Capture-Based**
- Only draw to history every 0.5s
- Current shape drawn separately to screen
- More control, but requires separate rendering

**Recommendation: Option A** - simpler and current shape always visible

### Dilation Shader

**Input:**
- `sampler2D u_history`: Previous frame's accumulated shapes
- `vec2 u_resolution`: Canvas resolution
- `float u_expansionFactor`: Scale factor (e.g., 1.01)

**Logic:**
```glsl
vec2 center = vec2(0.5);
vec2 uv = gl_FragCoord.xy / u_resolution.xy;
vec2 dir = uv - center;
vec2 scaledDir = dir / u_expansionFactor; // Scale inward to sample outward
vec2 sampleUV = scaledDir + center;
vec4 history = texture2D(u_history, sampleUV);
gl_FragColor = history;
```

**Edge Handling:**
- Use `CLAMP_TO_EDGE` for texture wrapping
- Pixels expanding beyond edge will sample edge color (black/transparent)

### Alpha/Transparency

**Options:**
1. **No fade**: Shapes expand until out of frame (simpler)
2. **Fade with distance**: Alpha decreases as shapes expand (more complex)
3. **Fade with time**: Alpha decreases over time (requires time tracking)

**Recommendation: Start with Option 1** - let shapes expand naturally

### Performance Considerations

- **Texture Resolution**: Match canvas resolution (1:1)
- **Texture Format**: RGBA8 (standard)
- **Blending**: Use additive or alpha blending for combining shapes
- **Frame Rate**: Should maintain 60fps with dilation + shape rendering

## Implementation Steps

1. **Setup FBOs**: Create `historyTexture` and `currentTexture` with framebuffers
2. **Create Dilation Shader**: Shader that samples and scales history texture
3. **Modify Main Render Loop**:
   - Check timing for shape generation (every 0.5s)
   - Render dilation pass
   - Render current shape (if time to capture)
   - Display result
   - Copy to history
4. **Initialize**: Clear history texture to transparent/black on startup

## Shader Structure

**Dilation Shader (fragment):**
- Samples history texture with scaled UV
- Outputs dilated version

**Shape Shader (existing):**
- Draws star shape
- Can be rendered additively on top of dilated history

## JavaScript Timing

```javascript
let lastCaptureTime = 0;
const CAPTURE_INTERVAL = 0.5; // seconds

function render() {
    const currentTime = (Date.now() - startTime) / 1000.0;
    
    // Check if it's time to capture
    const shouldCapture = (currentTime - lastCaptureTime) >= CAPTURE_INTERVAL;
    if (shouldCapture) {
        lastCaptureTime = currentTime;
    }
    
    // Render dilation + shape
    // ...
}
```

## Edge Cases

- **First frame**: History is empty/black, only current shape visible
- **Shape parameters change**: New shapes use new parameters, old shapes keep old parameters
- **Window resize**: Recreate textures at new resolution
- **Performance**: If too slow, reduce expansion factor or use lower resolution textures

