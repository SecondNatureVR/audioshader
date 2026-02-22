/**
 * Diagnostic meters for audio metrics
 * Displays RMS-style meters with stability indicators
 */

class MetricMeters {
    constructor(defaultMode = 'waveform') {
        this.meters = {};
        this.metricHistory = {};
        this.metricModes = {}; // Store mode per metric
        this.sampleRate = 60; // Assuming 60fps
        this.bpm = 120; // Default BPM, can be estimated from audio
        this.modes = ['waveform', 'rings', 'dots', 'histogram', 'bars'];
        this.defaultMode = defaultMode;
        
        // Time windows in samples (assuming 60fps)
        // 1 bar = 4 beats, 2 bars = 8 beats, 4 bars = 16 beats
        this.window1Bar = Math.floor((60 / this.bpm) * 4 * this.sampleRate); // ~120 samples at 120bpm
        this.window2Bar = this.window1Bar * 2;
        this.window4Bar = this.window1Bar * 4;
        
        // Initialize history for all metrics
        const metricNames = ['coherence', 'mud', 'harshness', 'compression', 'collision', 'phaseRisk', 'audioAmp', 'bandLow', 'bandMid', 'bandHigh'];
        metricNames.forEach(name => {
            this.metricHistory[name] = [];
            this.metricModes[name] = defaultMode;
        });
    }
    
    getMode(metricName) {
        return this.metricModes[metricName] || this.defaultMode;
    }
    
    cycleMode(metricName) {
        const currentIndex = this.modes.indexOf(this.metricModes[metricName]);
        const nextIndex = (currentIndex + 1) % this.modes.length;
        this.metricModes[metricName] = this.modes[nextIndex];
        this.rebuildMeter(metricName);
    }
    
    createMeter(metricName) {
        const container = document.createElement('div');
        container.className = 'meter-container';
        container.dataset.metricName = metricName;
        
        const mode = this.getMode(metricName);
        
        // Create stability indicators based on mode
        let stabilityHTML = '';
        if (mode === 'waveform') {
            stabilityHTML = `
                <div class="stability-waveform-container">
                    <canvas class="stability-waveform" id="stability-1bar-${metricName}" title="1 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-waveform" id="stability-2bar-${metricName}" title="2 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-waveform" id="stability-4bar-${metricName}" title="4 bar stability" width="30" height="8"></canvas>
                </div>
            `;
        } else if (mode === 'rings') {
            stabilityHTML = `
                <div class="stability-rings-container">
                    <div class="stability-ring" id="stability-1bar-${metricName}" title="1 bar stability">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle class="ring-bg" cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                            <circle class="ring-fill" cx="8" cy="8" r="6" fill="none" stroke="#0f0" stroke-width="1" stroke-dasharray="0 37.7" transform="rotate(-90 8 8)"/>
                        </svg>
                    </div>
                    <div class="stability-ring" id="stability-2bar-${metricName}" title="2 bar stability">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle class="ring-bg" cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                            <circle class="ring-fill" cx="8" cy="8" r="6" fill="none" stroke="#0f0" stroke-width="1" stroke-dasharray="0 37.7" transform="rotate(-90 8 8)"/>
                        </svg>
                    </div>
                    <div class="stability-ring" id="stability-4bar-${metricName}" title="4 bar stability">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle class="ring-bg" cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                            <circle class="ring-fill" cx="8" cy="8" r="6" fill="none" stroke="#0f0" stroke-width="1" stroke-dasharray="0 37.7" transform="rotate(-90 8 8)"/>
                        </svg>
                    </div>
                </div>
            `;
        } else if (mode === 'dots') {
            stabilityHTML = `
                <div class="stability-dots-container">
                    <div class="stability-dots" id="stability-1bar-${metricName}" title="1 bar stability"></div>
                    <div class="stability-dots" id="stability-2bar-${metricName}" title="2 bar stability"></div>
                    <div class="stability-dots" id="stability-4bar-${metricName}" title="4 bar stability"></div>
                </div>
            `;
        } else if (mode === 'histogram') {
            stabilityHTML = `
                <div class="stability-histogram-container">
                    <canvas class="stability-histogram" id="stability-1bar-${metricName}" title="1 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-histogram" id="stability-2bar-${metricName}" title="2 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-histogram" id="stability-4bar-${metricName}" title="4 bar stability" width="30" height="8"></canvas>
                </div>
            `;
        } else {
            // Default: bars
            stabilityHTML = `
                <div class="stability-indicators">
                    <div class="stability-bar" id="stability-1bar-${metricName}" title="1 bar stability"></div>
                    <div class="stability-bar" id="stability-2bar-${metricName}" title="2 bar stability"></div>
                    <div class="stability-bar" id="stability-4bar-${metricName}" title="4 bar stability"></div>
                </div>
            `;
        }
        
        // Format metric name for display
        let displayName = metricName.charAt(0).toUpperCase() + metricName.slice(1);
        if (metricName === 'bandLow') displayName = 'Low';
        else if (metricName === 'bandMid') displayName = 'Mid';
        else if (metricName === 'bandHigh') displayName = 'High';
        else if (metricName === 'audioAmp') displayName = 'Amp';
        
        container.innerHTML = `
            <div class="meter-label">${displayName}</div>
            <div class="meter-wrapper">
                <div class="meter-bar">
                    <div class="meter-fill" id="meter-${metricName}"></div>
                </div>
                <div class="meter-value" id="value-${metricName}">0.00</div>
            </div>
            <div class="stability-wrapper">
                <div class="stability-label" id="mode-label-${metricName}">${mode}</div>
                <div class="stability-visualizer" id="stability-visualizer-${metricName}" data-metric="${metricName}">
                    ${stabilityHTML}
                </div>
            </div>
        `;
        
        // Make visualizer clickable
        const visualizer = container.querySelector(`#stability-visualizer-${metricName}`);
        if (visualizer) {
            visualizer.style.cursor = 'pointer';
            visualizer.addEventListener('click', () => {
                this.cycleMode(metricName);
            });
        }
        
        this.meters[metricName] = container;
        return container;
    }
    
    rebuildMeter(metricName) {
        const container = this.meters[metricName];
        if (!container) return;
        
        const mode = this.getMode(metricName);
        const visualizer = container.querySelector(`#stability-visualizer-${metricName}`);
        const label = container.querySelector(`#mode-label-${metricName}`);
        
        if (label) {
            label.textContent = mode;
        }
        
        // Rebuild stability HTML
        let stabilityHTML = '';
        if (mode === 'waveform') {
            stabilityHTML = `
                <div class="stability-waveform-container">
                    <canvas class="stability-waveform" id="stability-1bar-${metricName}" title="1 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-waveform" id="stability-2bar-${metricName}" title="2 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-waveform" id="stability-4bar-${metricName}" title="4 bar stability" width="30" height="8"></canvas>
                </div>
            `;
        } else if (mode === 'rings') {
            stabilityHTML = `
                <div class="stability-rings-container">
                    <div class="stability-ring" id="stability-1bar-${metricName}" title="1 bar stability">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle class="ring-bg" cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                            <circle class="ring-fill" cx="8" cy="8" r="6" fill="none" stroke="#0f0" stroke-width="1" stroke-dasharray="0 37.7" transform="rotate(-90 8 8)"/>
                        </svg>
                    </div>
                    <div class="stability-ring" id="stability-2bar-${metricName}" title="2 bar stability">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle class="ring-bg" cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                            <circle class="ring-fill" cx="8" cy="8" r="6" fill="none" stroke="#0f0" stroke-width="1" stroke-dasharray="0 37.7" transform="rotate(-90 8 8)"/>
                        </svg>
                    </div>
                    <div class="stability-ring" id="stability-4bar-${metricName}" title="4 bar stability">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle class="ring-bg" cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                            <circle class="ring-fill" cx="8" cy="8" r="6" fill="none" stroke="#0f0" stroke-width="1" stroke-dasharray="0 37.7" transform="rotate(-90 8 8)"/>
                        </svg>
                    </div>
                </div>
            `;
        } else if (mode === 'dots') {
            stabilityHTML = `
                <div class="stability-dots-container">
                    <div class="stability-dots" id="stability-1bar-${metricName}" title="1 bar stability"></div>
                    <div class="stability-dots" id="stability-2bar-${metricName}" title="2 bar stability"></div>
                    <div class="stability-dots" id="stability-4bar-${metricName}" title="4 bar stability"></div>
                </div>
            `;
        } else if (mode === 'histogram') {
            stabilityHTML = `
                <div class="stability-histogram-container">
                    <canvas class="stability-histogram" id="stability-1bar-${metricName}" title="1 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-histogram" id="stability-2bar-${metricName}" title="2 bar stability" width="30" height="8"></canvas>
                    <canvas class="stability-histogram" id="stability-4bar-${metricName}" title="4 bar stability" width="30" height="8"></canvas>
                </div>
            `;
        } else {
            stabilityHTML = `
                <div class="stability-indicators">
                    <div class="stability-bar" id="stability-1bar-${metricName}" title="1 bar stability"></div>
                    <div class="stability-bar" id="stability-2bar-${metricName}" title="2 bar stability"></div>
                    <div class="stability-bar" id="stability-4bar-${metricName}" title="4 bar stability"></div>
                </div>
            `;
        }
        
        if (visualizer) {
            visualizer.innerHTML = stabilityHTML;
        }
        
        // Trigger update to render the new visualizers
        const currentValue = this.metricHistory[metricName]?.slice(-1)[0] || 0;
        this.updateMeterDisplay(metricName, currentValue);
    }
    
    updateMetric(metricName, value) {
        // Add to history
        if (!this.metricHistory[metricName]) {
            this.metricHistory[metricName] = [];
        }
        
        this.metricHistory[metricName].push(value);
        
        // Keep history within reasonable bounds
        const maxHistory = this.window4Bar * 2;
        if (this.metricHistory[metricName].length > maxHistory) {
            this.metricHistory[metricName].shift();
        }
        
        // Update meter display
        this.updateMeterDisplay(metricName, value);
    }
    
    calculateStability(metricName, windowSize) {
        const history = this.metricHistory[metricName];
        if (!history || history.length < windowSize) {
            return 1.0; // No data = stable
        }
        
        // Get recent window
        const window = history.slice(-windowSize);
        
        // Calculate variance
        const mean = window.reduce((a, b) => a + b, 0) / window.length;
        const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
        const stdDev = Math.sqrt(variance);
        
        // Stability is inverse of coefficient of variation
        // Higher stability = lower variation relative to mean
        const stability = mean > 0.01 ? 1.0 / (1.0 + stdDev / mean) : 1.0;
        return Math.max(0, Math.min(1, stability));
    }
    
    updateMeterDisplay(metricName, value) {
        const fill = document.getElementById(`meter-${metricName}`);
        const valueDisplay = document.getElementById(`value-${metricName}`);
        
        if (fill) {
            const percentage = Math.min(100, Math.max(0, value * 100));
            fill.style.width = percentage + '%';
            
            // Color based on value and metric type
            if (metricName === 'coherence') {
                // For coherence, higher is better
                fill.style.backgroundColor = value > 0.7 ? '#0f0' : value > 0.4 ? '#ff0' : '#f00';
            } else if (metricName.startsWith('band')) {
                // Band energy: color by frequency band
                if (metricName === 'bandLow') {
                    fill.style.backgroundColor = `rgb(${Math.floor(220 * value)}, ${Math.floor(100 * value)}, ${Math.floor(50 * value)})`;
                } else if (metricName === 'bandMid') {
                    fill.style.backgroundColor = `rgb(${Math.floor(180 * value)}, ${Math.floor(200 * value)}, ${Math.floor(120 * value)})`;
                } else if (metricName === 'bandHigh') {
                    fill.style.backgroundColor = `rgb(${Math.floor(50 * value)}, ${Math.floor(150 * value)}, ${Math.floor(255 * value)})`;
                }
            } else {
                // For problems, lower is better
                fill.style.backgroundColor = value < 0.3 ? '#0f0' : value < 0.6 ? '#ff0' : '#f00';
            }
        }
        
        if (valueDisplay) {
            valueDisplay.textContent = value.toFixed(2);
        }
        
        // Update stability indicators
        const stability1 = this.calculateStability(metricName, this.window1Bar);
        const stability2 = this.calculateStability(metricName, this.window2Bar);
        const stability4 = this.calculateStability(metricName, this.window4Bar);
        
        this.updateStabilityBar(`stability-1bar-${metricName}`, stability1, metricName, this.window1Bar);
        this.updateStabilityBar(`stability-2bar-${metricName}`, stability2, metricName, this.window2Bar);
        this.updateStabilityBar(`stability-4bar-${metricName}`, stability4, metricName, this.window4Bar);
    }
    
    updateStabilityBar(elementId, stability, metricName, windowSize) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const color = this.getStabilityColor(stability);
        const mode = this.getMode(metricName);
        
        if (mode === 'waveform') {
            this.updateWaveform(element, metricName, windowSize, color);
        } else if (mode === 'rings') {
            this.updateRing(element, stability, color);
        } else if (mode === 'dots') {
            this.updateDots(element, stability, color);
        } else if (mode === 'histogram') {
            this.updateHistogram(element, metricName, windowSize, color);
        } else {
            // Default: bars
            const percentage = stability * 100;
            element.style.width = percentage + '%';
            element.style.backgroundColor = color;
        }
    }
    
    getStabilityColor(stability) {
        if (stability > 0.7) return '#0f0';
        if (stability > 0.4) return '#ff0';
        return '#f00';
    }
    
    updateWaveform(canvas, metricName, windowSize, color) {
        if (!canvas || canvas.tagName !== 'CANVAS') return;
        const ctx = canvas.getContext('2d');
        const history = this.metricHistory[metricName];
        if (!history || history.length < 2) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const window = history.slice(-windowSize);
        const samples = Math.min(window.length, width);
        
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const centerY = height / 2;
        const stepX = width / (samples - 1);
        
        window.slice(-samples).forEach((value, i) => {
            const x = i * stepX;
            const y = centerY - (value - 0.5) * height * 0.8;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }
    
    updateRing(element, stability, color) {
        const circle = element.querySelector('.ring-fill');
        if (!circle) return;
        
        const circumference = 2 * Math.PI * 6; // radius = 6
        const offset = circumference * (1 - stability);
        
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-dasharray', `${circumference * stability} ${circumference}`);
        circle.setAttribute('stroke-dashoffset', offset);
    }
    
    updateDots(element, stability, color) {
        // Create dots that spread out when unstable
        const dotCount = 5;
        const spread = (1 - stability) * 15; // Max spread in pixels
        const containerWidth = element.offsetWidth || 30;
        const containerHeight = 12;
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;
        
        element.innerHTML = '';
        element.style.position = 'relative';
        element.style.width = '100%';
        element.style.height = containerHeight + 'px';
        
        for (let i = 0; i < dotCount; i++) {
            const dot = document.createElement('div');
            const angle = (i / dotCount) * Math.PI * 2;
            const distance = stability > 0.5 ? 0 : (1 - stability) * spread;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            dot.style.position = 'absolute';
            dot.style.width = '2px';
            dot.style.height = '2px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = color;
            dot.style.left = x + 'px';
            dot.style.top = y + 'px';
            dot.style.transition = 'all 0.2s';
            dot.style.transform = 'translate(-50%, -50%)';
            
            element.appendChild(dot);
        }
    }
    
    updateHistogram(canvas, metricName, windowSize, color) {
        if (!canvas || canvas.tagName !== 'CANVAS') return;
        const ctx = canvas.getContext('2d');
        const history = this.metricHistory[metricName];
        if (!history || history.length < 2) return;
        
        const width = canvas.width;
        const height = canvas.height;
        const window = history.slice(-windowSize);
        
        // Create bins for histogram
        const bins = 10;
        const binCounts = new Array(bins).fill(0);
        window.forEach(value => {
            const bin = Math.min(bins - 1, Math.floor(value * bins));
            binCounts[bin]++;
        });
        
        const maxCount = Math.max(...binCounts, 1);
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;
        
        const barWidth = width / bins;
        binCounts.forEach((count, i) => {
            const barHeight = (count / maxCount) * height;
            ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        });
    }
    
    updateAll(metrics) {
        // Update all meters with current metric values
        this.updateMetric('coherence', metrics.u_coherence || 0.0);
        this.updateMetric('mud', metrics.u_mud || 0.0);
        this.updateMetric('harshness', metrics.u_harshness || 0.0);
        this.updateMetric('compression', metrics.u_compression || 0.0);
        this.updateMetric('collision', metrics.u_collision || 0.0);
        this.updateMetric('phaseRisk', metrics.u_phaseRisk || 0.0);
        this.updateMetric('audioAmp', metrics.u_audioAmp || 0.0);
        
        // Update band energy meters separately
        if (metrics.u_bandEnergy && Array.isArray(metrics.u_bandEnergy)) {
            this.updateMetric('bandLow', metrics.u_bandEnergy[0] || 0.0);
            this.updateMetric('bandMid', metrics.u_bandEnergy[1] || 0.0);
            this.updateMetric('bandHigh', metrics.u_bandEnergy[2] || 0.0);
        }
    }
    
    updateMeterDisplay(metricName, value) {
        const fill = document.getElementById(`meter-${metricName}`);
        const valueDisplay = document.getElementById(`value-${metricName}`);
        
        if (fill) {
            const percentage = Math.min(100, Math.max(0, value * 100));
            fill.style.width = percentage + '%';
            
            // Color based on value and metric type
            if (metricName === 'coherence') {
                // For coherence, higher is better
                fill.style.backgroundColor = value > 0.7 ? '#0f0' : value > 0.4 ? '#ff0' : '#f00';
            } else if (metricName.startsWith('band')) {
                // Band energy: color by frequency band
                if (metricName === 'bandLow') {
                    fill.style.backgroundColor = `rgb(${Math.floor(220 * value)}, ${Math.floor(100 * value)}, ${Math.floor(50 * value)})`;
                } else if (metricName === 'bandMid') {
                    fill.style.backgroundColor = `rgb(${Math.floor(180 * value)}, ${Math.floor(200 * value)}, ${Math.floor(120 * value)})`;
                } else if (metricName === 'bandHigh') {
                    fill.style.backgroundColor = `rgb(${Math.floor(50 * value)}, ${Math.floor(150 * value)}, ${Math.floor(255 * value)})`;
                }
            } else {
                // For problems, lower is better
                fill.style.backgroundColor = value < 0.3 ? '#0f0' : value < 0.6 ? '#ff0' : '#f00';
            }
        }
        
        if (valueDisplay) {
            valueDisplay.textContent = value.toFixed(2);
        }
        
        // Update stability indicators
        const stability1 = this.calculateStability(metricName, this.window1Bar);
        const stability2 = this.calculateStability(metricName, this.window2Bar);
        const stability4 = this.calculateStability(metricName, this.window4Bar);
        
        this.updateStabilityBar(`stability-1bar-${metricName}`, stability1, metricName, this.window1Bar);
        this.updateStabilityBar(`stability-2bar-${metricName}`, stability2, metricName, this.window2Bar);
        this.updateStabilityBar(`stability-4bar-${metricName}`, stability4, metricName, this.window4Bar);
    }
}

