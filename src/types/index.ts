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

  // Timing
  emanationRate: number;  // Shapes per second (instant, no interpolation)
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
  // Previously hidden metrics — now exposed for modulation routing
  lowImbalance: number;    // deviation from ideal bass ratio, detects bass drops vs sparse sections
  emptiness: number;       // fraction of silent frequency bins, detects breakdowns/intros
  panPosition: number;     // L/R panning average (stereo only), detects stereo movement
}

/** Single modulation source slot (mod-matrix ready) */
export interface ModulationSlot {
  source: keyof AudioMetrics;
  amount: number;        // 0-1, depth of modulation
  smoothing: number;     // 0-0.99, EMA smoothing factor
  invert: boolean;
  curve: number;         // power curve shaping the response (1.0 = linear)
  rangeMin: number;      // output range min (parameter space)
  rangeMax: number;      // output range max (parameter space)
}

/** Per-parameter modulation configuration */
export interface ParameterModulation {
  enabled: boolean;
  slots: ModulationSlot[];  // Multiple sources summed (mod matrix ready)
}

// Complete audio mapping for all parameters (slot-based)
export type AudioMappings = Partial<Record<keyof VisualParams, ParameterModulation>>;

/**
 * @deprecated Legacy flat mapping config — kept for preset migration only.
 * New code should use ModulationSlot / ParameterModulation.
 */
export interface LegacyAudioMappingConfig {
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

/** @deprecated Use AudioMappings instead */
export type LegacyAudioMappings = Partial<Record<keyof VisualParams, LegacyAudioMappingConfig>>;

// Blend mode for compositing
export type BlendMode = 'additive' | 'alpha' | 'multiply' | 'screen' | 'overlay';

// Preset data structure
export interface Preset {
  name: string;
  params: VisualParams;
  blendMode?: BlendMode | undefined;
  /** @deprecated Use params.emanationRate instead. Kept for migration of old presets. */
  emanationRate?: number | undefined;
  audioMappings?: AudioMappings | undefined;
  /** @deprecated Old flat-config format. Kept for migration of old presets. */
  legacyAudioMappings?: LegacyAudioMappings | undefined;
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
