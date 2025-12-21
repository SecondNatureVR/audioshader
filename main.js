/**
 * Main application entry point and render loop
 * Step 3.3: Wire time + resolution only with dummy values
 */

const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);

// Dummy values - tweak these constants to see visuals respond
const DUMMY_VALUES = {
    u_coherence: 0.7,
    u_mud: 0.0,
    u_phaseRisk: 0.0,
    u_compression: 0.0,
    u_harshness: 0.0,
    u_lowImbalance: 0.0,
    u_emptiness: 0.0,
    u_collision: 0.0,
    u_audioAmp: 0.5,
    u_bandEnergy: [0.5, 0.5, 0.5]
};

async function init() {
    try {
        // Initialize renderer with shaders
        await renderer.init('shaders/vertex.glsl', 'shaders/fragment.glsl');
        
        // Start render loop
        let startTime = Date.now();
        
        function render() {
            const currentTime = (Date.now() - startTime) / 1000.0;
            
            // Pass time + resolution (resolution is auto-set by renderer, but we can be explicit)
            // Pass dummy values for the rest
            renderer.render({
                u_time: currentTime,
                ...DUMMY_VALUES
            });
            
            requestAnimationFrame(render);
        }
        
        render();
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to initialize: ' + err.message);
    }
}

// Start the app
init();
