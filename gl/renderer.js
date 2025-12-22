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
            'u_spatialDepth',
            // Ripple history
            'u_rippleCount',
            'u_rippleTimes[0]',
            'u_rippleAmps[0]',
            'u_rippleBandEnergy[0]',
            'u_rippleCoherence[0]',
            'u_rippleMud[0]',
            'u_rippleHarshness[0]',
            'u_rippleCompression[0]',
            'u_rippleCollision[0]',
            'u_ripplePhaseRisk[0]'
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
        
        // Handle array uniforms (ripple history)
        if (name.startsWith('u_ripple') && Array.isArray(value) && value.length > 0) {
            // For array uniforms in GLSL, we need to get location using [0] syntax
            let baseName = name;
            if (!baseName.includes('[')) {
                // If name doesn't have brackets, add [0]
                baseName = name + '[0]';
            } else {
                // Replace any index with [0]
                baseName = name.replace(/\[\d+\]$/, '[0]');
            }
            
            const location = gl.getUniformLocation(this.program, baseName);
            
            if (location === null) {
                // Debug: log missing uniform
                if (name === 'u_rippleTimes' || name === 'u_rippleAmps') {
                    console.warn(`Ripple uniform not found: ${baseName}`);
                }
                return; // Uniform doesn't exist
            }
            
            // Determine array type and set
            if (name.includes('Times') || name.includes('Amps') || 
                name.includes('Coherence') || name.includes('Mud') || 
                name.includes('Harshness') || name.includes('Compression') || 
                name.includes('Collision') || name.includes('PhaseRisk')) {
                // Float array
                const floatArray = new Float32Array(value);
                gl.uniform1fv(location, floatArray);
            } else if (name.includes('BandEnergy')) {
                // Vec3 array - need to flatten
                const flatArray = new Float32Array(value.length * 3);
                for (let i = 0; i < value.length; i++) {
                    if (Array.isArray(value[i]) && value[i].length >= 3) {
                        flatArray[i * 3] = value[i][0];
                        flatArray[i * 3 + 1] = value[i][1];
                        flatArray[i * 3 + 2] = value[i][2];
                    }
                }
                gl.uniform3fv(location, flatArray);
            }
            return;
        }
        
        // Handle regular uniforms
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
