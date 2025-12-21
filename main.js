/**
 * Main application entry point and render loop
 * Minimal test version with placeholder values
 */

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL not supported');
    throw new Error('WebGL not supported');
}

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Load shader source
async function loadShader(url) {
    const response = await fetch(url);
    return response.text();
}

// Compile shader
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

// Create shader program
async function createProgram(gl, vertexUrl, fragmentUrl) {
    const vertexSource = await loadShader(vertexUrl);
    const fragmentSource = await loadShader(fragmentUrl);
    
    const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) {
        throw new Error('Failed to compile shaders');
    }
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        throw new Error('Failed to link program');
    }
    
    return program;
}

// Create full-screen quad
function createQuad(gl) {
    const positions = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ]);
    
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    return {
        buffer,
        count: 6
    };
}

// Initialize and start render loop
async function init() {
    const program = await createProgram(gl, 'shaders/vertex.glsl', 'shaders/fragment.glsl');
    const quad = createQuad(gl);
    
    gl.useProgram(program);
    
    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const coherenceLocation = gl.getUniformLocation(program, 'u_coherence');
    const mudLocation = gl.getUniformLocation(program, 'u_mud');
    const phaseRiskLocation = gl.getUniformLocation(program, 'u_phaseRisk');
    const compressionLocation = gl.getUniformLocation(program, 'u_compression');
    const harshnessLocation = gl.getUniformLocation(program, 'u_harshness');
    const lowImbalanceLocation = gl.getUniformLocation(program, 'u_lowImbalance');
    const emptinessLocation = gl.getUniformLocation(program, 'u_emptiness');
    const collisionLocation = gl.getUniformLocation(program, 'u_collision');
    const audioAmpLocation = gl.getUniformLocation(program, 'u_audioAmp');
    const bandEnergyLocation = gl.getUniformLocation(program, 'u_bandEnergy');
    
    // Setup vertex attribute
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Get control sliders
    const controls = {
        coherence: document.getElementById('coherence'),
        mud: document.getElementById('mud'),
        harshness: document.getElementById('harshness'),
        compression: document.getElementById('compression'),
        collision: document.getElementById('collision'),
        phaseRisk: document.getElementById('phaseRisk'),
        audioAmp: document.getElementById('audioAmp')
    };
    
    // Update value displays
    Object.keys(controls).forEach(key => {
        const slider = controls[key];
        const display = document.getElementById(key + '-val');
        slider.addEventListener('input', () => {
            display.textContent = parseFloat(slider.value).toFixed(2);
        });
    });
    
    // Render loop
    let startTime = Date.now();
    function render() {
        const currentTime = (Date.now() - startTime) / 1000.0;
        
        // Set uniforms
        gl.uniform1f(timeLocation, currentTime);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform1f(coherenceLocation, parseFloat(controls.coherence.value));
        gl.uniform1f(mudLocation, parseFloat(controls.mud.value));
        gl.uniform1f(phaseRiskLocation, parseFloat(controls.phaseRisk.value));
        gl.uniform1f(compressionLocation, parseFloat(controls.compression.value));
        gl.uniform1f(harshnessLocation, parseFloat(controls.harshness.value));
        gl.uniform1f(lowImbalanceLocation, 0.0); // Placeholder
        gl.uniform1f(emptinessLocation, 0.0); // Placeholder
        gl.uniform1f(collisionLocation, parseFloat(controls.collision.value));
        gl.uniform1f(audioAmpLocation, parseFloat(controls.audioAmp.value));
        gl.uniform3f(bandEnergyLocation, 0.5, 0.5, 0.5); // Placeholder: balanced
        
        // Clear and draw
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, quad.count);
        
        requestAnimationFrame(render);
    }
    
    render();
}

// Start the app
init().catch(err => {
    console.error('Initialization error:', err);
    alert('Failed to initialize: ' + err.message);
});
