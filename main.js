/**
 * Main application entry point and render loop
 * Step 3.3: Wire time + resolution only with dummy values
 */

let renderer;
let analyzer;
let legend;
let meters;
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
        
        // Create visual legend
        legend = new MetricLegend();
        setupLegend();
        
        // Create diagnostic meters (try different visualization modes: 'waveform', 'rings', 'dots', 'histogram', 'bars')
        meters = new MetricMeters('waveform'); // Change to 'rings', 'dots', 'histogram', or 'bars' to try different modes
        setupMeters();
        
        // Wire up audio button
        setupAudioButton();
        
        // Start render loop
        startTime = Date.now();
        render();
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Failed to initialize: ' + err.message);
    }
}

function setupMeters() {
    const container = document.getElementById('meters-container');
    if (!container) return;
    
    // Create meters for each metric
    const metricNames = ['coherence', 'mud', 'harshness', 'compression', 'collision', 'phaseRisk', 'audioAmp', 'bandLow', 'bandMid', 'bandHigh'];
    
    metricNames.forEach(name => {
        const meter = meters.createMeter(name);
        
        // Add legend swatch to the label
        const label = meter.querySelector('.meter-label');
        if (label) {
            let swatchId;
            if (name === 'bandLow' || name === 'bandMid' || name === 'bandHigh') {
                swatchId = 'legend-bandEnergy';
            } else if (name === 'audioAmp') {
                swatchId = 'legend-bandEnergy';
            } else {
                swatchId = `legend-${name}`;
            }
            
            const swatch = document.getElementById(swatchId);
            if (swatch) {
                const swatchClone = swatch.cloneNode(true);
                swatchClone.style.marginRight = '4px';
                label.insertBefore(swatchClone, label.firstChild);
            }
        }
        
        container.appendChild(meter);
    });
}

function setupLegend() {
    // Get existing canvas elements and set them up
    const metricMap = {
        'legend-coherence': 'coherence',
        'legend-mud': 'mud',
        'legend-harshness': 'harshness',
        'legend-compression': 'compression',
        'legend-collision': 'collision',
        'legend-phaseRisk': 'phaseRisk',
        'legend-bandEnergy': 'bandEnergy'
    };
    
    Object.keys(metricMap).forEach(elementId => {
        const canvas = document.getElementById(elementId);
        if (canvas) {
            // Set canvas size
            canvas.width = 20;
            canvas.height = 20;
            canvas.style.width = '20px';
            canvas.style.height = '20px';
            canvas.style.border = '1px solid rgba(255,255,255,0.4)';
            canvas.style.borderRadius = '2px';
            canvas.style.marginLeft = '4px';
            canvas.style.marginRight = '4px';
            canvas.style.imageRendering = 'pixelated';
            
            // Store context
            const ctx = canvas.getContext('2d');
            const metricName = metricMap[elementId];
            legend.canvases[metricName] = canvas;
            legend.ctx[metricName] = ctx;
        }
    });
    
    // Initial render
    requestAnimationFrame(() => {
        legend.update(metrics);
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
        
        // Get metrics from audio analyzer if enabled
        if (useAudio && analyzer) {
            const audioMetrics = analyzer.getMetrics();
            metrics = audioMetrics;
        }
        
        // Update legend visuals
        if (legend) {
            legend.update(metrics);
        }
        
        // Update diagnostic meters
        if (meters) {
            meters.updateAll(metrics);
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


// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
