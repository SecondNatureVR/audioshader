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

// Enhanced visual semantics:
// - Band energy drives structure shape and color (makes each track unique)
// - Coherence controls clarity and stability
// - Mud blurs and collapses structure
// - Harshness adds noise and jagged edges
// - Compression flattens contrast
// - Collision creates spikes and shockwaves
// - Visuals are more exaggerated and informative

// Noise function
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

// Enhanced coherence field - band energy drives structure
float coherenceField(vec2 uv) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    float angle = atan(dir.y, dir.x);
    
    // Base radial structure - frequency bands create distinct patterns
    // Low energy creates inner rings, mid creates middle structure, high creates outer detail
    float lowPattern = sin(dist * (6.0 + u_bandEnergy.x * 4.0) - angle * 2.0) * 0.5 + 0.5;
    float midPattern = sin(angle * (4.0 + u_bandEnergy.y * 4.0) + dist * 8.0) * 0.5 + 0.5;
    float highPattern = sin(dist * 12.0 + angle * (6.0 + u_bandEnergy.z * 6.0)) * 0.5 + 0.5;
    
    // Combine patterns weighted by band energy (makes each track unique!)
    float structure = 
        lowPattern * u_bandEnergy.x * 0.4 +
        midPattern * u_bandEnergy.y * 0.4 +
        highPattern * u_bandEnergy.z * 0.2;
    
    // Normalize based on total energy
    float totalEnergy = u_bandEnergy.x + u_bandEnergy.y + u_bandEnergy.z;
    if (totalEnergy > 0.1) {
        structure /= totalEnergy;
    } else {
        structure = 0.5; // Default when no energy
    }
    
    // Coherence sharpens the structure
    float sharpness = mix(0.2, 1.5, u_coherence);
    structure = pow(structure, 1.0 / (sharpness + 0.1));
    
    // Ensure visibility
    structure = structure * 0.9 + 0.1;
    
    return structure;
}

// Apply mud: blur and collapse (more exaggerated)
float applyMud(float value, vec2 uv) {
    float blurAmount = u_mud * 0.05; // Increased blur
    float blurred = 0.0;
    float samples = 9.0;
    
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            vec2 offset = vec2(x, y) * blurAmount;
            blurred += coherenceField(uv + offset);
        }
    }
    blurred /= samples;
    
    // Stronger collapse effect
    return mix(value, blurred, u_mud * 0.9);
}

// Apply harshness: noise and jagged edges (more visible)
float applyHarshness(float value, vec2 uv) {
    // More prominent noise
    float fineNoise = noise(uv * 80.0 + u_time * 3.0) * u_harshness * 0.4;
    
    // Stronger jagged distortion
    vec2 jagged = vec2(
        noise(uv * 40.0 + vec2(u_time * 2.0, 0.0)),
        noise(uv * 40.0 + vec2(0.0, u_time * 2.0))
    ) * u_harshness * 0.03;
    
    float distorted = coherenceField(uv + jagged);
    
    return mix(value, distorted, u_harshness * 0.6) + fineNoise;
}

// Apply compression: flatten contrast
float applyCompression(float value) {
    return mix(value, 0.5, u_compression * 0.7);
}

// Apply collision: spikes and shockwaves (more dramatic)
float applyCollision(float value, vec2 uv) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    float angle = atan(dir.y, dir.x);
    
    // More dramatic spikes
    float spikes = sin(angle * 12.0 + dist * 25.0) * u_collision;
    spikes = abs(spikes);
    spikes = pow(spikes, 0.2);
    
    // Stronger shockwaves
    float shockwave = sin(dist * 20.0 - u_time * 5.0) * u_collision;
    shockwave = abs(shockwave);
    shockwave = pow(shockwave, 0.4);
    
    return value + spikes * 0.5 + shockwave * 0.3;
}

// Apply phase risk: interference patterns
float applyPhaseRisk(float value, vec2 uv) {
    vec2 center = vec2(0.5);
    float dist1 = length(uv - center);
    float dist2 = length(uv - (center + vec2(0.15, 0.15)));
    
    float interference = sin(dist1 * 12.0) * sin(dist2 * 12.0);
    interference *= u_phaseRisk;
    
    float flicker = sin(u_time * 12.0) * 0.5 + 0.5;
    float nulls = step(0.7, flicker) * u_phaseRisk;
    
    return value * (1.0 - interference * 0.4 - nulls * 0.3);
}

void main() {
    // Normalize coordinates maintaining aspect ratio
    float aspect = u_resolution.x / u_resolution.y;
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    uv.x /= aspect;
    uv = uv + 0.5;
    
    // Base coherence field (band energy drives structure)
    float field = coherenceField(uv);
    
    // Apply diagnostic transformations
    field = applyMud(field, uv);
    field = applyHarshness(field, uv);
    field = applyCompression(field);
    field = applyCollision(field, uv);
    field = applyPhaseRisk(field, uv);
    
    // Time-based motion (more responsive to audio)
    float motionScale = 1.0 - u_compression * 0.7;
    float timeMod = u_time * (0.3 + u_audioAmp * 0.4) * motionScale;
    field += sin(field * 3.14159 + timeMod) * 0.15 * (1.0 - u_compression) * u_audioAmp;
    
    // Audio amplitude modulates intensity
    field *= 0.6 + u_audioAmp * 0.4;
    
    // Enhanced color mapping - band energy creates distinct color palettes per track
    // Low = warm (red/orange), Mid = neutral (yellow/green), High = cool (cyan/blue)
    vec3 color = vec3(0.0);
    
    // Low band creates warm base
    color.r += field * (0.3 + u_bandEnergy.x * 0.7);
    color.g += field * (0.2 + u_bandEnergy.x * 0.3);
    
    // Mid band adds yellow/green
    color.g += field * u_bandEnergy.y * 0.6;
    color.b += field * u_bandEnergy.y * 0.2;
    
    // High band adds cyan/blue
    color.g += field * u_bandEnergy.z * 0.3;
    color.b += field * (0.2 + u_bandEnergy.z * 0.8);
    
    // Normalize color intensity
    float colorIntensity = length(color);
    if (colorIntensity > 0.0) {
        color = normalize(color) * (field * 0.8 + 0.2);
    } else {
        color = vec3(field * 0.5);
    }
    
    // Compression desaturates
    color = mix(color, vec3(field), u_compression * 0.5);
    
    // Emptiness creates dark voids
    color *= 1.0 - u_emptiness * 0.5;
    
    // Low imbalance darkens
    if (u_lowImbalance > 0.5) {
        color.rgb *= mix(1.0, 0.6, (u_lowImbalance - 0.5) * 2.0);
    }
    
    // Harshness adds color noise
    if (u_harshness > 0.3) {
        vec3 noiseColor = vec3(
            noise(uv * 100.0 + vec2(u_time, 0.0)),
            noise(uv * 100.0 + vec2(0.0, u_time)),
            noise(uv * 100.0 + vec2(u_time, u_time))
        ) * u_harshness * 0.2;
        color += noiseColor;
    }
    
    // Ensure valid range
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
}
