/**
 * Core type definitions for AudioShader
 */

// Resolution configuration
export interface Resolution {
  width: number | null;
  height: number | null;
  name: string;
}

export type ResolutionKey = '4k' | 'pc' | 'mobile' | 'window';

export type ResolutionConfig = Record<ResolutionKey, Resolution>;

// Visual parameters for the shader
export interface VisualParams {
  // Shape parameters
  spikiness: number;
  spikeFrequency: number;
  spikeSharpness: number;
  scale: number;
  rotation: number;
  autoRotationSpeed: number;
  hue: number;
  blendOpacity: number;
  fillSize: number;
  fillOpacity: number;

  // Dilation/emanation effect parameters
  expansionFactor: number;
  fadeAmount: number;
  hueShiftAmount: number;
  noiseAmount: number;
  noiseRate: number;
  blurAmount: number;
  blurRate: number;

  // Jiggle effect
  jiggleAmount: number;
}

// Audio metrics from the analyzer
export interface AudioMetrics {
  rms: number;
  bass: number;
  mid: number;
  high: number;
  presence: number;
  harshness: number;
  mud: number;
  compression: number;
  collision: number;
  coherence: number;
  stereoWidth: number;
  phaseRisk: number;
}

// Audio mapping configuration for a single parameter
export interface AudioMappingConfig {
  enabled: boolean;
  source: keyof AudioMetrics;
  sensitivity: number;
  smoothing: number;
  multiplier: number;
  offset: number;
  invert: boolean;
  minValue: number;
  maxValue: number;
}

// Complete audio mapping for all parameters
export type AudioMappings = Partial<Record<keyof VisualParams, AudioMappingConfig>>;

// Preset data structure
export interface Preset {
  name: string;
  params: VisualParams;
  emanationRate?: number | undefined;
  audioMappings?: AudioMappings | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

// Curve settings for parameter mapping
export interface CurveSettings {
  min: number;
  max: number;
  power: number;
  type: 'power' | 'bezier';
}

// Interpolation state for smooth parameter changes
export interface InterpolationState {
  target: number;
  current: number;
  velocity: number;
}

// Easing function type
export type EasingFunction = (t: number) => number;

// Interpolation configuration
export interface InterpolationConfig {
  springStrength: number;
  springDamping: number;
  easingFunction: EasingFunction;
  transitionDuration: number;
}

// WebGL program references
export interface ShaderPrograms {
  shape: WebGLProgram;
  dilation: WebGLProgram;
}

// Framebuffer references for ping-pong rendering
export interface FramebufferSet {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
}

// Render state
export interface RenderState {
  time: number;
  frozen: boolean;
  recording: boolean;
}

// Audio capture mode
export type AudioCaptureMode = 'microphone' | 'tab' | 'none';

// Audio device info
export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}
