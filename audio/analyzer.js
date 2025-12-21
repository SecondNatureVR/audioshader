/**
 * Audio analysis and feature extraction module
 * Responsibilities:
 * - Creates and manages AudioContext and AnalyserNode
 * - Handles getUserMedia audio stream connection
 * - Performs FFT analysis on audio data
 * - Computes audio metrics (coherence, mud, harshness, compression, phaseRisk, collision, etc.)
 * - Applies smoothing (EMA) to metrics to reduce jitter
 * - Exports normalized metric values (0-1) for shader uniforms
 */

class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.stream = null;
        this.isEnabled = false;
        
        // FFT buffer
        this.fftSize = 2048;
        this.frequencyData = null;
        this.timeData = null;
        this.prevFrequencyData = null; // For spectral flux calculation
        
        // Smoothing (EMA) factors
        this.smoothingFactor = 0.9;
        
        // Smoothed metric values
        this.smoothedMetrics = {
            audioAmp: 0.0,
            bandEnergy: [0.0, 0.0, 0.0],
            harshness: 0.0,
            mud: 0.0,
            compression: 0.0,
            phaseRisk: 0.0,
            collision: 0.0,
            lowImbalance: 0.0,
            emptiness: 0.0
        };
    }
    
    /**
     * Enable audio input and create AudioContext/AnalyserNode
     * @returns {Promise<void>}
     */
    async enableAudio() {
        if (this.isEnabled) {
            return;
        }
        
        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create AnalyserNode
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Get user media (microphone input)
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Connect stream to analyser
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);
            
            // Initialize frequency and time data buffers
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeData = new Uint8Array(this.analyser.fftSize);
            
            this.isEnabled = true;
            console.log('Audio enabled');
        } catch (error) {
            console.error('Error enabling audio:', error);
            throw error;
        }
    }
    
    /**
     * Get current audio metrics (normalized 0-1)
     * @returns {Object} Metrics object with all required values
     */
    getMetrics() {
        if (!this.isEnabled || !this.analyser) {
            // Return placeholder values when audio is not enabled
            return this.getPlaceholderMetrics();
        }
        
        // Update frequency and time data
        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeData);
        
        // Calculate metrics from audio data
        const audioAmp = this.calculateRMS();
        const bandEnergy = this.calculateBandEnergy();
        const harshness = this.calculateHarshness();
        const mud = this.calculateMud();
        const compression = this.calculateCompression();
        const collision = this.calculateCollision();
        const phaseRisk = 0.0; // Placeholder - requires stereo analysis
        const lowImbalance = this.calculateLowImbalance(bandEnergy);
        const emptiness = this.calculateEmptiness();
        
        // Calculate coherence as inverse of problems
        const coherence = Math.max(0, Math.min(1, 1.0 - (
            mud * 0.3 +
            harshness * 0.25 +
            compression * 0.2 +
            collision * 0.15 +
            phaseRisk * 0.1
        )));
        
        // Apply smoothing (EMA)
        this.smoothedMetrics.audioAmp = this.smooth(this.smoothedMetrics.audioAmp, audioAmp);
        this.smoothedMetrics.bandEnergy = [
            this.smooth(this.smoothedMetrics.bandEnergy[0], bandEnergy[0]),
            this.smooth(this.smoothedMetrics.bandEnergy[1], bandEnergy[1]),
            this.smooth(this.smoothedMetrics.bandEnergy[2], bandEnergy[2])
        ];
        this.smoothedMetrics.harshness = this.smooth(this.smoothedMetrics.harshness, harshness);
        this.smoothedMetrics.mud = this.smooth(this.smoothedMetrics.mud, mud);
        this.smoothedMetrics.compression = this.smooth(this.smoothedMetrics.compression, compression);
        this.smoothedMetrics.collision = this.smooth(this.smoothedMetrics.collision, collision);
        this.smoothedMetrics.lowImbalance = this.smooth(this.smoothedMetrics.lowImbalance, lowImbalance);
        this.smoothedMetrics.emptiness = this.smooth(this.smoothedMetrics.emptiness, emptiness);
        
        return {
            u_audioAmp: this.smoothedMetrics.audioAmp,
            u_bandEnergy: this.smoothedMetrics.bandEnergy,
            u_harshness: this.smoothedMetrics.harshness,
            u_mud: this.smoothedMetrics.mud,
            u_compression: this.smoothedMetrics.compression,
            u_phaseRisk: phaseRisk,
            u_collision: this.smoothedMetrics.collision,
            u_lowImbalance: this.smoothedMetrics.lowImbalance,
            u_emptiness: this.smoothedMetrics.emptiness,
            u_coherence: coherence
        };
    }
    
    /**
     * Smooth a value using exponential moving average
     */
    smooth(current, target) {
        return current * this.smoothingFactor + target * (1.0 - this.smoothingFactor);
    }
    
    /**
     * Calculate RMS (Root Mean Square) amplitude from time domain data
     */
    calculateRMS() {
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            const normalized = (this.timeData[i] - 128) / 128.0;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / this.timeData.length);
        return Math.min(1.0, rms * 2.0); // Scale and clamp
    }
    
    /**
     * Calculate band energy (low/mid/high) from frequency data
     */
    calculateBandEnergy() {
        const binCount = this.frequencyData.length;
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        
        // Define frequency bands (approximate)
        // Low: 20-250 Hz, Mid: 250-4000 Hz, High: 4000-20000 Hz
        const lowEnd = Math.floor((20 / nyquist) * binCount);
        const lowMid = Math.floor((250 / nyquist) * binCount);
        const midHigh = Math.floor((4000 / nyquist) * binCount);
        
        let lowSum = 0, midSum = 0, highSum = 0;
        let lowCount = 0, midCount = 0, highCount = 0;
        
        for (let i = 0; i < binCount; i++) {
            const value = this.frequencyData[i] / 255.0;
            
            if (i >= lowEnd && i < lowMid) {
                lowSum += value;
                lowCount++;
            } else if (i >= lowMid && i < midHigh) {
                midSum += value;
                midCount++;
            } else if (i >= midHigh) {
                highSum += value;
                highCount++;
            }
        }
        
        const low = lowCount > 0 ? lowSum / lowCount : 0;
        const mid = midCount > 0 ? midSum / midCount : 0;
        const high = highCount > 0 ? highSum / highCount : 0;
        
        // Normalize to 0-1 range
        return [
            Math.min(1.0, low),
            Math.min(1.0, mid),
            Math.min(1.0, high)
        ];
    }
    
    /**
     * Calculate harshness (high frequency energy + spectral flatness proxy)
     */
    calculateHarshness() {
        const bandEnergy = this.calculateBandEnergy();
        const highEnergy = bandEnergy[2];
        
        // Add spectral flatness proxy (how evenly distributed energy is)
        // High harshness = high energy concentrated in high frequencies
        // Simple proxy: ratio of high to total energy
        const totalEnergy = bandEnergy[0] + bandEnergy[1] + bandEnergy[2];
        const highRatio = totalEnergy > 0 ? highEnergy / totalEnergy : 0;
        
        // Combine high energy and high ratio
        return Math.min(1.0, (highEnergy * 0.7 + highRatio * 0.3));
    }
    
    /**
     * Calculate mud (midrange masking/overcrowding)
     */
    calculateMud() {
        const bandEnergy = this.calculateBandEnergy();
        const midEnergy = bandEnergy[1];
        
        // Mud is high when midrange is crowded relative to other bands
        const totalEnergy = bandEnergy[0] + bandEnergy[1] + bandEnergy[2];
        const midRatio = totalEnergy > 0 ? midEnergy / totalEnergy : 0;
        
        // High mud = high mid energy and high mid ratio
        return Math.min(1.0, (midEnergy * 0.6 + midRatio * 0.4));
    }
    
    /**
     * Calculate compression (loss of dynamic contrast)
     * Proxy: 1 - normalized crest factor (peak vs RMS)
     */
    calculateCompression() {
        // Find peak in time domain
        let peak = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            const normalized = Math.abs((this.timeData[i] - 128) / 128.0);
            peak = Math.max(peak, normalized);
        }
        
        const rms = this.calculateRMS();
        
        // Crest factor = peak / RMS (higher = more dynamic)
        // Compression = inverse of normalized crest factor
        const crestFactor = rms > 0.01 ? peak / rms : 1.0;
        const normalizedCrest = Math.min(1.0, crestFactor / 10.0); // Normalize (10 is typical max)
        
        return 1.0 - normalizedCrest;
    }
    
    /**
     * Calculate collision (transient overlap / spectral flux spikes)
     */
    calculateCollision() {
        // Store previous frequency data for flux calculation
        if (!this.prevFrequencyData) {
            this.prevFrequencyData = new Uint8Array(this.frequencyData.length);
            return 0.0;
        }
        
        // Calculate spectral flux (change in frequency spectrum)
        let flux = 0;
        for (let i = 0; i < this.frequencyData.length; i++) {
            const diff = this.frequencyData[i] - this.prevFrequencyData[i];
            if (diff > 0) {
                flux += diff;
            }
        }
        
        // Normalize flux
        const normalizedFlux = Math.min(1.0, flux / (this.frequencyData.length * 50));
        
        // Update previous data
        this.prevFrequencyData.set(this.frequencyData);
        
        return normalizedFlux;
    }
    
    /**
     * Calculate low-end imbalance
     */
    calculateLowImbalance(bandEnergy) {
        const lowEnergy = bandEnergy[0];
        const totalEnergy = bandEnergy[0] + bandEnergy[1] + bandEnergy[2];
        
        // Imbalance: either too much or too little low end
        const lowRatio = totalEnergy > 0 ? lowEnergy / totalEnergy : 0;
        
        // Ideal low ratio is around 0.3-0.4, deviation from this is imbalance
        const idealRatio = 0.35;
        const deviation = Math.abs(lowRatio - idealRatio);
        
        return Math.min(1.0, deviation * 2.0);
    }
    
    /**
     * Calculate emptiness (spectral gaps)
     */
    calculateEmptiness() {
        // Count how many frequency bins are below threshold
        const threshold = 10; // Low threshold
        let emptyBins = 0;
        
        for (let i = 0; i < this.frequencyData.length; i++) {
            if (this.frequencyData[i] < threshold) {
                emptyBins++;
            }
        }
        
        return emptyBins / this.frequencyData.length;
    }
    
    /**
     * Get placeholder normalized metrics (0-1)
     * These are dummy values for testing the visual system
     * @returns {Object} Metrics object
     */
    getPlaceholderMetrics() {
        // Placeholder values - all normalized 0-1
        return {
            u_audioAmp: 0.5,                    // RMS envelope
            u_bandEnergy: [0.5, 0.5, 0.5],      // [low, mid, high]
            u_harshness: 0.0,                   // High frequency harshness
            u_mud: 0.0,                         // Midrange masking
            u_compression: 0.0,                // Dynamic compression
            u_phaseRisk: 0.0,                   // Phase cancellation risk
            u_collision: 0.0,                   // Transient collisions
            u_lowImbalance: 0.0,                // Low-end imbalance
            u_emptiness: 0.0,                   // Spectral gaps
            u_coherence: 1.0                    // Overall coherence (inverse of problems)
        };
    }
    
    /**
     * Disable audio and clean up
     */
    disableAudio() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.analyser = null;
        this.isEnabled = false;
        console.log('Audio disabled');
    }
}
