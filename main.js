/**
 * Main application entry point and render loop
 * Step 3.3: Wire time + resolution only with dummy values
 */

let renderer;
let analyzer;
let startTime;
let useAudio = false;

// Default values - will be overridden by audio or controls
let metrics = {
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
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }
        
        renderer = new Renderer(canvas);
        
        // Initialize renderer with shaders
        console.log('Initializing renderer...');
        await renderer.init('shaders/vertex.glsl', 'shaders/fragment.glsl');
        console.log('Renderer initialized successfully');
        console.log('Starting render loop...');
        
        // Create audio analyzer
        analyzer = new AudioAnalyzer();
        
        // Wire up controls and audio button
        setupControls();
        setupAudioButton();
        
        // Start render loop
        startTime = Date.now();
        render();
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to initialize: ' + err.message);
    }
}

function setupControls() {
    // Wire up sliders to update metrics (only when audio is disabled)
    const controls = {
        coherence: document.getElementById('coherence'),
        mud: document.getElementById('mud'),
        harshness: document.getElementById('harshness'),
        compression: document.getElementById('compression'),
        collision: document.getElementById('collision'),
        phaseRisk: document.getElementById('phaseRisk'),
        audioAmp: document.getElementById('audioAmp')
    };
    
    // Update value displays and metrics
    Object.keys(controls).forEach(key => {
        const slider = controls[key];
        const display = document.getElementById(key + '-val');
        
        if (slider && display) {
            // Update display on change
            slider.addEventListener('input', () => {
                if (!useAudio) {
                    const value = parseFloat(slider.value);
                    display.textContent = value.toFixed(2);
                    
                    // Update metrics object
                    if (key === 'phaseRisk') {
                        metrics.u_phaseRisk = value;
                    } else {
                        metrics['u_' + key] = value;
                    }
                }
            });
        }
    });
}

function setupAudioButton() {
    const btn = document.getElementById('enable-audio-btn');
    const status = document.getElementById('audio-status');
    
    if (!btn || !status) return;
    
    btn.addEventListener('click', async () => {
        if (useAudio) {
            // Disable audio
            analyzer.disableAudio();
            useAudio = false;
            btn.textContent = 'Enable Audio';
            status.textContent = 'Audio: Disabled';
            status.style.color = '#888';
        } else {
            // Enable audio
            try {
                await analyzer.enableAudio();
                useAudio = true;
                btn.textContent = 'Disable Audio';
                status.textContent = 'Audio: Enabled';
                status.style.color = '#0f0';
            } catch (err) {
                console.error('Failed to enable audio:', err);
                alert('Failed to enable audio. Please allow microphone access.');
            }
        }
    });
}

let frameCount = 0;
function render() {
    if (!renderer) {
        console.error('Renderer not initialized');
        return;
    }
    
    try {
        const currentTime = (Date.now() - startTime) / 1000.0;
        
        // Get metrics from audio analyzer if enabled, otherwise use manual controls
        if (useAudio && analyzer) {
            const audioMetrics = analyzer.getMetrics();
            metrics = audioMetrics;
            
            // Update UI displays with live values
            updateMetricDisplays(metrics);
        }
        
        // Pass time + resolution + all metrics
        renderer.render({
            u_time: currentTime,
            ...metrics
        });
        
        requestAnimationFrame(render);
    } catch (err) {
        console.error('Render error:', err);
    }
}

function updateMetricDisplays(metrics) {
    // Update display values to show live audio metrics
    const displays = {
        coherence: document.getElementById('coherence-val'),
        mud: document.getElementById('mud-val'),
        harshness: document.getElementById('harshness-val'),
        compression: document.getElementById('compression-val'),
        collision: document.getElementById('collision-val'),
        phaseRisk: document.getElementById('phaseRisk-val'),
        audioAmp: document.getElementById('audioAmp-val')
    };
    
    if (displays.coherence) displays.coherence.textContent = metrics.u_coherence.toFixed(2);
    if (displays.mud) displays.mud.textContent = metrics.u_mud.toFixed(2);
    if (displays.harshness) displays.harshness.textContent = metrics.u_harshness.toFixed(2);
    if (displays.compression) displays.compression.textContent = metrics.u_compression.toFixed(2);
    if (displays.collision) displays.collision.textContent = metrics.u_collision.toFixed(2);
    if (displays.phaseRisk) displays.phaseRisk.textContent = metrics.u_phaseRisk.toFixed(2);
    if (displays.audioAmp) displays.audioAmp.textContent = metrics.u_audioAmp.toFixed(2);
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
