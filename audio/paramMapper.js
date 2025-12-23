/**
 * Maps audio analysis metrics to sandbox visualizer parameters
 * Implements multi-band and rhythmic energy mappings
 */

class ParamMapper {
    constructor() {
        this.lastDilationSpeed = 1.0;
    }
    
    /**
     * Map audio metrics to sandbox parameters
     * Only uses: rhythmicEnergy, bandEnergy, audioAmp, tempoChange
     * Other metrics (coherence, mud, harshness, etc.) are left unwired
     * @param {Object} metrics - Audio metrics from analyzer
     * @param {Object} currentParams - Current parameter values (to preserve unwired params)
     * @returns {Object} Parameter values for sandbox renderer
     */
    mapMetricsToParams(metrics, currentParams = {}) {
        const {
            u_audioAmp,
            u_bandEnergy, // [low, mid, high]
            u_rhythmicEnergy,
            u_tempoChange,
            u_panPosition // [low, mid, high] if stereo
        } = metrics;
        
        const [lowEnergy, midEnergy, highEnergy] = u_bandEnergy;
        const totalEnergy = lowEnergy + midEnergy + highEnergy;
        
        // Determine dominant band
        const dominantBand = this.getDominantBand(lowEnergy, midEnergy, highEnergy);
        
        // Map dominant band to hue (low→high: red→blue→green→magenta→orange/yellow)
        const hue = this.mapDominantBandToHue(dominantBand, lowEnergy, midEnergy, highEnergy);
        
        // === SHAPE PARAMETERS ===
        // Only map spikeFrequency and spikiness based on bands
        const spikeFrequency = this.mapSpikeFrequency(lowEnergy, midEnergy, highEnergy);
        // Low band: rounder spikes (lower spikiness)
        // High band: more spikes and sharper (higher spikiness and sharpness)
        let spikiness = currentParams.spikiness ?? 0.5;
        if (dominantBand === 'low') {
            spikiness = Math.max(0.2, lowEnergy * 0.6); // Rounder
        } else if (dominantBand === 'high') {
            spikiness = Math.min(1.0, 0.5 + highEnergy * 0.5); // More spikes
        }
        const spikeSharpness = dominantBand === 'high' ? Math.min(1.0, highEnergy * 0.8) : (currentParams.spikeSharpness ?? 0.0);
        
        // === SCALE & SIZE ===
        const scale = Math.max(0.1, Math.min(1.0, u_audioAmp * 0.9 + 0.1));
        // Low band: larger fill size if dominant
        const fillSize = dominantBand === 'low' ? Math.max(0.5, lowEnergy * 1.5) : (currentParams.fillSize ?? 0.0);
        // Low band: opacity based on dominance
        const fillOpacity = dominantBand === 'low' ? Math.max(0.3, lowEnergy * 0.8 + 0.2) : (currentParams.fillOpacity ?? 0.6);
        
        // === COLOR ===
        const hueShiftAmount = currentParams.hueShiftAmount ?? 0.05; // Keep current or default
        
        // === EMANATION ===
        let emanationRate = Math.max(2, Math.min(200, u_audioAmp * 198 + 2));
        // High band: spike emanation rate to very high
        if (dominantBand === 'high') {
            const highEmanationRate = highEnergy * 180 + 20;
            // Use the higher of the two
            emanationRate = Math.max(emanationRate, highEmanationRate);
        }
        
        // Dilation speed with tempo change flip
        let dilationSpeed = this.mapDilationSpeed(u_rhythmicEnergy, u_tempoChange);
        // High band: bias dilation speed to high value (>1.0)
        if (dominantBand === 'high') {
            dilationSpeed = Math.max(dilationSpeed, 1.0 + highEnergy * 0.15);
        }
        
        const fadeAmount = currentParams.fadeAmount ?? 0.3; // Keep current or default
        
        // === ROTATION ===
        const autoRotationSpeed = this.mapAutoRotationSpeed(lowEnergy, highEnergy, u_rhythmicEnergy);
        const rotation = u_panPosition ? (u_panPosition[1] * 180) : (currentParams.rotation ?? 0);
        
        // === FILTERS ===
        // Mid band: noise on transients (use rhythmic energy as proxy for transients)
        const noiseAmount = dominantBand === 'mid' ? (midEnergy * u_rhythmicEnergy * 0.6) : (currentParams.noiseAmount ?? 0.0);
        const noiseRate = dominantBand === 'mid' ? (u_rhythmicEnergy * 5.0) : (currentParams.noiseRate ?? 0.0);
        const blurAmount = currentParams.blurAmount ?? 0.0; // Keep current or default
        const blurRate = currentParams.blurRate ?? 0.0; // Keep current or default
        
        // === BLEND ===
        const blendOpacity = currentParams.blendOpacity ?? 0.3; // Keep current or default
        
        return {
            spikiness,
            spikeFrequency,
            spikeSharpness,
            hue,
            scale,
            fillSize,
            fillOpacity,
            hueShiftAmount,
            emanationRate,
            dilationSpeed,
            fadeAmount,
            autoRotationSpeed,
            rotation,
            noiseAmount,
            noiseRate,
            blurAmount,
            blurRate,
            blendOpacity
        };
    }
    
    /**
     * Determine dominant frequency band
     */
    getDominantBand(lowEnergy, midEnergy, highEnergy) {
        if (lowEnergy >= midEnergy && lowEnergy >= highEnergy) return 'low';
        if (midEnergy >= highEnergy) return 'mid';
        return 'high';
    }
    
    /**
     * Map dominant band to hue
     * low→high: red→blue→green→magenta→orange/yellow
     */
    mapDominantBandToHue(dominantBand, lowEnergy, midEnergy, highEnergy) {
        const totalEnergy = lowEnergy + midEnergy + highEnergy;
        if (totalEnergy < 0.01) return 180; // Default blue-green if no energy
        
        switch (dominantBand) {
            case 'low':
                // Subbass → dark red (0-30°), Bass into mid → blue-green (150-180°)
                // Use lowEnergy directly to determine: very low = red, higher low = blue-green
                const lowIntensity = lowEnergy; // 0-1
                if (lowIntensity > 0.7) {
                    // Very strong low/sub bass → dark red (0-15°)
                    return (lowIntensity - 0.7) * 50; // 0-15°
                } else {
                    // Bass into mid → blue-green (150-180°)
                    return 150 + (0.7 - lowIntensity) * 43; // 150-180°
                }
            case 'mid':
                // Blue/green hue (180-240°)
                const midIntensity = midEnergy / totalEnergy;
                return 180 + midIntensity * 60; // 180-240°
            case 'high':
                // Magenta (lead) → orange/yellow (high hats, resonant peaks)
                const highIntensity = highEnergy / totalEnergy;
                if (highIntensity > 0.75) {
                    // Very high → orange/yellow (30-60°)
                    return 30 + (highIntensity - 0.75) * 120; // 30-60°
                } else {
                    // High → magenta (300-330°)
                    return 300 + (0.75 - highIntensity) * 120; // 300-330°
                }
            default:
                return 180; // Default blue-green
        }
    }
    
    /**
     * Map spike frequency based on bands
     * Low: rounder spikes, less frequency (2-4)
     * Mid: snappy/crunchy → more frequency (5-17)
     * High: more spikes (10-20)
     */
    mapSpikeFrequency(lowEnergy, midEnergy, highEnergy) {
        const totalEnergy = lowEnergy + midEnergy + highEnergy;
        if (totalEnergy < 0.01) return 5.0; // Default
        
        // Determine dominant band for stronger effect
        const dominantBand = this.getDominantBand(lowEnergy, midEnergy, highEnergy);
        
        // Base frequency from weighted contributions
        const lowContribution = lowEnergy * 3.0; // Low = 2-4 spikes (reduced)
        const midContribution = midEnergy * 11.0; // Mid = 5-17 spikes (snappy)
        const highContribution = highEnergy * 15.0; // High = 10-20 spikes (more spikes)
        
        let weightedFreq = (lowContribution + midContribution + highContribution) / totalEnergy;
        
        // Boost based on dominant band
        if (dominantBand === 'low') {
            // Low band: rounder, less frequency
            weightedFreq = Math.min(weightedFreq, 4.0);
        } else if (dominantBand === 'mid') {
            // Mid band: snappy/crunchy, more frequency
            weightedFreq = Math.max(weightedFreq, 8.0);
        } else if (dominantBand === 'high') {
            // High band: more spikes
            weightedFreq = Math.max(weightedFreq, 12.0);
        }
        
        return Math.max(2.0, Math.min(20.0, weightedFreq));
    }
    
    /**
     * Map dilation speed with tempo change flip
     * Uses only rhythmic energy
     */
    mapDilationSpeed(rhythmicEnergy, tempoChange) {
        // Base dilation from rhythmic energy
        // Low energy (ambient) = close to 1.0 (stable)
        // High energy (jungle) = further from 1.0 (more dynamic)
        let baseDilation = 1.0;
        
        // Rhythmic energy affects: high energy = more dynamic (away from 1.0)
        baseDilation += (rhythmicEnergy - 0.5) * 0.15; // Range: ~0.925 to 1.075
        
        // Clamp to valid range
        baseDilation = Math.max(0.88, Math.min(1.22, baseDilation));
        
        // Handle tempo change flip
        if (tempoChange) {
            if (this.lastDilationSpeed < 1.0) {
                // Flip from contracting to expanding
                baseDilation = 1.0 + (1.0 - this.lastDilationSpeed);
            } else if (this.lastDilationSpeed > 1.0) {
                // Flip from expanding to contracting
                baseDilation = 1.0 - (this.lastDilationSpeed - 1.0);
            }
        }
        
        this.lastDilationSpeed = baseDilation;
        return baseDilation;
    }
    
    /**
     * Map auto rotation speed based on band balance and rhythmic energy
     * Acceleration/deceleration parameters: low energy = slow, high energy = fast
     */
    mapAutoRotationSpeed(lowEnergy, highEnergy, rhythmicEnergy) {
        // Low vs high balance affects rotation direction
        const energyDiff = lowEnergy - highEnergy; // -1 to 1
        const baseRotation = energyDiff * 180; // -180 to 180
        
        // Rhythmic energy scales the rotation speed
        // Low rhythmic energy (ambient) = slow rotation, maybe even negative
        // High rhythmic energy (jungle) = fast rotation
        const scaledRotation = baseRotation * (0.3 + rhythmicEnergy * 0.7);
        
        return Math.max(-90, Math.min(360, scaledRotation));
    }
}

export default ParamMapper;

