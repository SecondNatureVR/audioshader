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

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    // Normalize coordinates
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 center = vec2(0.5);

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

    // Draw the outline - this is the primary shape definition
    float lineWidth = 0.012;
    float outline = smoothstep(lineWidth, 0.0, abs(dist - r));

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

    // Convert hue to RGB (hue in degrees, saturation=1.0, value=1.0)
    // Add slow automatic hue shift over time (full cycle every 30 seconds)
    float autoHueShift = u_time * 12.0; // 360 degrees / 30 seconds = 12 deg/sec
    float finalHue = mod(u_hue + autoHueShift, 360.0);
    vec3 hsv = vec3(finalHue / 360.0, 1.0, 1.0);
    vec3 color = hsv2rgb(hsv) * shape;

    // Apply opacity for blend control
    gl_FragColor = vec4(color, u_blendOpacity);
}
