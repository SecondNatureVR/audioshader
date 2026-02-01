#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_history;
uniform vec2 u_resolution;
uniform float u_expansionFactor;
uniform float u_fadeAmount;
uniform float u_hueShiftAmount;
varying vec2 v_uv;

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Convert RGB to HSV
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

void main() {
    vec2 uv = v_uv;
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    vec2 scaledDir = dir / u_expansionFactor; // Scale inward to sample outward
    vec2 sampleUV = scaledDir + center;
    
    vec4 history = texture2D(u_history, sampleUV);
    
    // Fade based on expansion (further from center = more faded)
    float distFromCenter = length(dir);
    float fadeAmount = smoothstep(0.0, 0.8, distFromCenter); // Fade as it expands
    float fade = 1.0 - fadeAmount * u_fadeAmount; // Use parameterized fade amount
    
    // Hue shift based on expansion
    float hueShift = distFromCenter * u_hueShiftAmount; // Use parameterized hue shift
    
    // Convert RGB to HSV, shift hue, convert back
    vec3 hsv = rgb2hsv(history.rgb);
    hsv.x = fract(hsv.x + hueShift); // Shift hue (wrap around)
    hsv.z *= fade; // Apply fade to value
    vec3 shiftedColor = hsv2rgb(hsv);
    
    gl_FragColor = vec4(shiftedColor, history.a * fade);
}


