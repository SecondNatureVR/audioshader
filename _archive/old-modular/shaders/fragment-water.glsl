#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2  u_resolution;

// Current frame metrics
uniform float u_coherence;
uniform float u_mud;
uniform float u_phaseRisk;
uniform float u_compression;
uniform float u_harshness;
uniform float u_lowImbalance;
uniform float u_emptiness;
uniform float u_collision;
uniform float u_audioAmp;
uniform vec3  u_bandEnergy;

// Ripple history (arrays for last N frames)
uniform int u_rippleCount; // How many historical ripples to render
uniform float u_rippleTimes[20]; // Time when each ripple was created
uniform float u_rippleAmps[20]; // Amplitude at creation
uniform vec3 u_rippleBandEnergy[20]; // Band energy at creation
uniform float u_rippleCoherence[20]; // Coherence at creation
uniform float u_rippleMud[20];
uniform float u_rippleHarshness[20];
uniform float u_rippleCompression[20];
uniform float u_rippleCollision[20];
uniform float u_ripplePhaseRisk[20];

// Parameters
// Expansion speed: from center (0.5) to edge (~0.5 distance) in 30 seconds = 0.5/30 = 0.0167 units/sec
const float EXPANSION_SPEED = 0.0167; // How fast ripples expand (normalized units per second) - slow oozing speed
const float RING_THICKNESS = 0.04; // Thickness of each ripple ring - thicker for visibility
const float FADE_RATE = 0.08; // How quickly ripples fade (exponential decay) - much slower fade to match slow expansion
const float MAX_RIPPLE_AGE = 35.0; // Maximum age before ripple disappears (seconds) - longer to match slow expansion

// Noise function for distortions
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

// Calculate drop at center (current frame)
float calculateDrop(vec2 uv, vec2 center, float amplitude, float coherence, float mud, float harshness, float compression, float collision, float phaseRisk) {
    float dist = length(uv - center);
    
    // Base drop size from amplitude
    float baseRadius = 0.05 + amplitude * 0.15;
    
    // Coherence affects edge sharpness
    float edgeWidth = mix(0.02, 0.005, coherence);
    float drop = 1.0 - smoothstep(baseRadius - edgeWidth, baseRadius + edgeWidth, dist);
    
    // Sharpen based on coherence
    float sharpness = mix(0.3, 2.0, coherence);
    drop = pow(drop, 1.0 / (sharpness + 0.1));
    
    // Mud blurs the drop
    if (mud > 0.1) {
        float blurAmount = mud * 0.03;
        float blurred = 0.0;
        float samples = 0.0;
        for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
                vec2 offset = vec2(x, y) * blurAmount;
                float d = length(uv + offset - center);
                blurred += 1.0 - smoothstep(baseRadius - edgeWidth, baseRadius + edgeWidth, d);
                samples += 1.0;
            }
        }
        blurred /= samples;
        blurred = pow(blurred, 1.0 / (sharpness + 0.1));
        drop = mix(drop, blurred, mud * 0.7);
    }
    
    // Harshness adds jagged edge
    if (harshness > 0.1) {
        float angle = atan(uv.y - center.y, uv.x - center.x);
        float jagged = noise(vec2(angle * 10.0, dist * 20.0)) * harshness * 0.1;
        dist += jagged;
        float jaggedDrop = 1.0 - smoothstep(baseRadius - edgeWidth, baseRadius + edgeWidth, dist);
        jaggedDrop = pow(jaggedDrop, 1.0 / (sharpness + 0.1));
        drop = mix(drop, jaggedDrop, harshness * 0.5);
    }
    
    // Collision creates spikes
    if (collision > 0.1) {
        float angle = atan(uv.y - center.y, uv.x - center.x);
        float spikes = sin(angle * 8.0 + dist * 30.0) * collision;
        spikes = abs(spikes);
        spikes = pow(spikes, 0.3);
        drop += spikes * 0.3;
    }
    
    // Phase risk creates interference
    if (phaseRisk > 0.1) {
        float interference = sin(dist * 15.0) * sin(dist * 12.0 + 1.0) * phaseRisk;
        drop *= 1.0 - interference * 0.3;
    }
    
    // Compression flattens
    drop = mix(drop, 0.5, compression * 0.4);
    
    return clamp(drop, 0.0, 1.0);
}

// Calculate ripple as scaled version of original drop
float calculateRipple(vec2 uv, vec2 center, float age, float amplitude, float coherence, float mud, float harshness, float compression, float collision, float phaseRisk) {
    // Calculate expansion scale factor based on age
    // Original drop is at scale 1.0, expands outward
    float expansionScale = 1.0 + (age * EXPANSION_SPEED) / 0.05; // Scale factor (0.05 is base drop radius)
    
    // Scale UV coordinates inward to sample the original drop shape
    // This makes the drop appear larger as it expands
    vec2 scaledUV = (uv - center) / expansionScale + center;
    
    // Clamp to avoid sampling outside valid range
    scaledUV = clamp(scaledUV, 0.0, 1.0);
    
    // Calculate the original drop shape at the scaled position
    float ripple = calculateDrop(
        scaledUV, center,
        amplitude,
        coherence,
        mud,
        harshness,
        compression,
        collision,
        phaseRisk
    );
    
    // Fade with age (exponential decay) - but keep it visible longer
    float fade = exp(-age * FADE_RATE);
    // Boost minimum visibility
    fade = max(fade, 0.15); // Keep at least 15% visible
    ripple *= fade;
    
    // Compression reduces ripple intensity
    ripple *= 1.0 - compression * 0.3;
    
    return clamp(ripple, 0.0, 1.0);
}

// Calculate color from band energy and metrics
vec3 calculateColor(float intensity, vec3 bandEnergy, float mud, float harshness, float compression, float collision) {
    vec3 color = vec3(0.0);
    
    // Band energy creates vibrant color palette
    // Low = warm (red/orange), Mid = neutral (yellow/green), High = cool (cyan/blue)
    // Increased saturation and intensity
    color.r += intensity * (0.6 + bandEnergy.x * 1.2); // More red
    color.g += intensity * (0.3 + bandEnergy.x * 0.5 + bandEnergy.y * 0.9); // More green/yellow
    color.b += intensity * (0.2 + bandEnergy.y * 0.4 + bandEnergy.z * 1.3); // More blue
    
    // Boost saturation - make colors more vibrant
    float maxChannel = max(max(color.r, color.g), color.b);
    if (maxChannel > 0.001) {
        // Increase saturation by boosting the dominant channels
        color = mix(color, color * 1.5, 0.4); // 40% boost to saturation
    }
    
    // Mud adds brownish tint (less muted)
    if (mud > 0.1) {
        color = mix(color, vec3(0.8, 0.5, 0.3), mud * 0.2); // Less mud effect
    }
    
    // Harshness adds bright white highlights
    if (harshness > 0.1) {
        color += vec3(harshness * 0.4); // Brighter highlights
    }
    
    // Compression desaturates (less aggressive)
    if (compression > 0.1) {
        float gray = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(color, vec3(gray), compression * 0.25); // Less desaturation
    }
    
    // Collision adds bright flashes
    if (collision > 0.1) {
        color += vec3(collision * 0.5); // Brighter flashes
    }
    
    return clamp(color, 0.0, 2.0); // Allow brighter colors (will clamp in final output)
}

void main() {
    // Normalize coordinates maintaining aspect ratio
    float aspect = u_resolution.x / u_resolution.y;
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    uv.x /= aspect;
    uv = uv + 0.5;
    
    vec2 center = vec2(0.5);
    
    // Calculate current drop (frame 0)
    float currentDrop = calculateDrop(
        uv, center, 
        u_audioAmp, 
        u_coherence, 
        u_mud, 
        u_harshness, 
        u_compression, 
        u_collision, 
        u_phaseRisk
    );
    
    // Calculate color for current drop
    vec3 dropColor = calculateColor(
        currentDrop,
        u_bandEnergy,
        u_mud,
        u_harshness,
        u_compression,
        u_collision
    );
    
    // Accumulate ripple colors - each ripple contributes its own color based on its original properties
    vec3 totalRippleColor = vec3(0.0);
    float totalRippleIntensity = 0.0;
    
    // Process all historical ripples in a single loop
    for (int i = 0; i < 20; i++) {
        if (i >= u_rippleCount) break;
        
        float rippleTime = u_rippleTimes[i];
        float age = u_time - rippleTime;
        
        // Skip if too old or invalid
        if (age > MAX_RIPPLE_AGE || age < 0.0 || rippleTime <= 0.0) continue;
        
        // Calculate ripple intensity at this position
        float ripple = calculateRipple(
            uv, center, age,
            u_rippleAmps[i],
            u_rippleCoherence[i],
            u_rippleMud[i],
            u_rippleHarshness[i],
            u_rippleCompression[i],
            u_rippleCollision[i],
            u_ripplePhaseRisk[i]
        );
        
        if (ripple > 0.01) {
            // Calculate color for this specific ripple using its original properties
            vec3 rippleColor = calculateColor(
                1.0, // Full intensity for color calculation (ripple strength handled separately)
                u_rippleBandEnergy[i],
                u_rippleMud[i],
                u_rippleHarshness[i],
                u_rippleCompression[i],
                u_rippleCollision[i]
            );
            
            // Add this ripple's color contribution weighted by its intensity
            totalRippleColor += rippleColor * ripple;
            totalRippleIntensity += ripple;
        }
    }
    
    // Combine drop and ripples - ripples should be visible and colorful
    vec3 finalColor = dropColor * currentDrop * 1.2; // Boost drop brightness
    
    // Add ripple colors directly (they're already weighted by intensity)
    if (totalRippleIntensity > 0.001) {
        // Use the accumulated color directly, making it more prominent and vibrant
        finalColor += totalRippleColor * 2.5; // Boost ripple visibility and saturation
    }
    
    // Emptiness darkens
    finalColor *= 1.0 - u_emptiness * 0.5;
    
    // Low imbalance darkens
    if (u_lowImbalance > 0.5) {
        finalColor *= mix(1.0, 0.7, (u_lowImbalance - 0.5) * 2.0);
    }
    
    finalColor = clamp(finalColor, 0.0, 1.0);
    
    gl_FragColor = vec4(finalColor, 1.0);
}

