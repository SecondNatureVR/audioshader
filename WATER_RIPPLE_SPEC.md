# Water Ripple Visualization Specification

## Visual Metaphor
The canvas represents a field of water. Each audio frame creates a "drop" at the center, generating ripples that expand outward. Previous ripples persist and recede to the edges, pushed away by new ones.

## Core Concept

### Current Frame (The Drop)
- **Position**: Center of screen (0.5, 0.5)
- **Shape**: Circular base, but distorted by metrics:
  - **Amplitude** → Size (radius)
  - **Coherence** → Edge sharpness (sharp = coherent, blurry = incoherent)
  - **Mud** → Blurs the drop
  - **Harshness** → Jagged, irregular edge
  - **Compression** → Flattens the drop (less 3D effect)
  - **Collision** → Creates spikes/angular distortions
  - **Phase Risk** → Creates interference patterns in the drop
- **Color**: 
  - **Band Energy** → RGB mapping (low=warm, mid=neutral, high=cool)
  - **Diagnostic issues** → Color shifts (mud=brown, harshness=white noise, etc.)
- **Intensity**: Audio amplitude controls brightness/opacity

### Ripple Propagation
- Each frame creates a new ripple ring
- Ripples expand outward from center
- **Expansion speed**: Constant or audio-responsive
- **Fade**: Ripples fade as they age (opacity decreases)
- **Persistence**: How many ripples are visible (time-based)
- **Pushing effect**: New ripples visually push old ones outward

## Technical Implementation

### Approach 1: Time-Based Rings (Recommended)
- Store ring properties per frame:
  - `ringRadius = (currentTime - ringBirthTime) * expansionSpeed`
  - `ringOpacity = fadeFunction(ringAge)`
  - `ringColor = colorAtBirthTime`
  - `ringDistortion = metricsAtBirthTime`
- Render all active rings in fragment shader
- Rings older than threshold are discarded

### Approach 2: History Texture
- Render current drop to texture
- Each frame, sample previous texture with expanded UV coordinates
- Blend current + expanded history
- More efficient but less control

### Approach 3: Particle System
- Each frame spawns particles in a ring
- Particles expand outward
- More complex, more flexible

## Shader Structure

### Fragment Shader Logic
```glsl
void main() {
    vec2 uv = normalized coordinates;
    vec2 center = vec2(0.5);
    float distFromCenter = length(uv - center);
    
    // Current drop (frame 0)
    float currentDrop = calculateDrop(uv, currentMetrics);
    
    // Previous ripples (frames 1, 2, 3...)
    float ripple1 = calculateRipple(uv, distFromCenter, time - 1/fps, metrics1);
    float ripple2 = calculateRipple(uv, distFromCenter, time - 2/fps, metrics2);
    // ... etc
    
    // Combine all ripples
    vec3 color = currentDrop + ripple1 + ripple2 + ...;
}
```

### Drop Calculation
```glsl
float calculateDrop(vec2 uv, vec2 center, float amplitude, float coherence) {
    float dist = length(uv - center);
    float radius = amplitude * 0.3; // Base size
    
    // Circular shape with coherence-based sharpness
    float drop = 1.0 - smoothstep(radius - edgeWidth, radius + edgeWidth, dist);
    drop = pow(drop, 1.0 / (coherence + 0.1)); // Sharper when coherent
    
    return drop;
}
```

### Ripple Calculation
```glsl
float calculateRipple(vec2 uv, vec2 center, float age, float expansionSpeed) {
    float dist = length(uv - center);
    float expectedRadius = age * expansionSpeed;
    
    // Ring at expected radius
    float ringWidth = 0.02; // Thickness of ring
    float ripple = 1.0 - abs(dist - expectedRadius) / ringWidth;
    ripple = max(0.0, ripple);
    
    // Fade with age
    float fade = exp(-age * fadeRate);
    ripple *= fade;
    
    return ripple;
}
```

## Metrics Encoding

### In Drop Shape
- **Amplitude** → Drop radius
- **Coherence** → Edge sharpness (1.0 = sharp, 0.0 = very blurry)
- **Mud** → Blurs entire drop
- **Harshness** → Adds noise/jaggedness to edge
- **Compression** → Flattens drop (less 3D, more 2D)
- **Collision** → Creates angular spikes
- **Phase Risk** → Interference patterns

### In Drop Color
- **Band Energy** → Primary color (low=red/orange, mid=yellow/green, high=cyan/blue)
- **Mud** → Brownish tint
- **Harshness** → White highlights/noise
- **Compression** → Desaturates
- **Collision** → Bright flashes

### In Ripple Properties
- Each ripple carries the properties of the frame that created it
- Ripples expand but maintain their original color/shape characteristics
- Older ripples fade uniformly

## Parameters to Tune
- **Expansion speed**: How fast ripples move outward
- **Ring thickness**: How thick each ripple ring is
- **Fade rate**: How quickly ripples disappear
- **Max ripples**: How many previous frames to show
- **Drop size range**: Min/max drop radius based on amplitude

## Visual Result
- Center: Current audio as a drop (bright, full color, sharp when coherent)
- Expanding outward: History of previous frames as ripples
- Edges: Oldest ripples, faded, pushed to edges
- Overall: Like dropping stones in water, each representing a moment in the audio

