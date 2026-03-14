#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_input;
uniform vec2 u_resolution;
uniform float u_kaleidoscopeSections; // 0=off, 2+=number of radial slices
uniform float u_tunnelStrength;       // 0=off, >0 perspective tunnel (edge=horizon)
varying vec2 v_uv;

// Inverse perspective tunnel: r_logic = r_screen / (1 + k * r_screen)
// Forward: r_screen = r_logic / (1 - k * r_logic) -> edge stretches to infinity
// Use pixel-space radius so distortion is circular in the image (fixes peanut/aspect pinch)
vec2 inverseTunnelUV(vec2 uv) {
    if (u_tunnelStrength < 0.001) return uv;
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    vec2 dirPixel = dir * u_resolution.xy;
    float r = length(dirPixel);
    if (r < 0.001) return uv;
    float k = u_tunnelStrength;
    float logicalR = r / (1.0 + k * r);
    vec2 logicalDirPixel = dirPixel * (logicalR / r);
    return center + logicalDirPixel / u_resolution.xy;
}

void main() {
    vec2 uv = v_uv;
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;

    // --- Tunnel: perspective warp (sample from inverse) ---
    uv = inverseTunnelUV(uv);
    dir = uv - center;

    // --- Kaleidoscope: fold angle into N radial slices using mod ---
    // Use pixel-space coordinates so the fold is circular in the image (preserves aspect)
    if (u_kaleidoscopeSections >= 2.0) {
        vec2 dirPixel = dir * u_resolution; // direction in pixel space
        float r = length(dirPixel);         // radius in pixels (circular in image)
        float angle = atan(dirPixel.y, dirPixel.x); // -PI to PI, aspect-correct
        float twoPi = 6.28318530718;
        float sectorAngle = twoPi / u_kaleidoscopeSections;
        float angleNorm = angle + 3.14159265; // 0 to 2*PI
        float sector = floor(angleNorm / sectorAngle);
        float angleInSector = mod(angleNorm, sectorAngle);
        // Mirror every other sector for symmetric kaleidoscope
        if (mod(sector, 2.0) >= 0.5) {
            angleInSector = sectorAngle - angleInSector;
        }
        angleInSector = angleInSector - sectorAngle * 0.5; // Center first sector
        vec2 foldedDirPixel = vec2(cos(angleInSector), sin(angleInSector)) * r;
        vec2 foldedDir = foldedDirPixel / u_resolution; // back to UV space
        uv = center + foldedDir;
    }

    // Sample with clamp to handle out-of-bounds from distortion
    vec2 clampedUV = clamp(uv, vec2(0.0), vec2(1.0));
    gl_FragColor = texture2D(u_input, clampedUV);
}
