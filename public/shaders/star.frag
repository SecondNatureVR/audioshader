#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_spikiness;      // 0.0 = circle, 1.0 = maximum spikes
uniform float u_spikeFrequency; // Continuous number of spikes (2-20)
uniform float u_spikeSharpness; // 0.0 = rounded, 1.0 = sharp spikes
uniform float u_hue;
uniform float u_scale;
uniform float u_rotation;
uniform float u_autoRotationSpeed;
uniform float u_blendOpacity;
uniform float u_fillSize;       // 0.0 = no fill, 1.0 = fill to edge
uniform float u_fillOpacity;    // 0.0 = transparent, 1.0 = opaque
uniform float u_strokeWeight;   // outline thickness
uniform float u_strokeOpacity;  // stroke alpha 0-1
uniform float u_strokeGlow;     // soft glow size beyond stroke (0=off)
uniform float u_fishbowlShape;   // >0 convex/barrel, <0 concave/pincushion, 0=off
uniform float u_radialPowerShape; // <1 expand center, >1 expand periphery, 1=off
// Palette: gamut (when dominantCount=0) and dominant colors
uniform float u_hueMin;
uniform float u_hueMax;
uniform float u_saturation;
uniform float u_value;
uniform vec3 u_color0;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;
uniform float u_dominantCount;   // 0=use gamut, 1-5=use dominant colors

// Radial power: screen_r = logical_r^power. Inverse: logical_r = screen_r^(1/power)
// Use pixel-space radius so distortion is circular in the image (fixes peanut/aspect pinch)
vec2 inverseRadialPower(vec2 screenUV) {
    if (abs(u_radialPowerShape - 1.0) < 0.001) return screenUV;
    vec2 center = vec2(0.5);
    vec2 dir = screenUV - center;
    vec2 dirPixel = dir * u_resolution.xy;
    float r = length(dirPixel);
    if (r < 0.001) return screenUV;
    float invPower = 1.0 / u_radialPowerShape;
    float logicalR = pow(r, invPower);
    vec2 logicalDirPixel = dirPixel * (logicalR / r);
    return center + logicalDirPixel / u_resolution.xy;
}

// Inverse distortion: screen_uv -> logical_uv (evaluate shape in logical space for full resolution)
// Use pixel-space radius so distortion is circular in the image (fixes peanut/aspect pinch)
vec2 inverseFishbowl(vec2 screenUV) {
    if (abs(u_fishbowlShape) < 0.001) return screenUV;
    vec2 center = vec2(0.5);
    vec2 dir = screenUV - center;
    vec2 dirPixel = dir * u_resolution.xy;
    float rPixel = length(dirPixel);
    if (rPixel < 0.001) return screenUV;
    float halfDiag = 0.5 * length(u_resolution.xy);
    float r = rPixel / halfDiag;
    float k = u_fishbowlShape * 2.0;
    float logicalR = max(0.0, r * (1.0 - k * r * r));
    float logicalRPixel = logicalR * halfDiag;
    vec2 logicalDirPixel = dirPixel * (logicalRPixel / rPixel);
    return center + logicalDirPixel / u_resolution.xy;
}

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    // Normalize coordinates (screen space)
    vec2 screenUV = gl_FragCoord.xy / u_resolution.xy;
    vec2 center = vec2(0.5);

    // Inverse distort: radial power (center/periphery zoom) then fishbowl (lens)
    vec2 uv = inverseFishbowl(inverseRadialPower(screenUV));

    // Convert to centered coordinates
    vec2 p = (uv - center) * vec2(u_resolution.x / u_resolution.y, 1.0);

    // Rotate coordinates (manual rotation + auto rotation)
    float autoRotation = -u_time * u_autoRotationSpeed; // Auto rotation in degrees (reversed direction)
    float totalRotation = u_rotation + autoRotation;
    float rotationRad = totalRotation * 3.14159 / 180.0;
    float cosRot = cos(rotationRad);
    float sinRot = sin(rotationRad);
    vec2 rotatedP = vec2(
        p.x * cosRot - p.y * sinRot,
        p.x * sinRot + p.y * cosRot
    );

    // Draw a morphing shape (circle to spikes)
    float angle = atan(rotatedP.y, rotatedP.x);
    float dist = length(rotatedP);

    // Base radius scales with u_scale
    float baseRadius = u_scale * 0.4;

    // Calculate shape modulation
    // Use continuous spike frequency (not discrete)
    float modulation = cos(angle * u_spikeFrequency);

    // Apply sharpness: sharper spikes use power function
    // When sharpness = 0: smooth cosine wave
    // When sharpness = 1: sharp peaks (using power function)
    float sharpModulation;
    if (u_spikeSharpness < 0.01) {
        // No sharpness: use smooth cosine
        sharpModulation = modulation;
    } else {
        // Apply power function to sharpen peaks
        // Higher sharpness = steeper peaks
        float power = 1.0 / (1.0 + u_spikeSharpness * 3.0); // Range: 1.0 to ~0.25
        sharpModulation = pow(abs(modulation), power) * sign(modulation);
    }

    // Apply spikiness: interpolate between circle (0) and spiked shape (1)
    float spikeAmount = u_scale * 0.25 * u_spikiness;
    float r = baseRadius + spikeAmount * sharpModulation;

    // Draw the outline - primary shape definition
    float strokeCore = smoothstep(u_strokeWeight, 0.0, abs(dist - r));
    // Glow: soft falloff extending beyond stroke edge
    float strokeGlowFalloff = 0.0;
    if (u_strokeGlow > 0.001) {
      strokeGlowFalloff = 1.0 - smoothstep(u_strokeWeight, u_strokeWeight + u_strokeGlow, abs(dist - r));
    }
    float outline = u_strokeOpacity * max(strokeCore, strokeGlowFalloff * 0.6);

    // Draw the fill separately - parameterized by size and opacity
    float fillRadius = r * u_fillSize; // Fill size: 0.0 = no fill, 1.0 = fill to edge
    float fill = 0.0;
    if (u_fillSize > 0.0 && dist < fillRadius) {
        // Smooth falloff for fill interior
        float fillFalloff = smoothstep(fillRadius, fillRadius * 0.8, dist);
        fill = fillFalloff * u_fillOpacity; // Apply fill opacity
    }

    // Combine outline and fill
    // Outline is always full brightness, fill adds to it with its opacity
    float shape = max(outline, fill);

    // Color: palette (gamut or dominant) or fallback to hue
    vec3 color;
    if (u_dominantCount > 0.5) {
        // Dominant colors: cycle by angle (0-2pi maps to colors 0..n-1)
        float n = u_dominantCount;
        float t = (angle + 3.14159) / 6.28318; // 0-1
        float idx = t * n;
        float i0 = floor(mod(idx, n));
        float i1 = mod(i0 + 1.0, n);
        float frac = fract(idx);
        vec3 c0 = i0 < 0.5 ? u_color0 : (i0 < 1.5 ? u_color1 : (i0 < 2.5 ? u_color2 : (i0 < 3.5 ? u_color3 : u_color4)));
        vec3 c1 = i1 < 0.5 ? u_color0 : (i1 < 1.5 ? u_color1 : (i1 < 2.5 ? u_color2 : (i1 < 3.5 ? u_color3 : u_color4)));
        color = mix(c0, c1, frac);
    } else {
        // Gamut: hue in range, saturation, value
        float autoHueShift = u_time * 12.0;
        float finalHue = mod(u_hue + autoHueShift, 360.0);
        float hueSpan = max(1.0, u_hueMax - u_hueMin);
        float hueInRange = u_hueMin + mod(finalHue - u_hueMin + 360.0, hueSpan);
        vec3 hsv = vec3(hueInRange / 360.0, u_saturation, u_value);
        color = hsv2rgb(hsv);
    }
    color *= shape;

    // Apply opacity for blend control
    gl_FragColor = vec4(color, u_blendOpacity);
}
