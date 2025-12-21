#ifdef GL_ES
precision mediump float;
#endif

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

uniform float u_audioAmp;
uniform vec3  u_bandEnergy; // low/mid/high

// Visual semantics implementation:
// - High coherence → sharp, stable structure
// - High mud → blur / collapsed contours
// - High harshness → fine noise / jagged edges / flicker
// - High compression → flattened contrast, reduced motion amplitude
// - High collision → sharp angular spikes or shockwave artifacts
// - High phaseRisk → interference patterns, flickering nulls
// - bandEnergy modulates color/intensity by frequency band

// Noise function for harshness and phase interference
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Coherence field structure - radial pattern with angular variation
float coherenceField(vec2 uv) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    float angle = atan(dir.y, dir.x);
    
    // Base structure: radial waves with angular modulation
    // High coherence = sharp, well-defined structure
    float structure = sin(dist * 8.0 - angle * 3.0) * 0.5 + 0.5;
    
    // Add angular bands for frequency separation
    structure += sin(angle * 6.0 + dist * 4.0) * 0.3;
    
    // Coherence controls structure sharpness
    float sharpness = mix(0.3, 1.0, u_coherence);
    structure = pow(structure, 1.0 / (sharpness + 0.1));
    
    return structure;
}

// Apply mud: blur and collapse contours
float applyMud(float value, vec2 uv) {
    // Blur effect: sample multiple points and average
    float blurAmount = u_mud * 0.02;
    float blurred = 0.0;
    float samples = 9.0;
    
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            vec2 offset = vec2(x, y) * blurAmount;
            blurred += coherenceField(uv + offset);
        }
    }
    blurred /= samples;
    
    // Collapse: reduce contrast when mud is high
    return mix(value, blurred, u_mud * 0.7);
}

// Apply harshness: fine noise and jagged edges
float applyHarshness(float value, vec2 uv) {
    // Fine noise pattern
    float fineNoise = noise(uv * 50.0 + u_time * 2.0) * u_harshness;
    
    // Jagged edges: add high-frequency distortion
    vec2 jagged = vec2(
        noise(uv * 30.0 + vec2(u_time, 0.0)),
        noise(uv * 30.0 + vec2(0.0, u_time))
    ) * u_harshness * 0.01;
    
    float distorted = coherenceField(uv + jagged);
    
    // Mix in noise and distortion
    return mix(value, distorted, u_harshness * 0.4) + fineNoise * 0.2;
}

// Apply compression: flatten contrast and reduce motion
float applyCompression(float value) {
    // Flatten contrast: compress dynamic range
    float compressed = mix(value, 0.5, u_compression * 0.5);
    
    // Reduce motion amplitude (handled in time modulation)
    return compressed;
}

// Apply collision: sharp spikes and shockwave artifacts
float applyCollision(float value, vec2 uv) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    
    // Sharp angular spikes
    float angle = atan(dir.y, dir.x);
    float spikes = sin(angle * 8.0 + dist * 20.0) * u_collision;
    spikes = abs(spikes);
    spikes = pow(spikes, 0.3); // Make them sharp
    
    // Shockwave artifacts: radial pulses
    float shockwave = sin(dist * 15.0 - u_time * 3.0) * u_collision;
    shockwave = abs(shockwave);
    shockwave = pow(shockwave, 0.5);
    
    return value + spikes * 0.3 + shockwave * 0.2;
}

// Apply phase risk: interference patterns and flickering nulls
float applyPhaseRisk(float value, vec2 uv) {
    // Interference pattern: wave interference
    vec2 center = vec2(0.5);
    float dist1 = length(uv - center);
    float dist2 = length(uv - (center + vec2(0.1, 0.1)));
    
    float interference = sin(dist1 * 10.0) * sin(dist2 * 10.0);
    interference *= u_phaseRisk;
    
    // Flickering nulls: time-based cancellation
    float flicker = sin(u_time * 10.0) * 0.5 + 0.5;
    float nulls = step(0.7, flicker) * u_phaseRisk;
    
    return value * (1.0 - interference * 0.3 - nulls * 0.2);
}

void main() {
    // Normalize coordinates to [0, 1] with aspect ratio correction
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;
    uv.x -= (aspect - 1.0) * 0.5;
    
    // Base coherence field structure
    float field = coherenceField(uv);
    
    // Apply diagnostic transformations in order
    field = applyMud(field, uv);
    field = applyHarshness(field, uv);
    field = applyCompression(field);
    field = applyCollision(field, uv);
    field = applyPhaseRisk(field, uv);
    
    // Time-based motion (reduced by compression)
    float motionScale = 1.0 - u_compression * 0.7;
    float timeMod = u_time * 0.5 * motionScale;
    field += sin(field * 3.14159 + timeMod) * 0.1 * (1.0 - u_compression);
    
    // Audio amplitude modulates overall intensity (subtle)
    field *= 0.7 + u_audioAmp * 0.3;
    
    // Band energy color modulation
    // Low = red tint, Mid = green tint, High = blue tint
    vec3 color = vec3(
        field * (0.5 + u_bandEnergy.x * 0.5),  // Low band → red
        field * (0.5 + u_bandEnergy.y * 0.5),  // Mid band → green
        field * (0.5 + u_bandEnergy.z * 0.5)   // High band → blue
    );
    
    // Compression flattens color contrast too
    color = mix(color, vec3(field), u_compression * 0.3);
    
    // Emptiness: stable voids (dark regions that don't change)
    color *= 1.0 - u_emptiness * 0.4;
    
    // Low imbalance: heavy visual mass (darken low end)
    if (u_lowImbalance > 0.5) {
        color.rgb *= mix(1.0, 0.7, (u_lowImbalance - 0.5) * 2.0);
    }
    
    // Ensure values stay in valid range
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
}
