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
        this.isTabCapture = false;  // True when capturing from browser tab

        // FFT buffer
        this.fftSize = 2048;
        this.frequencyData = null;
        this.timeData = null;
        this.prevFrequencyData = null; // For spectral flux calculation
        
        // Stereo analysis
        this.analyserLeft = null;
        this.analyserRight = null;
        this.splitter = null;
        this.merger = null;
        this.frequencyDataLeft = null;
        this.frequencyDataRight = null;
        this.timeDataLeft = null;
        this.timeDataRight = null;
        this.isStereo = false;
        
        // Smoothing (EMA) factors - reduced for more responsiveness
        this.smoothingFactor = 0.85; // More responsive to changes
        
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
            emptiness: 0.0,
            coherence: 1.0,
            // Spatial metrics (v2)
            stereoWidth: [0.0, 0.0, 0.0],  // [low, mid, high]
            panPosition: [0.0, 0.0, 0.0],   // [low, mid, high] (-1 to 1)
            spatialDepth: [0.0, 0.0, 0.0]   // [low, mid, high] (0-1)
        };
        
        // Min/max normalization tracking
        this.minMaxWindowSize = 1800; // ~30 seconds at 60fps
        this.metricHistory = {
            audioAmp: [],
            bandEnergy: [[], [], []],
            harshness: [],
            mud: [],
            compression: [],
            phaseRisk: [],
            collision: [],
            lowImbalance: [],
            emptiness: [],
            coherence: [],
            stereoWidth: [[], [], []],
            panPosition: [[], [], []],
            spatialDepth: [[], [], []]
        };
        this.minMax = {
            audioAmp: { min: 0, max: 1 },
            bandEnergy: [{ min: 0, max: 1 }, { min: 0, max: 1 }, { min: 0, max: 1 }],
            harshness: { min: 0, max: 1 },
            mud: { min: 0, max: 1 },
            compression: { min: 0, max: 1 },
            phaseRisk: { min: 0, max: 1 },
            collision: { min: 0, max: 1 },
            lowImbalance: { min: 0, max: 1 },
            emptiness: { min: 0, max: 1 },
            coherence: { min: 0, max: 1 },
            stereoWidth: [{ min: 0, max: 1 }, { min: 0, max: 1 }, { min: 0, max: 1 }],
            panPosition: [{ min: -1, max: 1 }, { min: -1, max: 1 }, { min: -1, max: 1 }],
            spatialDepth: [{ min: 0, max: 1 }, { min: 0, max: 1 }, { min: 0, max: 1 }]
        };
        this.normalizedMetrics = null; // Will store normalized values
    }
    
    /**
     * Get list of available audio input devices
     * @param {boolean} requestPermission - If true, request mic permission first (shows prompt)
     * @returns {Promise<Array>} Array of device info objects
     */
    async getAudioDevices(requestPermission = false) {
        try {
            // Only request permission if explicitly asked
            // This avoids showing a mic prompt when user just wants to see device list
            // or when they're going to use tab capture instead
            if (requestPermission) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    // Without permission, labels may be empty - show placeholder
                    label: device.label || (device.deviceId ? `Audio Input (${device.deviceId.substring(0, 8)}...)` : 'Unknown Device'),
                    groupId: device.groupId,
                    hasLabel: !!device.label  // Track if we have the real label
                }));

            return audioDevices;
        } catch (error) {
            console.error('Error enumerating devices:', error);
            return [];
        }
    }
    
    /**
     * Enable audio input and create AudioContext/AnalyserNode
     * Attempts to get stereo input if available, falls back to mono
     * @param {string|null} deviceId - Specific device ID to use, or null for default
     * @param {boolean} preferStereo - Try to get stereo input if true
     * @returns {Promise<void>}
     */
    async enableAudio(deviceId = null, preferStereo = true) {
        if (this.isEnabled) {
            return;
        }
        
        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Build constraints
            let constraints = { audio: true };
            if (deviceId) {
                // Use specific device
                constraints = {
                    audio: {
                        deviceId: { exact: deviceId }
                    }
                };
            }
            
            if (preferStereo) {
                // Add stereo request to constraints
                if (deviceId) {
                    constraints.audio = {
                        ...constraints.audio,
                        channelCount: 2,
                        sampleRate: 44100,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    };
                } else {
                    constraints = {
                        audio: {
                            channelCount: 2,
                            sampleRate: 44100,
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    };
                }
            }
            
            console.log('Requesting audio with constraints:', constraints);
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Check if we got stereo
            const audioTracks = this.stream.getAudioTracks();
            const settings = audioTracks[0]?.getSettings();
            const channelCount = settings?.channelCount || 1;
            this.isStereo = channelCount >= 2;
            
            console.log(`Audio enabled: ${this.isStereo ? 'STEREO' : 'MONO'} (${channelCount} channels)`);
            console.log('Audio track settings:', settings);
            console.log('Audio track label:', audioTracks[0]?.label);
            
            // Check if we're actually getting audio data
            this.checkAudioLevel();
            
            // Connect stream to audio graph
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            
            if (this.isStereo) {
                // Set up stereo analysis
                this.setupStereoAnalysis();
            } else {
                // Set up mono analysis (fallback)
                this.setupMonoAnalysis();
            }
            
            this.isEnabled = true;
            
            // Mark that we need to initialize smoothed metrics on first getMetrics() call
            // This will set them to the first calculated values for immediate response
            this._needsInitialization = true;
        } catch (error) {
            console.error('Error enabling audio:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            
            // Fallback to mono if stereo fails
            if (preferStereo && error.name !== 'NotAllowedError' && error.name !== 'NotFoundError') {
                console.log('Falling back to mono input...');
                return this.enableAudio(deviceId, false);
            }
            throw error;
        }
    }

    /**
     * Enable audio capture from a browser tab using getDisplayMedia
     * This allows capturing audio from YouTube, Spotify Web, etc.
     * @returns {Promise<void>}
     */
    async enableTabAudio() {
        if (this.isEnabled) {
            return;
        }

        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Check browser support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Your browser does not support screen/tab capture. Please use Chrome or Edge.');
            }

            // Request screen/tab capture with audio
            // The user will be prompted to select a tab
            // Note: Chrome shows "Share tab audio" checkbox only for Tab selection, not Window/Screen
            const displayMediaOptions = {
                video: {
                    displaySurface: "browser",  // Prefer browser tab
                    width: { max: 1 },  // Minimize video (we only want audio)
                    height: { max: 1 },
                    frameRate: { max: 1 }
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2,
                    sampleRate: 44100
                },
                preferCurrentTab: false,
                selfBrowserSurface: "include",
                systemAudio: "include",
                surfaceSwitching: "include",
                monitorTypeSurfaces: "exclude"  // Exclude monitor to encourage tab selection
            };

            console.log('Requesting tab audio capture...');
            console.log('TIP: Select a TAB (not window/screen) and check "Also share tab audio"');

            this.stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

            // Log what we got
            const videoTracks = this.stream.getVideoTracks();
            const audioTracks = this.stream.getAudioTracks();

            console.log('Capture result:', {
                videoTracks: videoTracks.length,
                audioTracks: audioTracks.length,
                videoLabel: videoTracks[0]?.label,
                audioLabel: audioTracks[0]?.label
            });

            // Check if we got audio tracks
            if (audioTracks.length === 0) {
                // Clean up video track before throwing
                videoTracks.forEach(track => track.stop());
                this.stream = null;

                // Provide browser-specific guidance
                const isChrome = navigator.userAgent.includes('Chrome');
                const isFirefox = navigator.userAgent.includes('Firefox');
                const isEdge = navigator.userAgent.includes('Edg');

                let hint = '';
                if (isChrome || isEdge) {
                    hint = '\n\nIn Chrome/Edge:\n1. Click "Chrome Tab" at the top of the dialog\n2. Select a tab that is playing audio\n3. Check "Also share tab audio" at the bottom\n4. Click Share';
                } else if (isFirefox) {
                    hint = '\n\nFirefox has limited tab audio support. Try using Chrome or Edge for best results.';
                }

                throw new Error('No audio track captured.' + hint);
            }

            const settings = audioTracks[0]?.getSettings();
            const channelCount = settings?.channelCount || 1;
            this.isStereo = channelCount >= 2;

            console.log(`Tab audio enabled: ${this.isStereo ? 'STEREO' : 'MONO'} (${channelCount} channels)`);
            console.log('Audio track settings:', settings);
            console.log('Audio track label:', audioTracks[0]?.label);

            // Mark as tab capture mode
            this.isTabCapture = true;

            // Stop video track - we only need audio
            videoTracks.forEach(track => track.stop());

            // Handle track ending (user stops sharing)
            audioTracks[0].addEventListener('ended', () => {
                console.log('Tab audio capture ended by user');
                this.disableAudio();
                // Dispatch event so UI can update
                window.dispatchEvent(new CustomEvent('tabAudioEnded'));
            });

            // Connect stream to audio graph
            this.source = this.audioContext.createMediaStreamSource(this.stream);

            if (this.isStereo) {
                this.setupStereoAnalysis();
            } else {
                this.setupMonoAnalysis();
            }

            this.isEnabled = true;
            this._needsInitialization = true;

            // Check audio levels
            this.checkAudioLevel();

        } catch (error) {
            console.error('Error enabling tab audio:', error);

            // Clean up on error
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }

            if (error.name === 'NotAllowedError') {
                throw new Error('Tab capture was cancelled or denied. Please try again and select a tab with audio.');
            }

            throw error;
        }
    }

    /**
     * Check if audio is actually coming through (for debugging)
     */
    checkAudioLevel() {
        if (!this.analyser) {
            // Create temporary analyser to check levels
            const tempAnalyser = this.audioContext.createAnalyser();
            tempAnalyser.fftSize = 2048;
            const tempSource = this.audioContext.createMediaStreamSource(this.stream);
            tempSource.connect(tempAnalyser);
            
            const tempData = new Uint8Array(tempAnalyser.frequencyBinCount);
            
            setTimeout(() => {
                tempAnalyser.getByteFrequencyData(tempData);
                const max = Math.max(...tempData);
                const avg = tempData.reduce((a, b) => a + b, 0) / tempData.length;
                console.log(`Audio level check - Max: ${max}, Avg: ${avg.toFixed(2)}`);
                
                if (max < 5 && avg < 1) {
                    console.warn('⚠️ Very low or no audio signal detected! Check your input device and volume.');
                } else {
                    console.log('✓ Audio signal detected');
                }
                
                tempSource.disconnect();
            }, 500);
        }
    }
    
    setupMonoAnalysis() {
        // Create single AnalyserNode for mono
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.8;
        
        this.source.connect(this.analyser);
        
        // Initialize buffers
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.fftSize);
    }
    
    setupStereoAnalysis() {
        // Create channel splitter to separate L/R
        this.splitter = this.audioContext.createChannelSplitter(2);
        this.source.connect(this.splitter);
        
        // Create analysers for left and right channels
        this.analyserLeft = this.audioContext.createAnalyser();
        this.analyserLeft.fftSize = this.fftSize;
        this.analyserLeft.smoothingTimeConstant = 0.8;
        
        this.analyserRight = this.audioContext.createAnalyser();
        this.analyserRight.fftSize = this.fftSize;
        this.analyserRight.smoothingTimeConstant = 0.8;
        
        // Connect splitter outputs to analysers
        // Channel 0 = left, Channel 1 = right
        this.splitter.connect(this.analyserLeft, 0);
        this.splitter.connect(this.analyserRight, 1);
        
        // Also create merged analyser for combined analysis
        this.merger = this.audioContext.createChannelMerger(2);
        this.splitter.connect(this.merger, 0, 0);
        this.splitter.connect(this.merger, 1, 1);
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.8;
        this.merger.connect(this.analyser);
        
        // Initialize buffers
        this.frequencyDataLeft = new Uint8Array(this.analyserLeft.frequencyBinCount);
        this.frequencyDataRight = new Uint8Array(this.analyserRight.frequencyBinCount);
        this.timeDataLeft = new Uint8Array(this.analyserLeft.fftSize);
        this.timeDataRight = new Uint8Array(this.analyserRight.fftSize);
        
        // Combined buffers (for backward compatibility)
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.fftSize);
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
        if (this.isStereo) {
            // Update stereo channels
            this.analyserLeft.getByteFrequencyData(this.frequencyDataLeft);
            this.analyserRight.getByteFrequencyData(this.frequencyDataRight);
            this.analyserLeft.getByteTimeDomainData(this.timeDataLeft);
            this.analyserRight.getByteTimeDomainData(this.timeDataRight);
            
            // Also update combined for backward compatibility
            this.analyser.getByteFrequencyData(this.frequencyData);
            this.analyser.getByteTimeDomainData(this.timeData);
        } else {
            // Mono analysis
            this.analyser.getByteFrequencyData(this.frequencyData);
            this.analyser.getByteTimeDomainData(this.timeData);
        }
        
        // Debug: Log audio levels occasionally (every 60 frames ~1 second at 60fps)
        if (!this._debugFrameCount) this._debugFrameCount = 0;
        this._debugFrameCount++;
        if (this._debugFrameCount % 60 === 0) {
            const maxFreq = Math.max(...this.frequencyData);
            const avgFreq = this.frequencyData.reduce((a, b) => a + b, 0) / this.frequencyData.length;
            if (maxFreq < 5 && avgFreq < 1) {
                console.warn('⚠️ No audio signal detected! Check device selection and volume.');
            }
        }
        
        // Calculate metrics from audio data
        const audioAmp = this.calculateRMS();
        const bandEnergy = this.calculateBandEnergy();
        const harshness = this.calculateHarshness();
        const mud = this.calculateMud();
        const compression = this.calculateCompression();
        const collision = this.calculateCollision();
        
        // Note: We'll initialize smoothed metrics after all calculations are done
        
        // Debug: Log raw values occasionally
        if (!this._debugCalcCount) this._debugCalcCount = 0;
        this._debugCalcCount++;
        if (this._debugCalcCount % 60 === 0) {
            console.log('Raw calculated values:', {
                audioAmp: audioAmp.toFixed(3),
                bandEnergy: bandEnergy.map(v => v.toFixed(3)),
                harshness: harshness.toFixed(3),
                mud: mud.toFixed(3),
                compression: compression.toFixed(3),
                collision: collision.toFixed(3),
                maxFreq: Math.max(...this.frequencyData),
                avgFreq: (this.frequencyData.reduce((a, b) => a + b, 0) / this.frequencyData.length).toFixed(2)
            });
        }
        
        // Calculate spatial metrics if stereo
        let phaseRisk = 0.0;
        let stereoWidth = [0.0, 0.0, 0.0];
        let panPosition = [0.0, 0.0, 0.0];
        let spatialDepth = [0.0, 0.0, 0.0];
        
        if (this.isStereo) {
            phaseRisk = this.calculatePhaseRisk();
            stereoWidth = this.calculateStereoWidth();
            panPosition = this.calculatePanPosition();
            spatialDepth = this.calculateSpatialDepth();
        }
        
        const lowImbalance = this.calculateLowImbalance(bandEnergy);
        const emptiness = this.calculateEmptiness();
        
        // Initialize smoothed metrics to first calculated values for immediate response
        if (this._needsInitialization) {
            this.smoothedMetrics.audioAmp = audioAmp;
            this.smoothedMetrics.bandEnergy = [...bandEnergy];
            this.smoothedMetrics.harshness = harshness;
            this.smoothedMetrics.mud = mud;
            this.smoothedMetrics.compression = compression;
            this.smoothedMetrics.collision = collision;
            this.smoothedMetrics.lowImbalance = lowImbalance;
            this.smoothedMetrics.emptiness = emptiness;
            this._needsInitialization = false;
            console.log('✓ Initialized smoothed metrics to first calculated values');
        }
        
        // Calculate coherence as inverse of problems
        // More sensitive weighting for better visual response
        let coherence = Math.max(0, Math.min(1, 1.0 - (
            mud * 0.25 +
            harshness * 0.25 +
            compression * 0.2 +
            collision * 0.2 +
            phaseRisk * 0.1
        )));
        
        // Boost coherence when audio is present and clean
        if (audioAmp > 0.1 && mud < 0.3 && harshness < 0.3) {
            const boost = (1.0 - coherence) * 0.2;
            coherence = Math.min(1.0, coherence + boost);
        }
        
        // Apply smoothing (EMA) - but use less smoothing for faster response
        // Use adaptive smoothing: less smoothing when values are changing quickly
        const smoothingFactor = 0.75; // More responsive (was 0.85)
        
        this.smoothedMetrics.audioAmp = this.smooth(this.smoothedMetrics.audioAmp, audioAmp, smoothingFactor);
        this.smoothedMetrics.bandEnergy = [
            this.smooth(this.smoothedMetrics.bandEnergy[0], bandEnergy[0], smoothingFactor),
            this.smooth(this.smoothedMetrics.bandEnergy[1], bandEnergy[1], smoothingFactor),
            this.smooth(this.smoothedMetrics.bandEnergy[2], bandEnergy[2], smoothingFactor)
        ];
        this.smoothedMetrics.harshness = this.smooth(this.smoothedMetrics.harshness, harshness, smoothingFactor);
        this.smoothedMetrics.mud = this.smooth(this.smoothedMetrics.mud, mud, smoothingFactor);
        this.smoothedMetrics.compression = this.smooth(this.smoothedMetrics.compression, compression, smoothingFactor);
        this.smoothedMetrics.collision = this.smooth(this.smoothedMetrics.collision, collision, smoothingFactor);
        this.smoothedMetrics.lowImbalance = this.smooth(this.smoothedMetrics.lowImbalance, lowImbalance, smoothingFactor);
        this.smoothedMetrics.emptiness = this.smooth(this.smoothedMetrics.emptiness, emptiness, smoothingFactor);
        
        // Smooth spatial metrics if stereo
        if (this.isStereo) {
            this.smoothedMetrics.phaseRisk = this.smooth(this.smoothedMetrics.phaseRisk, phaseRisk, smoothingFactor);
            this.smoothedMetrics.stereoWidth = [
                this.smooth(this.smoothedMetrics.stereoWidth[0], stereoWidth[0], smoothingFactor),
                this.smooth(this.smoothedMetrics.stereoWidth[1], stereoWidth[1], smoothingFactor),
                this.smooth(this.smoothedMetrics.stereoWidth[2], stereoWidth[2], smoothingFactor)
            ];
            this.smoothedMetrics.panPosition = [
                this.smooth(this.smoothedMetrics.panPosition[0], panPosition[0], smoothingFactor),
                this.smooth(this.smoothedMetrics.panPosition[1], panPosition[1], smoothingFactor),
                this.smooth(this.smoothedMetrics.panPosition[2], panPosition[2], smoothingFactor)
            ];
            this.smoothedMetrics.spatialDepth = [
                this.smooth(this.smoothedMetrics.spatialDepth[0], spatialDepth[0], smoothingFactor),
                this.smooth(this.smoothedMetrics.spatialDepth[1], spatialDepth[1], smoothingFactor),
                this.smooth(this.smoothedMetrics.spatialDepth[2], spatialDepth[2], smoothingFactor)
            ];
        }
        
        // Smooth coherence separately (it's calculated from other metrics)
        const smoothedCoherence = this.smooth(
            this.smoothedMetrics.coherence || coherence,
            coherence,
            smoothingFactor
        );
        this.smoothedMetrics.coherence = smoothedCoherence;
        
        // Update min/max normalization
        this.updateMinMax();
        
        // Normalize metrics based on min/max
        this.normalizedMetrics = this.normalizeMetrics();
        
        const result = {
            u_audioAmp: this.smoothedMetrics.audioAmp,
            u_bandEnergy: this.smoothedMetrics.bandEnergy,
            u_harshness: this.smoothedMetrics.harshness,
            u_mud: this.smoothedMetrics.mud,
            u_compression: this.smoothedMetrics.compression,
            u_phaseRisk: this.isStereo ? this.smoothedMetrics.phaseRisk : 0.0,
            u_collision: this.smoothedMetrics.collision,
            u_lowImbalance: this.smoothedMetrics.lowImbalance,
            u_emptiness: this.smoothedMetrics.emptiness,
            u_coherence: smoothedCoherence
        };
        
        // Add spatial metrics if stereo
        if (this.isStereo) {
            result.u_stereoWidth = this.smoothedMetrics.stereoWidth;
            result.u_panPosition = this.smoothedMetrics.panPosition;
            result.u_spatialDepth = this.smoothedMetrics.spatialDepth;
        }
        
        return result;
    }
    
    /**
     * Smooth a value using exponential moving average
     * @param {number} current - Current smoothed value
     * @param {number} target - Target value to smooth towards
     * @param {number} factor - Smoothing factor (0-1), defaults to this.smoothingFactor
     */
    smooth(current, target, factor = null) {
        const smoothing = factor !== null ? factor : this.smoothingFactor;
        return current * smoothing + target * (1.0 - smoothing);
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
        
        // More sensitive harshness calculation - amplify high frequency presence
        const harshness = (highEnergy * 0.6 + highRatio * 0.4) * 1.3; // Amplify by 30%
        return Math.min(1.0, harshness);
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
        
        // More sensitive mud detection - amplify when mid dominates
        const mud = (midEnergy * 0.5 + midRatio * 0.5) * 1.2; // Amplify by 20%
        return Math.min(1.0, mud);
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
     * Calculate phase risk using stereo correlation
     * Only works with stereo input
     */
    calculatePhaseRisk() {
        if (!this.isStereo || !this.frequencyDataLeft || !this.frequencyDataRight) return 0.0;
        
        // Calculate correlation between L/R channels
        // Low correlation = phase issues
        let correlation = 0.0;
        let sumL = 0, sumR = 0, sumLR = 0;
        let count = 0;
        
        for (let i = 0; i < this.frequencyDataLeft.length; i++) {
            const l = this.frequencyDataLeft[i] / 255.0;
            const r = this.frequencyDataRight[i] / 255.0;
            
            sumL += l * l;
            sumR += r * r;
            sumLR += l * r;
            count++;
        }
        
        const denom = Math.sqrt(sumL * sumR);
        if (denom > 0.01) {
            correlation = sumLR / denom;
        }
        
        // Phase risk is inverse of correlation
        // Low correlation (near 0) = high phase risk
        // High correlation (near 1) = low phase risk
        return Math.max(0, Math.min(1, 1.0 - correlation));
    }
    
    /**
     * Calculate stereo width per frequency band
     * Returns [low, mid, high] width (0 = mono, 1 = wide stereo)
     */
    calculateStereoWidth() {
        if (!this.isStereo || !this.frequencyDataLeft || !this.frequencyDataRight) return [0.0, 0.0, 0.0];
        
        const binCount = this.frequencyDataLeft.length;
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        
        // Define frequency bands
        const lowEnd = Math.floor((20 / nyquist) * binCount);
        const lowMid = Math.floor((250 / nyquist) * binCount);
        const midHigh = Math.floor((4000 / nyquist) * binCount);
        
        const calculateBandWidth = (start, end) => {
            let correlation = 0.0;
            let sumL = 0, sumR = 0, sumLR = 0;
            let count = 0;
            
            for (let i = start; i < end && i < binCount; i++) {
                const l = this.frequencyDataLeft[i] / 255.0;
                const r = this.frequencyDataRight[i] / 255.0;
                
                sumL += l * l;
                sumR += r * r;
                sumLR += l * r;
                count++;
            }
            
            if (count > 0) {
                const denom = Math.sqrt(sumL * sumR);
                if (denom > 0.01) {
                    correlation = sumLR / denom;
                }
            }
            
            // Width = 1 - correlation (mono = 0, wide = 1)
            return Math.max(0, Math.min(1, 1.0 - correlation));
        };
        
        return [
            calculateBandWidth(lowEnd, lowMid),      // Low
            calculateBandWidth(lowMid, midHigh),     // Mid
            calculateBandWidth(midHigh, binCount)      // High
        ];
    }
    
    /**
     * Calculate pan position per frequency band
     * Returns [low, mid, high] pan (-1 = left, 0 = center, 1 = right)
     */
    calculatePanPosition() {
        if (!this.isStereo || !this.frequencyDataLeft || !this.frequencyDataRight) return [0.0, 0.0, 0.0];
        
        const binCount = this.frequencyDataLeft.length;
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        
        // Define frequency bands
        const lowEnd = Math.floor((20 / nyquist) * binCount);
        const lowMid = Math.floor((250 / nyquist) * binCount);
        const midHigh = Math.floor((4000 / nyquist) * binCount);
        
        const calculateBandPan = (start, end) => {
            let sumL = 0, sumR = 0;
            let count = 0;
            
            for (let i = start; i < end && i < binCount; i++) {
                sumL += this.frequencyDataLeft[i];
                sumR += this.frequencyDataRight[i];
                count++;
            }
            
            if (count === 0) return 0.0;
            
            const total = sumL + sumR;
            if (total < 1) return 0.0;
            
            // Pan: -1 (all left) to 1 (all right)
            const pan = (sumR - sumL) / total;
            return Math.max(-1, Math.min(1, pan));
        };
        
        return [
            calculateBandPan(lowEnd, lowMid),      // Low
            calculateBandPan(lowMid, midHigh),     // Mid
            calculateBandPan(midHigh, binCount)    // High
        ];
    }
    
    /**
     * Calculate spatial depth per frequency band
     * Uses phase relationships and reverb cues
     * Returns [low, mid, high] depth (0 = front, 1 = back)
     */
    calculateSpatialDepth() {
        if (!this.isStereo || !this.frequencyDataLeft || !this.frequencyDataRight) return [0.0, 0.0, 0.0];
        
        // Simplified depth calculation based on:
        // - Phase differences (delayed signals = further back)
        // - Energy distribution (more diffuse = further back)
        
        const binCount = this.frequencyDataLeft.length;
        const sampleRate = this.audioContext.sampleRate;
        const nyquist = sampleRate / 2;
        
        // Define frequency bands
        const lowEnd = Math.floor((20 / nyquist) * binCount);
        const lowMid = Math.floor((250 / nyquist) * binCount);
        const midHigh = Math.floor((4000 / nyquist) * binCount);
        
        const calculateBandDepth = (start, end) => {
            // Use correlation as depth proxy
            // Lower correlation can indicate more reverb/depth
            let sumL = 0, sumR = 0, sumLR = 0;
            let count = 0;
            
            for (let i = start; i < end && i < binCount; i++) {
                const l = this.frequencyDataLeft[i] / 255.0;
                const r = this.frequencyDataRight[i] / 255.0;
                
                sumL += l * l;
                sumR += r * r;
                sumLR += l * r;
                count++;
            }
            
            if (count === 0) return 0.0;
            
            const denom = Math.sqrt(sumL * sumR);
            if (denom < 0.01) return 0.0;
            
            const correlation = sumLR / denom;
            
            // Depth: inverse correlation (more diffuse = deeper)
            // But also consider energy level (quiet = further back)
            const avgEnergy = (sumL + sumR) / (2 * count);
            const depth = (1.0 - correlation) * 0.7 + (1.0 - avgEnergy) * 0.3;
            
            return Math.max(0, Math.min(1, depth));
        };
        
        return [
            calculateBandDepth(lowEnd, lowMid),      // Low
            calculateBandDepth(lowMid, midHigh),     // Mid
            calculateBandDepth(midHigh, binCount)     // High
        ];
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
            u_coherence: 1.0,                   // Overall coherence (inverse of problems)
            // Spatial metrics (v2) - placeholder values
            u_stereoWidth: [0.0, 0.0, 0.0],    // [low, mid, high] width
            u_panPosition: [0.0, 0.0, 0.0],     // [low, mid, high] pan (-1 to 1)
            u_spatialDepth: [0.0, 0.0, 0.0]     // [low, mid, high] depth (0-1)
        };
    }
    
    /**
     * Update min/max tracking for normalization
     */
    updateMinMax() {
        // Add current smoothed values to history
        this.metricHistory.audioAmp.push(this.smoothedMetrics.audioAmp);
        this.metricHistory.harshness.push(this.smoothedMetrics.harshness);
        this.metricHistory.mud.push(this.smoothedMetrics.mud);
        this.metricHistory.compression.push(this.smoothedMetrics.compression);
        this.metricHistory.collision.push(this.smoothedMetrics.collision);
        this.metricHistory.lowImbalance.push(this.smoothedMetrics.lowImbalance);
        this.metricHistory.emptiness.push(this.smoothedMetrics.emptiness);
        this.metricHistory.coherence.push(this.smoothedMetrics.coherence);
        
        // Array metrics
        for (let i = 0; i < 3; i++) {
            this.metricHistory.bandEnergy[i].push(this.smoothedMetrics.bandEnergy[i]);
            if (this.isStereo) {
                this.metricHistory.stereoWidth[i].push(this.smoothedMetrics.stereoWidth[i]);
                this.metricHistory.panPosition[i].push(this.smoothedMetrics.panPosition[i]);
                this.metricHistory.spatialDepth[i].push(this.smoothedMetrics.spatialDepth[i]);
            }
        }
        
        if (this.isStereo) {
            this.metricHistory.phaseRisk.push(this.smoothedMetrics.phaseRisk);
        }
        
        // Trim history to window size
        const trimHistory = (arr) => {
            if (arr.length > this.minMaxWindowSize) {
                arr.shift();
            }
        };
        
        trimHistory(this.metricHistory.audioAmp);
        trimHistory(this.metricHistory.harshness);
        trimHistory(this.metricHistory.mud);
        trimHistory(this.metricHistory.compression);
        trimHistory(this.metricHistory.collision);
        trimHistory(this.metricHistory.lowImbalance);
        trimHistory(this.metricHistory.emptiness);
        trimHistory(this.metricHistory.coherence);
        
        for (let i = 0; i < 3; i++) {
            trimHistory(this.metricHistory.bandEnergy[i]);
            if (this.isStereo) {
                trimHistory(this.metricHistory.stereoWidth[i]);
                trimHistory(this.metricHistory.panPosition[i]);
                trimHistory(this.metricHistory.spatialDepth[i]);
            }
        }
        
        if (this.isStereo) {
            trimHistory(this.metricHistory.phaseRisk);
        }
        
        // Update min/max with slow EMA to adapt gradually
        const updateMinMaxForMetric = (metricName, isArray = false, index = null) => {
            const history = isArray ? this.metricHistory[metricName][index] : this.metricHistory[metricName];
            if (history.length < 10) return; // Need some data
            
            const currentMin = Math.min(...history);
            const currentMax = Math.max(...history);
            
            const minMax = isArray ? this.minMax[metricName][index] : this.minMax[metricName];
            
            // Slow EMA for min/max (0.99 = very slow adaptation)
            minMax.min = minMax.min * 0.99 + currentMin * 0.01;
            minMax.max = minMax.max * 0.99 + currentMax * 0.01;
            
            // Ensure min < max
            if (minMax.min >= minMax.max) {
                minMax.max = minMax.min + 0.001;
            }
        };
        
        updateMinMaxForMetric('audioAmp');
        updateMinMaxForMetric('harshness');
        updateMinMaxForMetric('mud');
        updateMinMaxForMetric('compression');
        updateMinMaxForMetric('collision');
        updateMinMaxForMetric('lowImbalance');
        updateMinMaxForMetric('emptiness');
        updateMinMaxForMetric('coherence');
        
        for (let i = 0; i < 3; i++) {
            updateMinMaxForMetric('bandEnergy', true, i);
            if (this.isStereo) {
                updateMinMaxForMetric('stereoWidth', true, i);
                updateMinMaxForMetric('panPosition', true, i);
                updateMinMaxForMetric('spatialDepth', true, i);
            }
        }
        
        if (this.isStereo) {
            updateMinMaxForMetric('phaseRisk');
        }
    }
    
    /**
     * Normalize metrics based on min/max
     * Returns normalized values (0-1 for most metrics)
     */
    normalizeMetrics() {
        const normalize = (value, min, max) => {
            if (max <= min) return 0.5;
            return Math.max(0, Math.min(1, (value - min) / (max - min)));
        };
        
        const result = {
            audioAmp: normalize(this.smoothedMetrics.audioAmp, this.minMax.audioAmp.min, this.minMax.audioAmp.max),
            bandEnergy: [
                normalize(this.smoothedMetrics.bandEnergy[0], this.minMax.bandEnergy[0].min, this.minMax.bandEnergy[0].max),
                normalize(this.smoothedMetrics.bandEnergy[1], this.minMax.bandEnergy[1].min, this.minMax.bandEnergy[1].max),
                normalize(this.smoothedMetrics.bandEnergy[2], this.minMax.bandEnergy[2].min, this.minMax.bandEnergy[2].max)
            ],
            harshness: normalize(this.smoothedMetrics.harshness, this.minMax.harshness.min, this.minMax.harshness.max),
            mud: normalize(this.smoothedMetrics.mud, this.minMax.mud.min, this.minMax.mud.max),
            compression: normalize(this.smoothedMetrics.compression, this.minMax.compression.min, this.minMax.compression.max),
            collision: normalize(this.smoothedMetrics.collision, this.minMax.collision.min, this.minMax.collision.max),
            lowImbalance: normalize(this.smoothedMetrics.lowImbalance, this.minMax.lowImbalance.min, this.minMax.lowImbalance.max),
            emptiness: normalize(this.smoothedMetrics.emptiness, this.minMax.emptiness.min, this.minMax.emptiness.max),
            coherence: normalize(this.smoothedMetrics.coherence, this.minMax.coherence.min, this.minMax.coherence.max)
        };
        
        if (this.isStereo) {
            result.phaseRisk = normalize(this.smoothedMetrics.phaseRisk, this.minMax.phaseRisk.min, this.minMax.phaseRisk.max);
            result.stereoWidth = [
                normalize(this.smoothedMetrics.stereoWidth[0], this.minMax.stereoWidth[0].min, this.minMax.stereoWidth[0].max),
                normalize(this.smoothedMetrics.stereoWidth[1], this.minMax.stereoWidth[1].min, this.minMax.stereoWidth[1].max),
                normalize(this.smoothedMetrics.stereoWidth[2], this.minMax.stereoWidth[2].min, this.minMax.stereoWidth[2].max)
            ];
            result.panPosition = [
                normalize((this.smoothedMetrics.panPosition[0] + 1) / 2, (this.minMax.panPosition[0].min + 1) / 2, (this.minMax.panPosition[0].max + 1) / 2),
                normalize((this.smoothedMetrics.panPosition[1] + 1) / 2, (this.minMax.panPosition[1].min + 1) / 2, (this.minMax.panPosition[1].max + 1) / 2),
                normalize((this.smoothedMetrics.panPosition[2] + 1) / 2, (this.minMax.panPosition[2].min + 1) / 2, (this.minMax.panPosition[2].max + 1) / 2)
            ];
            result.spatialDepth = [
                normalize(this.smoothedMetrics.spatialDepth[0], this.minMax.spatialDepth[0].min, this.minMax.spatialDepth[0].max),
                normalize(this.smoothedMetrics.spatialDepth[1], this.minMax.spatialDepth[1].min, this.minMax.spatialDepth[1].max),
                normalize(this.smoothedMetrics.spatialDepth[2], this.minMax.spatialDepth[2].min, this.minMax.spatialDepth[2].max)
            ];
        }
        
        return result;
    }
    
    /**
     * Get current min/max values for a metric
     * @param {string} metricName - Name of the metric
     * @param {number} index - Optional index for array metrics
     * @returns {Object} {min, max} object
     */
    getMinMax(metricName, index = null) {
        if (index !== null) {
            return { ...this.minMax[metricName][index] };
        }
        return { ...this.minMax[metricName] };
    }
    
    /**
     * Get normalized metric value
     * @param {string} metricName - Name of the metric
     * @param {number} index - Optional index for array metrics
     * @returns {number} Normalized value (0-1)
     */
    getNormalizedMetric(metricName, index = null) {
        if (!this.normalizedMetrics) return 0.5;
        if (index !== null) {
            return this.normalizedMetrics[metricName][index];
        }
        return this.normalizedMetrics[metricName];
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
        this.isTabCapture = false;
        console.log('Audio disabled');
    }
}
