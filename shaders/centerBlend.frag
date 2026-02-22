#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_input;
uniform vec2 u_resolution;

varying vec2 v_uv;

void main() {
    // Sample 8 neighbors (1 pixel offset in each direction)
    vec2 px = vec2(1.0) / u_resolution;
    vec4 sum = vec4(0.0);
    sum += texture2D(u_input, v_uv + vec2(px.x, 0.0));
    sum += texture2D(u_input, v_uv + vec2(-px.x, 0.0));
    sum += texture2D(u_input, v_uv + vec2(0.0, px.y));
    sum += texture2D(u_input, v_uv + vec2(0.0, -px.y));
    sum += texture2D(u_input, v_uv + vec2(px.x, px.y));
    sum += texture2D(u_input, v_uv + vec2(px.x, -px.y));
    sum += texture2D(u_input, v_uv + vec2(-px.x, px.y));
    sum += texture2D(u_input, v_uv + vec2(-px.x, -px.y));
    gl_FragColor = sum / 8.0;
}
