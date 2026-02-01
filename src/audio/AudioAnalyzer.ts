/**
 * Audio analysis and feature extraction module
 * Handles audio input, FFT analysis, and metric computation
 */

import type { AudioMetrics } from '../types';

interface DeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
  hasLabel: boolean;
}

interface MinMax {
  min: number;
  max: number;
}

interface SmoothedMetrics {
  audioAmp: number;
  bandEnergy: [number, number, number];
  harshness: number;
  mud: number;
  compression: number;
  phaseRisk: number;
  collision: number;
  lowImbalance: number;
  emptiness: number;
  coherence: number;
  stereoWidth: [number, number, number];
  panPosition: [number, number, number];
  spatialDepth: [number, number, number];
}

interface NormalizedMetrics {
  audioAmp: number;
  bandEnergy: [number, number, number];
  harshness: number;
  mud: number;
  compression: number;
  phaseRisk?: number;
  collision: number;
  lowImbalance: number;
  emptiness: number;
  coherence: number;
  stereoWidth?: [number, number, number];
  panPosition?: [number, number, number];
  spatialDepth?: [number, number, number];
}

// Extend Window interface for webkit prefix
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private _isEnabled: boolean = false;
  private _isTabCapture: boolean = false;

  // FFT buffers
  private readonly fftSize: number = 2048;
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private prevFrequencyData: Uint8Array | null = null;

  // Stereo analysis
  private analyserLeft: AnalyserNode | null = null;
  private analyserRight: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private frequencyDataLeft: Uint8Array | null = null;
  private frequencyDataRight: Uint8Array | null = null;
  private timeDataLeft: Uint8Array | null = null;
  private timeDataRight: Uint8Array | null = null;
  private isStereo: boolean = false;

  // Smoothing factor (EMA)
  private readonly smoothingFactor: number = 0.75;

  // Smoothed metric values
  private smoothedMetrics: SmoothedMetrics = {
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
    stereoWidth: [0.0, 0.0, 0.0],
    panPosition: [0.0, 0.0, 0.0],
    spatialDepth: [0.0, 0.0, 0.0],
  };

  // Min/max normalization tracking
  private readonly minMaxWindowSize: number = 1800;
  private metricHistory: {
    audioAmp: number[];
    bandEnergy: [number[], number[], number[]];
    harshness: number[];
    mud: number[];
    compression: number[];
    phaseRisk: number[];
    collision: number[];
    lowImbalance: number[];
    emptiness: number[];
    coherence: number[];
    stereoWidth: [number[], number[], number[]];
    panPosition: [number[], number[], number[]];
    spatialDepth: [number[], number[], number[]];
  } = {
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
    spatialDepth: [[], [], []],
  };

  private minMax: {
    audioAmp: MinMax;
    bandEnergy: [MinMax, MinMax, MinMax];
    harshness: MinMax;
    mud: MinMax;
    compression: MinMax;
    phaseRisk: MinMax;
    collision: MinMax;
    lowImbalance: MinMax;
    emptiness: MinMax;
    coherence: MinMax;
    stereoWidth: [MinMax, MinMax, MinMax];
    panPosition: [MinMax, MinMax, MinMax];
    spatialDepth: [MinMax, MinMax, MinMax];
  } = {
    audioAmp: { min: 0, max: 1 },
    bandEnergy: [
      { min: 0, max: 1 },
      { min: 0, max: 1 },
      { min: 0, max: 1 },
    ],
    harshness: { min: 0, max: 1 },
    mud: { min: 0, max: 1 },
    compression: { min: 0, max: 1 },
    phaseRisk: { min: 0, max: 1 },
    collision: { min: 0, max: 1 },
    lowImbalance: { min: 0, max: 1 },
    emptiness: { min: 0, max: 1 },
    coherence: { min: 0, max: 1 },
    stereoWidth: [
      { min: 0, max: 1 },
      { min: 0, max: 1 },
      { min: 0, max: 1 },
    ],
    panPosition: [
      { min: -1, max: 1 },
      { min: -1, max: 1 },
      { min: -1, max: 1 },
    ],
    spatialDepth: [
      { min: 0, max: 1 },
      { min: 0, max: 1 },
      { min: 0, max: 1 },
    ],
  };

  private _normalizedMetrics: NormalizedMetrics | null = null;
  private needsInitialization: boolean = false;

  /**
   * Check if audio is enabled
   */
  get isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Check if capturing from a browser tab
   */
  get isCapturingTab(): boolean {
    return this._isTabCapture;
  }

  /**
   * Check if audio is in stereo mode
   */
  get isStereoMode(): boolean {
    return this.isStereo;
  }

  /**
   * Get normalized metrics
   */
  get normalizedMetrics(): NormalizedMetrics | null {
    return this._normalizedMetrics;
  }

  /**
   * Get list of available audio input devices
   */
  async getAudioDevices(requestPermission: boolean = false): Promise<DeviceInfo[]> {
    try {
      if (requestPermission) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label:
            device.label ||
            (device.deviceId ? `Audio Input (${device.deviceId.substring(0, 8)}...)` : 'Unknown Device'),
          groupId: device.groupId,
          hasLabel: Boolean(device.label),
        }));
    } catch (error) {
      console.error('Error enumerating devices:', error);
      return [];
    }
  }

  /**
   * Enable audio input and create AudioContext/AnalyserNode
   */
  async enableAudio(deviceId: string | null = null, preferStereo: boolean = true): Promise<void> {
    if (this._isEnabled) {
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass === undefined) {
        throw new Error('AudioContext not supported');
      }
      this.audioContext = new AudioContextClass();

      let constraints: MediaStreamConstraints = { audio: true };

      if (deviceId !== null) {
        constraints = {
          audio: {
            deviceId: { exact: deviceId },
          },
        };
      }

      if (preferStereo) {
        const audioConstraints: MediaTrackConstraints = deviceId !== null ? { deviceId: { exact: deviceId } } : {};
        constraints = {
          audio: {
            ...audioConstraints,
            channelCount: 2,
            sampleRate: 44100,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        };
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      const audioTracks = this.stream.getAudioTracks();
      const settings = audioTracks[0]?.getSettings();
      const channelCount = settings?.channelCount ?? 1;
      this.isStereo = channelCount >= 2;

      console.log(`Audio enabled: ${this.isStereo ? 'STEREO' : 'MONO'} (${channelCount} channels)`);

      this.source = this.audioContext.createMediaStreamSource(this.stream);

      if (this.isStereo) {
        this.setupStereoAnalysis();
      } else {
        this.setupMonoAnalysis();
      }

      this._isEnabled = true;
      this.needsInitialization = true;
    } catch (error) {
      console.error('Error enabling audio:', error);

      if (preferStereo && error instanceof Error && error.name !== 'NotAllowedError' && error.name !== 'NotFoundError') {
        console.log('Falling back to mono input...');
        return this.enableAudio(deviceId, false);
      }
      throw error;
    }
  }

  /**
   * Enable audio capture from a browser tab
   */
  async enableTabAudio(): Promise<void> {
    if (this._isEnabled) {
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass === undefined) {
        throw new Error('AudioContext not supported');
      }
      this.audioContext = new AudioContextClass();

      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Your browser does not support screen/tab capture.');
      }

      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          displaySurface: 'browser',
          width: { max: 1 },
          height: { max: 1 },
          frameRate: { max: 1 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      this.stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      const videoTracks = this.stream.getVideoTracks();
      const audioTracks = this.stream.getAudioTracks();

      if (audioTracks.length === 0) {
        videoTracks.forEach((track) => track.stop());
        this.stream = null;
        throw new Error('No audio track captured. Make sure to select "Also share tab audio".');
      }

      const settings = audioTracks[0]?.getSettings();
      const channelCount = settings?.channelCount ?? 1;
      this.isStereo = channelCount >= 2;

      console.log(`Tab audio enabled: ${this.isStereo ? 'STEREO' : 'MONO'} (${channelCount} channels)`);

      this._isTabCapture = true;
      videoTracks.forEach((track) => track.stop());

      audioTracks[0]?.addEventListener('ended', () => {
        console.log('Tab audio capture ended by user');
        this.disableAudio();
        window.dispatchEvent(new CustomEvent('tabAudioEnded'));
      });

      this.source = this.audioContext.createMediaStreamSource(this.stream);

      if (this.isStereo) {
        this.setupStereoAnalysis();
      } else {
        this.setupMonoAnalysis();
      }

      this._isEnabled = true;
      this.needsInitialization = true;
    } catch (error) {
      console.error('Error enabling tab audio:', error);

      if (this.audioContext !== null) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      throw error;
    }
  }

  private setupMonoAnalysis(): void {
    if (this.audioContext === null || this.source === null) return;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    this.source.connect(this.analyser);

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
  }

  private setupStereoAnalysis(): void {
    if (this.audioContext === null || this.source === null) return;

    this.splitter = this.audioContext.createChannelSplitter(2);
    this.source.connect(this.splitter);

    this.analyserLeft = this.audioContext.createAnalyser();
    this.analyserLeft.fftSize = this.fftSize;
    this.analyserLeft.smoothingTimeConstant = 0.8;

    this.analyserRight = this.audioContext.createAnalyser();
    this.analyserRight.fftSize = this.fftSize;
    this.analyserRight.smoothingTimeConstant = 0.8;

    this.splitter.connect(this.analyserLeft, 0);
    this.splitter.connect(this.analyserRight, 1);

    this.merger = this.audioContext.createChannelMerger(2);
    this.splitter.connect(this.merger, 0, 0);
    this.splitter.connect(this.merger, 1, 1);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.merger.connect(this.analyser);

    this.frequencyDataLeft = new Uint8Array(this.analyserLeft.frequencyBinCount);
    this.frequencyDataRight = new Uint8Array(this.analyserRight.frequencyBinCount);
    this.timeDataLeft = new Uint8Array(this.analyserLeft.fftSize);
    this.timeDataRight = new Uint8Array(this.analyserRight.fftSize);

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
  }

  /**
   * Get current audio metrics (normalized 0-1)
   */
  getMetrics(): AudioMetrics | null {
    if (!this._isEnabled || this.analyser === null || this.frequencyData === null || this.timeData === null) {
      return null;
    }

    // Update frequency and time data
    if (this.isStereo && this.analyserLeft !== null && this.analyserRight !== null) {
      if (this.frequencyDataLeft !== null && this.frequencyDataRight !== null) {
        this.analyserLeft.getByteFrequencyData(this.frequencyDataLeft as Uint8Array<ArrayBuffer>);
        this.analyserRight.getByteFrequencyData(this.frequencyDataRight as Uint8Array<ArrayBuffer>);
      }
      if (this.timeDataLeft !== null && this.timeDataRight !== null) {
        this.analyserLeft.getByteTimeDomainData(this.timeDataLeft as Uint8Array<ArrayBuffer>);
        this.analyserRight.getByteTimeDomainData(this.timeDataRight as Uint8Array<ArrayBuffer>);
      }
    }

    this.analyser.getByteFrequencyData(this.frequencyData as Uint8Array<ArrayBuffer>);
    this.analyser.getByteTimeDomainData(this.timeData as Uint8Array<ArrayBuffer>);

    // Calculate metrics
    const audioAmp = this.calculateRMS();
    const bandEnergy = this.calculateBandEnergy();
    const harshness = this.calculateHarshness();
    const mud = this.calculateMud();
    const compression = this.calculateCompression();
    const collision = this.calculateCollision();

    let phaseRisk = 0.0;
    let stereoWidth: [number, number, number] = [0.0, 0.0, 0.0];

    if (this.isStereo) {
      phaseRisk = this.calculatePhaseRisk();
      stereoWidth = this.calculateStereoWidth();
    }

    const lowImbalance = this.calculateLowImbalance(bandEnergy);
    const emptiness = this.calculateEmptiness();

    // Initialize smoothed metrics on first call
    if (this.needsInitialization) {
      this.smoothedMetrics.audioAmp = audioAmp;
      this.smoothedMetrics.bandEnergy = [...bandEnergy];
      this.smoothedMetrics.harshness = harshness;
      this.smoothedMetrics.mud = mud;
      this.smoothedMetrics.compression = compression;
      this.smoothedMetrics.collision = collision;
      this.smoothedMetrics.lowImbalance = lowImbalance;
      this.smoothedMetrics.emptiness = emptiness;
      this.needsInitialization = false;
    }

    // Calculate coherence
    let coherence = Math.max(
      0,
      Math.min(1, 1.0 - (mud * 0.25 + harshness * 0.25 + compression * 0.2 + collision * 0.2 + phaseRisk * 0.1))
    );

    if (audioAmp > 0.1 && mud < 0.3 && harshness < 0.3) {
      const boost = (1.0 - coherence) * 0.2;
      coherence = Math.min(1.0, coherence + boost);
    }

    // Apply smoothing (EMA)
    this.smoothedMetrics.audioAmp = this.smooth(this.smoothedMetrics.audioAmp, audioAmp);
    this.smoothedMetrics.bandEnergy = [
      this.smooth(this.smoothedMetrics.bandEnergy[0], bandEnergy[0]),
      this.smooth(this.smoothedMetrics.bandEnergy[1], bandEnergy[1]),
      this.smooth(this.smoothedMetrics.bandEnergy[2], bandEnergy[2]),
    ];
    this.smoothedMetrics.harshness = this.smooth(this.smoothedMetrics.harshness, harshness);
    this.smoothedMetrics.mud = this.smooth(this.smoothedMetrics.mud, mud);
    this.smoothedMetrics.compression = this.smooth(this.smoothedMetrics.compression, compression);
    this.smoothedMetrics.collision = this.smooth(this.smoothedMetrics.collision, collision);
    this.smoothedMetrics.lowImbalance = this.smooth(this.smoothedMetrics.lowImbalance, lowImbalance);
    this.smoothedMetrics.emptiness = this.smooth(this.smoothedMetrics.emptiness, emptiness);

    if (this.isStereo) {
      this.smoothedMetrics.phaseRisk = this.smooth(this.smoothedMetrics.phaseRisk, phaseRisk);
      this.smoothedMetrics.stereoWidth = [
        this.smooth(this.smoothedMetrics.stereoWidth[0], stereoWidth[0]),
        this.smooth(this.smoothedMetrics.stereoWidth[1], stereoWidth[1]),
        this.smooth(this.smoothedMetrics.stereoWidth[2], stereoWidth[2]),
      ];
    }

    this.smoothedMetrics.coherence = this.smooth(this.smoothedMetrics.coherence, coherence);

    // Update min/max and normalize
    this.updateMinMax();
    this._normalizedMetrics = this.normalizeMetrics();

    // Return metrics in the expected format
    return {
      rms: this.smoothedMetrics.audioAmp,
      bass: this.smoothedMetrics.bandEnergy[0],
      mid: this.smoothedMetrics.bandEnergy[1],
      high: this.smoothedMetrics.bandEnergy[2],
      presence: (this.smoothedMetrics.bandEnergy[1] + this.smoothedMetrics.bandEnergy[2]) / 2,
      harshness: this.smoothedMetrics.harshness,
      mud: this.smoothedMetrics.mud,
      compression: this.smoothedMetrics.compression,
      collision: this.smoothedMetrics.collision,
      coherence: this.smoothedMetrics.coherence,
      stereoWidth: (this.smoothedMetrics.stereoWidth[0] + this.smoothedMetrics.stereoWidth[1] + this.smoothedMetrics.stereoWidth[2]) / 3,
      phaseRisk: this.smoothedMetrics.phaseRisk,
    };
  }

  private smooth(current: number, target: number): number {
    return current * this.smoothingFactor + target * (1.0 - this.smoothingFactor);
  }

  private calculateRMS(): number {
    if (this.timeData === null) return 0;

    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const normalized = (this.timeData[i]! - 128) / 128.0;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / this.timeData.length);
    return Math.min(1.0, rms * 2.0);
  }

  private calculateBandEnergy(): [number, number, number] {
    if (this.frequencyData === null || this.audioContext === null) {
      return [0, 0, 0];
    }

    const binCount = this.frequencyData.length;
    const sampleRate = this.audioContext.sampleRate;
    const nyquist = sampleRate / 2;

    const lowEnd = Math.floor((20 / nyquist) * binCount);
    const lowMid = Math.floor((250 / nyquist) * binCount);
    const midHigh = Math.floor((4000 / nyquist) * binCount);

    let lowSum = 0,
      midSum = 0,
      highSum = 0;
    let lowCount = 0,
      midCount = 0,
      highCount = 0;

    for (let i = 0; i < binCount; i++) {
      const value = this.frequencyData[i]! / 255.0;

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

    return [Math.min(1.0, low), Math.min(1.0, mid), Math.min(1.0, high)];
  }

  private calculateHarshness(): number {
    const bandEnergy = this.calculateBandEnergy();
    const highEnergy = bandEnergy[2];
    const totalEnergy = bandEnergy[0] + bandEnergy[1] + bandEnergy[2];
    const highRatio = totalEnergy > 0 ? highEnergy / totalEnergy : 0;
    const harshness = (highEnergy * 0.6 + highRatio * 0.4) * 1.3;
    return Math.min(1.0, harshness);
  }

  private calculateMud(): number {
    const bandEnergy = this.calculateBandEnergy();
    const midEnergy = bandEnergy[1];
    const totalEnergy = bandEnergy[0] + bandEnergy[1] + bandEnergy[2];
    const midRatio = totalEnergy > 0 ? midEnergy / totalEnergy : 0;
    const mud = (midEnergy * 0.5 + midRatio * 0.5) * 1.2;
    return Math.min(1.0, mud);
  }

  private calculateCompression(): number {
    if (this.timeData === null) return 0;

    let peak = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const normalized = Math.abs((this.timeData[i]! - 128) / 128.0);
      peak = Math.max(peak, normalized);
    }

    const rms = this.calculateRMS();
    const crestFactor = rms > 0.01 ? peak / rms : 1.0;
    const normalizedCrest = Math.min(1.0, crestFactor / 10.0);

    return 1.0 - normalizedCrest;
  }

  private calculateCollision(): number {
    if (this.frequencyData === null) return 0;

    if (this.prevFrequencyData === null) {
      this.prevFrequencyData = new Uint8Array(this.frequencyData.length);
      return 0.0;
    }

    let flux = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      const diff = this.frequencyData[i]! - this.prevFrequencyData[i]!;
      if (diff > 0) {
        flux += diff;
      }
    }

    const normalizedFlux = Math.min(1.0, flux / (this.frequencyData.length * 50));
    this.prevFrequencyData.set(this.frequencyData);

    return normalizedFlux;
  }

  private calculateLowImbalance(bandEnergy: [number, number, number]): number {
    const lowEnergy = bandEnergy[0];
    const totalEnergy = bandEnergy[0] + bandEnergy[1] + bandEnergy[2];
    const lowRatio = totalEnergy > 0 ? lowEnergy / totalEnergy : 0;
    const idealRatio = 0.35;
    const deviation = Math.abs(lowRatio - idealRatio);
    return Math.min(1.0, deviation * 2.0);
  }

  private calculateEmptiness(): number {
    if (this.frequencyData === null) return 0;

    const threshold = 10;
    let emptyBins = 0;

    for (let i = 0; i < this.frequencyData.length; i++) {
      if (this.frequencyData[i]! < threshold) {
        emptyBins++;
      }
    }

    return emptyBins / this.frequencyData.length;
  }

  private calculatePhaseRisk(): number {
    if (!this.isStereo || this.frequencyDataLeft === null || this.frequencyDataRight === null) {
      return 0.0;
    }

    let sumL = 0,
      sumR = 0,
      sumLR = 0;

    for (let i = 0; i < this.frequencyDataLeft.length; i++) {
      const l = this.frequencyDataLeft[i]! / 255.0;
      const r = this.frequencyDataRight[i]! / 255.0;

      sumL += l * l;
      sumR += r * r;
      sumLR += l * r;
    }

    const denom = Math.sqrt(sumL * sumR);
    const correlation = denom > 0.01 ? sumLR / denom : 0;

    return Math.max(0, Math.min(1, 1.0 - correlation));
  }

  private calculateStereoWidth(): [number, number, number] {
    if (!this.isStereo || this.frequencyDataLeft === null || this.frequencyDataRight === null || this.audioContext === null) {
      return [0.0, 0.0, 0.0];
    }

    const binCount = this.frequencyDataLeft.length;
    const sampleRate = this.audioContext.sampleRate;
    const nyquist = sampleRate / 2;

    const lowEnd = Math.floor((20 / nyquist) * binCount);
    const lowMid = Math.floor((250 / nyquist) * binCount);
    const midHigh = Math.floor((4000 / nyquist) * binCount);

    const calculateBandWidth = (start: number, end: number): number => {
      let sumL = 0,
        sumR = 0,
        sumLR = 0;

      for (let i = start; i < end && i < binCount; i++) {
        const l = this.frequencyDataLeft![i]! / 255.0;
        const r = this.frequencyDataRight![i]! / 255.0;

        sumL += l * l;
        sumR += r * r;
        sumLR += l * r;
      }

      const denom = Math.sqrt(sumL * sumR);
      const correlation = denom > 0.01 ? sumLR / denom : 0;

      return Math.max(0, Math.min(1, 1.0 - correlation));
    };

    return [
      calculateBandWidth(lowEnd, lowMid),
      calculateBandWidth(lowMid, midHigh),
      calculateBandWidth(midHigh, binCount),
    ];
  }

  private updateMinMax(): void {
    // Add current smoothed values to history
    this.metricHistory.audioAmp.push(this.smoothedMetrics.audioAmp);
    this.metricHistory.harshness.push(this.smoothedMetrics.harshness);
    this.metricHistory.mud.push(this.smoothedMetrics.mud);
    this.metricHistory.compression.push(this.smoothedMetrics.compression);
    this.metricHistory.collision.push(this.smoothedMetrics.collision);
    this.metricHistory.lowImbalance.push(this.smoothedMetrics.lowImbalance);
    this.metricHistory.emptiness.push(this.smoothedMetrics.emptiness);
    this.metricHistory.coherence.push(this.smoothedMetrics.coherence);

    for (let i = 0; i < 3; i++) {
      this.metricHistory.bandEnergy[i]!.push(this.smoothedMetrics.bandEnergy[i]!);
      if (this.isStereo) {
        this.metricHistory.stereoWidth[i]!.push(this.smoothedMetrics.stereoWidth[i]!);
        this.metricHistory.panPosition[i]!.push(this.smoothedMetrics.panPosition[i]!);
        this.metricHistory.spatialDepth[i]!.push(this.smoothedMetrics.spatialDepth[i]!);
      }
    }

    if (this.isStereo) {
      this.metricHistory.phaseRisk.push(this.smoothedMetrics.phaseRisk);
    }

    // Trim history to window size
    const trimHistory = (arr: number[]): void => {
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
      trimHistory(this.metricHistory.bandEnergy[i]!);
      if (this.isStereo) {
        trimHistory(this.metricHistory.stereoWidth[i]!);
        trimHistory(this.metricHistory.panPosition[i]!);
        trimHistory(this.metricHistory.spatialDepth[i]!);
      }
    }

    if (this.isStereo) {
      trimHistory(this.metricHistory.phaseRisk);
    }

    // Update min/max with slow EMA
    const updateMinMaxForMetric = (
      history: number[],
      minMax: MinMax
    ): void => {
      if (history.length < 10) return;

      const currentMin = Math.min(...history);
      const currentMax = Math.max(...history);

      minMax.min = minMax.min * 0.99 + currentMin * 0.01;
      minMax.max = minMax.max * 0.99 + currentMax * 0.01;

      if (minMax.min >= minMax.max) {
        minMax.max = minMax.min + 0.001;
      }
    };

    updateMinMaxForMetric(this.metricHistory.audioAmp, this.minMax.audioAmp);
    updateMinMaxForMetric(this.metricHistory.harshness, this.minMax.harshness);
    updateMinMaxForMetric(this.metricHistory.mud, this.minMax.mud);
    updateMinMaxForMetric(this.metricHistory.compression, this.minMax.compression);
    updateMinMaxForMetric(this.metricHistory.collision, this.minMax.collision);
    updateMinMaxForMetric(this.metricHistory.lowImbalance, this.minMax.lowImbalance);
    updateMinMaxForMetric(this.metricHistory.emptiness, this.minMax.emptiness);
    updateMinMaxForMetric(this.metricHistory.coherence, this.minMax.coherence);

    for (let i = 0; i < 3; i++) {
      updateMinMaxForMetric(this.metricHistory.bandEnergy[i]!, this.minMax.bandEnergy[i]!);
      if (this.isStereo) {
        updateMinMaxForMetric(this.metricHistory.stereoWidth[i]!, this.minMax.stereoWidth[i]!);
        updateMinMaxForMetric(this.metricHistory.panPosition[i]!, this.minMax.panPosition[i]!);
        updateMinMaxForMetric(this.metricHistory.spatialDepth[i]!, this.minMax.spatialDepth[i]!);
      }
    }

    if (this.isStereo) {
      updateMinMaxForMetric(this.metricHistory.phaseRisk, this.minMax.phaseRisk);
    }
  }

  private normalizeMetrics(): NormalizedMetrics {
    const normalize = (value: number, min: number, max: number): number => {
      if (max <= min) return 0.5;
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };

    const result: NormalizedMetrics = {
      audioAmp: normalize(this.smoothedMetrics.audioAmp, this.minMax.audioAmp.min, this.minMax.audioAmp.max),
      bandEnergy: [
        normalize(this.smoothedMetrics.bandEnergy[0], this.minMax.bandEnergy[0].min, this.minMax.bandEnergy[0].max),
        normalize(this.smoothedMetrics.bandEnergy[1], this.minMax.bandEnergy[1].min, this.minMax.bandEnergy[1].max),
        normalize(this.smoothedMetrics.bandEnergy[2], this.minMax.bandEnergy[2].min, this.minMax.bandEnergy[2].max),
      ],
      harshness: normalize(this.smoothedMetrics.harshness, this.minMax.harshness.min, this.minMax.harshness.max),
      mud: normalize(this.smoothedMetrics.mud, this.minMax.mud.min, this.minMax.mud.max),
      compression: normalize(this.smoothedMetrics.compression, this.minMax.compression.min, this.minMax.compression.max),
      collision: normalize(this.smoothedMetrics.collision, this.minMax.collision.min, this.minMax.collision.max),
      lowImbalance: normalize(this.smoothedMetrics.lowImbalance, this.minMax.lowImbalance.min, this.minMax.lowImbalance.max),
      emptiness: normalize(this.smoothedMetrics.emptiness, this.minMax.emptiness.min, this.minMax.emptiness.max),
      coherence: normalize(this.smoothedMetrics.coherence, this.minMax.coherence.min, this.minMax.coherence.max),
    };

    if (this.isStereo) {
      result.phaseRisk = normalize(this.smoothedMetrics.phaseRisk, this.minMax.phaseRisk.min, this.minMax.phaseRisk.max);
      result.stereoWidth = [
        normalize(this.smoothedMetrics.stereoWidth[0], this.minMax.stereoWidth[0].min, this.minMax.stereoWidth[0].max),
        normalize(this.smoothedMetrics.stereoWidth[1], this.minMax.stereoWidth[1].min, this.minMax.stereoWidth[1].max),
        normalize(this.smoothedMetrics.stereoWidth[2], this.minMax.stereoWidth[2].min, this.minMax.stereoWidth[2].max),
      ];
    }

    return result;
  }

  /**
   * Get min/max for a metric
   */
  getMinMax(metricName: keyof typeof this.minMax, index?: number): MinMax {
    const metric = this.minMax[metricName];
    if (Array.isArray(metric) && index !== undefined && index >= 0 && index < metric.length) {
      const item = metric[index];
      return item !== undefined ? { ...item } : { min: 0, max: 1 };
    }
    return { ...(metric as MinMax) };
  }

  /**
   * Disable audio and clean up resources
   */
  disableAudio(): void {
    if (this.stream !== null) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.source !== null) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext !== null && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.analyserLeft = null;
    this.analyserRight = null;
    this.splitter = null;
    this.merger = null;
    this._isEnabled = false;
    this._isTabCapture = false;

    console.log('Audio disabled');
  }
}
