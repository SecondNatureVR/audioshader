/**
 * WebGL renderer and shader management
 * Responsibilities:
 * - Initializes WebGL context from canvas
 * - Compiles and links vertex and fragment shaders
 * - Creates and manages shader program
 * - Sets up full-screen quad geometry
 * - Provides interface to update shader uniforms (time, resolution, audio metrics)
 * - Exposes render(uniforms) function for drawing
 */

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        this.program = null;
        this.quad = null;
        this.uniformLocations = {};
        this.positionLocation = null;
        
        // Initialize viewport
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    async loadShader(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load shader: ${url}`);
        }
        return response.text();
    }
    
    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${info}`);
        }
        
        return shader;
    }
    
    async init(vertexShaderUrl, fragmentShaderUrl) {
        const gl = this.gl;
        
        // Load shader sources
        const vertexSource = await this.loadShader(vertexShaderUrl);
        const fragmentSource = await this.loadShader(fragmentShaderUrl);
        
        // Compile shaders
        const vertexShader = this.compileShader(vertexSource, gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);
        
        // Create and link program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(this.program);
            throw new Error(`Program linking error: ${info}`);
        }
        
        // Cache uniform locations
        this.cacheUniformLocations();
        
        // Setup full-screen quad
        this.setupQuad();
        
        // Use the program
        gl.useProgram(this.program);
    }
    
    cacheUniformLocations() {
        const gl = this.gl;
        const program = this.program;
        
        // Cache all expected uniform locations
        const uniformNames = [
            'u_time',
            'u_resolution',
            'u_coherence',
            'u_mud',
            'u_phaseRisk',
            'u_compression',
            'u_harshness',
            'u_lowImbalance',
            'u_emptiness',
            'u_collision',
            'u_audioAmp',
            'u_bandEnergy',
            // Spatial metrics (v2)
            'u_stereoWidth',
            'u_panPosition',
            'u_spatialDepth'
        ];
        
        uniformNames.forEach(name => {
            const location = gl.getUniformLocation(program, name);
            if (location !== null) {
                this.uniformLocations[name] = location;
            }
        });
        
        // Get position attribute location
        this.positionLocation = gl.getAttribLocation(program, 'a_position');
    }
    
    setupQuad() {
        const gl = this.gl;
        
        // Full-screen quad vertices (two triangles)
        const positions = new Float32Array([
            -1, -1,  // bottom-left
             1, -1,  // bottom-right
            -1,  1,  // top-left
            -1,  1,  // top-left
             1, -1,  // bottom-right
             1,  1   // top-right
        ]);
        
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        
        this.quad = {
            buffer,
            count: 6
        };
        
        // Setup vertex attribute
        gl.enableVertexAttribArray(this.positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.buffer);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    }
    
    setUniform(name, value) {
        const gl = this.gl;
        const location = this.uniformLocations[name];
        
        if (location === null || location === undefined) {
            // Uniform doesn't exist or wasn't found - silently skip
            return;
        }
        
        // Determine uniform type based on value
        if (typeof value === 'number') {
            gl.uniform1f(location, value);
        } else if (Array.isArray(value)) {
            if (value.length === 2) {
                gl.uniform2f(location, value[0], value[1]);
            } else if (value.length === 3) {
                gl.uniform3f(location, value[0], value[1], value[2]);
            } else if (value.length === 4) {
                gl.uniform4f(location, value[0], value[1], value[2], value[3]);
            }
        }
    }
    
    render(uniforms) {
        const gl = this.gl;
        
        // Set all uniforms from the provided object
        Object.keys(uniforms).forEach(name => {
            this.setUniform(name, uniforms[name]);
        });
        
        // Always set resolution (derived from canvas)
        this.setUniform('u_resolution', [this.canvas.width, this.canvas.height]);
        
        // Clear and draw
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, this.quad.count);
    }
}
