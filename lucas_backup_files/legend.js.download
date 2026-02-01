/**
 * Visual legend indicators for metrics
 * Creates small 20x20 visual swatches showing isolated metric effects
 */

class MetricLegend {
    constructor() {
        this.canvases = {};
        this.ctx = {};
        this.size = 20; // Small 20x20 swatches
    }
    
    createLegendCanvas(metricName) {
        const canvas = document.createElement('canvas');
        canvas.width = this.size;
        canvas.height = this.size;
        canvas.style.width = this.size + 'px';
        canvas.style.height = this.size + 'px';
        canvas.style.border = '1px solid rgba(255,255,255,0.4)';
        canvas.style.borderRadius = '2px';
        canvas.style.marginLeft = '4px';
        canvas.style.marginRight = '4px';
        canvas.style.verticalAlign = 'middle';
        canvas.style.display = 'inline-block';
        canvas.style.imageRendering = 'pixelated';
        
        const ctx = canvas.getContext('2d');
        this.canvases[metricName] = canvas;
        this.ctx[metricName] = ctx;
        
        return canvas;
    }
    
    // Base pattern for all swatches
    basePattern(x, y, center) {
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy) / center;
        const angle = Math.atan2(dy, dx);
        return Math.sin(dist * 4 - angle * 2) * 0.5 + 0.5;
    }
    
    renderCoherence(ctx, value) {
        const center = this.size / 2;
        ctx.clearRect(0, 0, this.size, this.size);
        
        // Sharp, clear pattern - value controls sharpness
        const sharpness = 0.3 + value * 0.7;
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                let pattern = this.basePattern(x, y, center);
                pattern = Math.pow(pattern, 1.0 / (sharpness + 0.1));
                const gray = Math.floor(pattern * 255);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    renderMud(ctx, value) {
        const center = this.size / 2;
        ctx.clearRect(0, 0, this.size, this.size);
        
        // Blurred pattern
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                // Blur by averaging nearby
                let sum = 0;
                let count = 0;
                const blur = Math.floor(value * 2);
                for (let dy = -blur; dy <= blur; dy++) {
                    for (let dx = -blur; dx <= blur; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
                            sum += this.basePattern(nx, ny, center);
                            count++;
                        }
                    }
                }
                const pattern = count > 0 ? (sum / count) * (1.0 - value * 0.4) : 0.5;
                const gray = Math.floor(pattern * 255);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    renderHarshness(ctx, value) {
        const center = this.size / 2;
        ctx.clearRect(0, 0, this.size, this.size);
        
        // Noisy pattern
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const pattern = this.basePattern(x, y, center);
                const noise = (Math.random() - 0.5) * value * 0.6;
                const final = Math.max(0, Math.min(1, pattern + noise));
                const gray = Math.floor(final * 255);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    renderCompression(ctx, value) {
        const center = this.size / 2;
        ctx.clearRect(0, 0, this.size, this.size);
        
        // Flattened contrast
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                let pattern = this.basePattern(x, y, center);
                // Flatten toward middle gray
                pattern = pattern * (1.0 - value * 0.7) + 0.5 * value * 0.7;
                const gray = Math.floor(pattern * 255);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    renderCollision(ctx, value) {
        const center = this.size / 2;
        ctx.clearRect(0, 0, this.size, this.size);
        
        // Spiky pattern
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist = Math.sqrt(dx * dx + dy * dy) / center;
                const angle = Math.atan2(dy, dx);
                
                const base = this.basePattern(x, y, center);
                // Sharp spikes
                const spikes = Math.abs(Math.sin(angle * 8 + dist * 8)) * value;
                const spikesSharp = Math.pow(spikes, 0.4);
                const pattern = Math.min(1, base + spikesSharp * 0.6);
                const gray = Math.floor(pattern * 255);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    renderPhaseRisk(ctx, value) {
        const center = this.size / 2;
        ctx.clearRect(0, 0, this.size, this.size);
        
        // Interference pattern
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist1 = Math.sqrt(dx * dx + dy * dy) / center;
                const dist2 = Math.sqrt((dx - 0.3) ** 2 + (dy - 0.3) ** 2) / center;
                
                const base = this.basePattern(x, y, center);
                const interference = Math.sin(dist1 * 6) * Math.sin(dist2 * 6) * value;
                const pattern = base * (1.0 - interference * 0.5);
                const gray = Math.floor(Math.max(0, Math.min(255, pattern * 255)));
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    renderBandEnergy(ctx, low, mid, high) {
        ctx.clearRect(0, 0, this.size, this.size);
        
        // Color swatches showing frequency bands
        const bandHeight = Math.floor(this.size / 3);
        
        // Low band - warm (red/orange)
        ctx.fillStyle = `rgb(${Math.floor(220 * low)}, ${Math.floor(100 * low)}, ${Math.floor(50 * low)})`;
        ctx.fillRect(0, 0, this.size, bandHeight);
        
        // Mid band - neutral (yellow/green)
        ctx.fillStyle = `rgb(${Math.floor(180 * mid)}, ${Math.floor(200 * mid)}, ${Math.floor(120 * mid)})`;
        ctx.fillRect(0, bandHeight, this.size, bandHeight);
        
        // High band - cool (cyan/blue)
        ctx.fillStyle = `rgb(${Math.floor(50 * high)}, ${Math.floor(150 * high)}, ${Math.floor(255 * high)})`;
        ctx.fillRect(0, bandHeight * 2, this.size, this.size - bandHeight * 2);
    }
    
    update(metrics) {
        // Update all legend swatches with current metric values
        if (this.ctx.coherence) {
            this.renderCoherence(this.ctx.coherence, metrics.u_coherence || 0.7);
        }
        if (this.ctx.mud) {
            this.renderMud(this.ctx.mud, metrics.u_mud || 0.0);
        }
        if (this.ctx.harshness) {
            this.renderHarshness(this.ctx.harshness, metrics.u_harshness || 0.0);
        }
        if (this.ctx.compression) {
            this.renderCompression(this.ctx.compression, metrics.u_compression || 0.0);
        }
        if (this.ctx.collision) {
            this.renderCollision(this.ctx.collision, metrics.u_collision || 0.0);
        }
        if (this.ctx.phaseRisk) {
            this.renderPhaseRisk(this.ctx.phaseRisk, metrics.u_phaseRisk || 0.0);
        }
        if (this.ctx.bandEnergy && metrics.u_bandEnergy) {
            this.renderBandEnergy(
                this.ctx.bandEnergy,
                metrics.u_bandEnergy[0] || 0.5,
                metrics.u_bandEnergy[1] || 0.5,
                metrics.u_bandEnergy[2] || 0.5
            );
        }
    }
}
