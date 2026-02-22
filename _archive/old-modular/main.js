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

// Frame history for ripple effect (stores last 20 frames)
const MAX_RIPPLE_HISTORY = 20;
let rippleHistory = [];

async function init() {
    try {
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }
        
        renderer = new Renderer(canvas);
        
        // Initialize renderer with shaders (using water ripple shader)
        console.log('Initializing renderer...');
        await renderer.init('shaders/vertex.glsl', 'shaders/fragment-water.glsl');
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

async function loadAudioDevices() {
    const select = document.getElementById('audio-device-select');
    if (!select) return;
    
    try {
        const devices = await analyzer.getAudioDevices();
        select.innerHTML = '<option value="">Default (System Default)</option>';
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label;
            select.appendChild(option);
        });
        
        console.log(`Loaded ${devices.length} audio input devices`);
    } catch (err) {
        console.error('Failed to load audio devices:', err);
        select.innerHTML = '<option value="">Error loading devices</option>';
    }
}

function setupAudioButton() {
    const btn = document.getElementById('enable-audio-btn');
    const status = document.getElementById('audio-status');
    const deviceSelect = document.getElementById('audio-device-select');
    
    if (!btn || !status) return;
    
    // Load devices on page load
    loadAudioDevices();
    
    // Reload devices when selection changes (in case new devices are added)
    if (deviceSelect) {
        deviceSelect.addEventListener('change', () => {
            if (useAudio) {
                // If audio is enabled, restart with new device
                btn.click();
                btn.click(); // Toggle off then on
            }
        });
    }
    
    btn.addEventListener('click', async () => {
        if (useAudio) {
            // Disable audio
            analyzer.disableAudio();
            useAudio = false;
            btn.textContent = 'Enable Audio';
            status.textContent = 'Audio: Disabled';
            status.style.color = '#888';
            if (deviceSelect) deviceSelect.disabled = false;
        } else {
            // Enable audio (try stereo first)
            try {
                const selectedDeviceId = deviceSelect?.value || null;
                if (selectedDeviceId) {
                    console.log(`Using device: ${deviceSelect.options[deviceSelect.selectedIndex].textContent}`);
                } else {
                    console.log('Using default audio device');
                }
                
                await analyzer.enableAudio(selectedDeviceId, true); // Try stereo
                useAudio = true;
                const mode = analyzer.isStereo ? 'STEREO' : 'MONO';
                btn.textContent = 'Disable Audio';
                status.textContent = `Audio: ${mode}`;
                status.style.color = analyzer.isStereo ? '#0f0' : '#ff0';
                if (deviceSelect) deviceSelect.disabled = true;
                
                // Show/hide stereo setup info
                const stereoInfo = document.getElementById('stereo-info');
                if (stereoInfo) {
                    stereoInfo.style.display = analyzer.isStereo ? 'none' : 'block';
                }
                
                if (!analyzer.isStereo) {
                    console.log('Note: Mono input detected. For stereo analysis, set up system audio routing.');
                }
            } catch (err) {
                console.error('Failed to enable audio:', err);
                let errorMsg = 'Failed to enable audio. ';
                if (err.name === 'NotAllowedError') {
                    errorMsg += 'Please allow microphone access.';
                } else if (err.name === 'NotFoundError') {
                    errorMsg += 'Selected device not found.';
                } else if (err.name === 'NotReadableError') {
                    errorMsg += 'Device is being used by another application.';
                } else {
                    errorMsg += err.message;
                }
                alert(errorMsg);
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
            
            // Debug: Log metrics occasionally to verify they're updating
            if (frameCount % 60 === 0) {
                console.log('Audio metrics:', {
                    audioAmp: audioMetrics.u_audioAmp?.toFixed(3),
                    coherence: audioMetrics.u_coherence?.toFixed(3),
                    mud: audioMetrics.u_mud?.toFixed(3),
                    harshness: audioMetrics.u_harshness?.toFixed(3),
                    bandEnergy: audioMetrics.u_bandEnergy?.map(v => v.toFixed(3))
                });
            }
        }
        
        // Add current frame to ripple history at exactly 3Hz (every ~0.333 seconds)
        const RIPPLE_RATE = 1.0 / 3.0; // 3 times per second
        const shouldAddFrame = rippleHistory.length === 0 || 
                              (currentTime - rippleHistory[rippleHistory.length - 1].time) >= RIPPLE_RATE;
        
        if (shouldAddFrame) {
            rippleHistory.push({
                time: currentTime,
                amp: metrics.u_audioAmp,
                bandEnergy: [...metrics.u_bandEnergy],
                coherence: metrics.u_coherence,
                mud: metrics.u_mud,
                harshness: metrics.u_harshness,
                compression: metrics.u_compression,
                collision: metrics.u_collision,
                phaseRisk: metrics.u_phaseRisk
            });
            
            // Keep only last N frames
            if (rippleHistory.length > MAX_RIPPLE_HISTORY) {
                rippleHistory.shift();
            }
        }
        
        // Debug: log ripple history occasionally
        if (frameCount % 120 === 0 && rippleHistory.length > 0) {
            console.log('Ripple history:', {
                count: rippleHistory.length,
                oldest: rippleHistory[0].time,
                newest: rippleHistory[rippleHistory.length - 1].time,
                ageRange: currentTime - rippleHistory[0].time
            });
        }
        
        // Update legend visuals
        if (legend) {
            legend.update(metrics);
        }
        
        // Update diagnostic meters
        if (meters) {
            meters.updateAll(metrics);
        }
        
        // Prepare ripple data arrays (always MAX_RIPPLE_HISTORY length for shader)
        const rippleTimes = new Float32Array(MAX_RIPPLE_HISTORY);
        const rippleAmps = new Float32Array(MAX_RIPPLE_HISTORY);
        const rippleBandEnergy = new Array(MAX_RIPPLE_HISTORY);
        const rippleCoherence = new Float32Array(MAX_RIPPLE_HISTORY);
        const rippleMud = new Float32Array(MAX_RIPPLE_HISTORY);
        const rippleHarshness = new Float32Array(MAX_RIPPLE_HISTORY);
        const rippleCompression = new Float32Array(MAX_RIPPLE_HISTORY);
        const rippleCollision = new Float32Array(MAX_RIPPLE_HISTORY);
        const ripplePhaseRisk = new Float32Array(MAX_RIPPLE_HISTORY);
        
        // Fill arrays with history data
        for (let i = 0; i < MAX_RIPPLE_HISTORY; i++) {
            if (i < rippleHistory.length) {
                const frame = rippleHistory[i];
                rippleTimes[i] = frame.time;
                rippleAmps[i] = frame.amp;
                rippleBandEnergy[i] = frame.bandEnergy;
                rippleCoherence[i] = frame.coherence;
                rippleMud[i] = frame.mud;
                rippleHarshness[i] = frame.harshness;
                rippleCompression[i] = frame.compression;
                rippleCollision[i] = frame.collision;
                ripplePhaseRisk[i] = frame.phaseRisk;
            } else {
                // Fill with zeros for unused slots
                rippleTimes[i] = 0;
                rippleAmps[i] = 0;
                rippleBandEnergy[i] = [0, 0, 0];
                rippleCoherence[i] = 0;
                rippleMud[i] = 0;
                rippleHarshness[i] = 0;
                rippleCompression[i] = 0;
                rippleCollision[i] = 0;
                ripplePhaseRisk[i] = 0;
            }
        }
        
        const rippleData = {
            u_rippleCount: rippleHistory.length,
            u_rippleTimes: Array.from(rippleTimes),
            u_rippleAmps: Array.from(rippleAmps),
            u_rippleBandEnergy: rippleBandEnergy,
            u_rippleCoherence: Array.from(rippleCoherence),
            u_rippleMud: Array.from(rippleMud),
            u_rippleHarshness: Array.from(rippleHarshness),
            u_rippleCompression: Array.from(rippleCompression),
            u_rippleCollision: Array.from(rippleCollision),
            u_ripplePhaseRisk: Array.from(ripplePhaseRisk)
        };
        
        // Pass time + resolution + all metrics + ripple history
        renderer.render({
            u_time: currentTime,
            ...metrics,
            ...rippleData
        });
        
        frameCount++;
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
