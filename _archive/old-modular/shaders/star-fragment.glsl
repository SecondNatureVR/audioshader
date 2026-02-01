#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_spikes;
uniform float u_hue;
uniform float u_scale;
uniform float u_rotation;

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
    
    // Rotate coordinates
    float rotationRad = u_rotation * 3.14159 / 180.0;
    float cosRot = cos(rotationRad);
    float sinRot = sin(rotationRad);
    vec2 rotatedP = vec2(
        p.x * cosRot - p.y * sinRot,
        p.x * sinRot + p.y * cosRot
    );
    
    // Draw a star
    float angle = atan(rotatedP.y, rotatedP.x);
    float dist = length(rotatedP);
    
    // Star shape with configurable number of spikes
    float numSpikes = floor(u_spikes);
    
    // Calculate star radius pattern (varies with angle to create spikes)
    // Base radius scales with u_scale, then adds spikes
    float baseRadius = u_scale * 0.4;
    float spikeAmount = u_scale * 0.25;
    float r = baseRadius + spikeAmount * cos(angle * numSpikes);
    
    // Draw the star - use a smooth falloff
    float lineWidth = 0.012;
    float star = smoothstep(lineWidth, 0.0, abs(dist - r));
    
    // Fill the star interior for better visibility
    float innerRadius = r * 0.65;
    if (dist < innerRadius) {
        star = max(star, 0.6);
    }
    
    // Make it brighter
    star = min(star, 1.0);
    
    // Convert hue to RGB (hue in degrees, saturation=1.0, value=1.0)
    vec3 hsv = vec3(u_hue / 360.0, 1.0, 1.0);
    vec3 color = hsv2rgb(hsv) * star;
    
    gl_FragColor = vec4(color, 1.0);
}

