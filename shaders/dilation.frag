#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_history;
uniform vec2 u_resolution;
uniform float u_expansionFactor;
uniform float u_fadeAmount;
uniform float u_hueShiftAmount;
uniform float u_noiseAmount;
uniform float u_noiseRate;
uniform float u_blurAmount;
uniform float u_blurRate;
uniform float u_time;
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

    // Check if current pixel is at the center (within small radius)
    float distFromCenter = length(dir);
    float centerRadius = 0.002; // Very small radius around center (about 2 pixels at 1000px resolution)

    vec4 history;
    if (distFromCenter < centerRadius) {
        // At center: sample neighboring pixels and average them for display
        // Sample neighbors from positions OUTSIDE the center radius to avoid sampling black
        // Use a radius that's definitely outside centerRadius to get actual color values
        float neighborRadius = centerRadius * 2.5; // Sample from ring outside center
        vec4 neighborSum = vec4(0.0);
        float neighborCount = 0.0;

        // Sample neighbors in 8 directions from positions outside center
        for (float angle = 0.0; angle < 6.28318; angle += 0.785398) { // 8 directions (2*PI/8)
            vec2 neighborDir = vec2(cos(angle), sin(angle)) * neighborRadius;
            vec2 neighborUV = uv + neighborDir; // Sample from current UV, not scaled sampleUV
            vec4 neighbor = texture2D(u_history, neighborUV);
            
            // Only use neighbors that are outside the center region (to avoid black)
            float neighborDist = length(neighborUV - center);
            if (neighborDist > centerRadius) {
                neighborSum += neighbor;
                neighborCount += 1.0;
            }
        }

        // Use average of valid neighbors, or black if no valid neighbors
        history = neighborCount > 0.0 ? neighborSum / neighborCount : vec4(0.0, 0.0, 0.0, 0.0);
    } else {
        // Check if we're sampling from the center region (prevent center pixels from propagating outward)
        vec2 sampleDir = sampleUV - center;
        float sampleDistFromCenter = length(sampleDir);

        if (sampleDistFromCenter < centerRadius) {
            // If sampling from center, use black/transparent to prevent propagation
            // This prevents center pixels (even with averaged neighbors) from propagating outward
            history = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
            // Normal sampling
            history = texture2D(u_history, sampleUV);
        }
    }

    // Fade based on expansion (further from center = more faded)
    // distFromCenter already calculated above
    // Use logarithmic fade curve for smoother transitions
    // Map distance to fade using a power curve for more gradual fade
    float fadeAmount = smoothstep(0.0, 0.8, distFromCenter); // Fade as it expands
    // Apply logarithmic fade: fade = 1 - fadeAmount^fadePower
    // u_fadeAmount range: 0 to 5.0
    // Higher values create more gradual fades
    float fadePower = 1.0 + u_fadeAmount * 2.0; // Range: 1.0 to 11.0 when u_fadeAmount is 0 to 5
    float fade = 1.0 - pow(fadeAmount, fadePower);

    // Decay factor: reduce brightness over time to prevent accumulation
    // Estimate age based on distance (further = older = more decay)
    float ageEstimate = distFromCenter * 2.0; // Rough estimate of "age"
    float decayRate = 0.98; // Decay 2% per frame (adjustable)
    float decay = pow(decayRate, ageEstimate); // Exponential decay

    // Hue shift based on expansion
    float hueShift = distFromCenter * u_hueShiftAmount; // Use parameterized hue shift

    // Convert RGB to HSV, shift hue, convert back
    vec3 hsv = rgb2hsv(history.rgb);
    hsv.x = fract(hsv.x + hueShift); // Shift hue (wrap around)
    hsv.z *= fade * decay; // Apply both fade and decay to value
    vec3 shiftedColor = hsv2rgb(hsv);

    // Apply simple radial blur based on u_blurAmount (time-based application)
    if (u_blurAmount > 0.0 && u_blurRate > 0.0) {
        // Calculate interval: rate 1.0 = every 2 seconds, rate 0.5 = every 4 seconds, etc.
        float blurInterval = 2.0 / u_blurRate;
        // Apply blur during a small window (0.1 seconds) of each interval
        float blurWindow = 0.1;
        float blurPhase = mod(u_time, blurInterval);
        if (blurPhase < blurWindow) {
            float blurRadius = 1.5 * u_blurAmount / u_resolution.x;
            vec4 sum = vec4(shiftedColor, history.a);
            float count = 1.0;
            for (int i = 0; i < 6; i++) {
                float a = float(i) / 6.0 * 6.28318;
                vec2 offset = vec2(cos(a), sin(a)) * blurRadius;
                sum += texture2D(u_history, uv + offset);
                count += 1.0;
            }
            shiftedColor = (sum / count).rgb;
        }
    }

    // Apply animated noise based on u_noiseAmount and u_noiseRate (time-based application)
    if (u_noiseAmount > 0.0 && u_noiseRate > 0.0) {
        // Calculate interval: rate 1.0 = every 2 seconds, rate 0.5 = every 4 seconds, etc.
        float noiseInterval = 2.0 / u_noiseRate;
        // Apply noise during a small window (0.1 seconds) of each interval
        float noiseWindow = 0.1;
        float noisePhase = mod(u_time, noiseInterval);
        if (noisePhase < noiseWindow) {
            float t = u_time * 10.0; // Animation speed within the window
            float n = fract(sin(dot(uv * (t + 1.0), vec2(12.9898,78.233))) * 43758.5453);
            vec3 grain = mix(vec3(1.0), vec3(n), u_noiseAmount);
            shiftedColor *= grain;
        }
    }

    // Clamp to prevent overflow from additive blending
    shiftedColor = clamp(shiftedColor, 0.0, 1.0);

    gl_FragColor = vec4(shiftedColor, history.a * fade * decay);
}
