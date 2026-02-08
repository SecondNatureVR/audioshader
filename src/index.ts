/**
 * AudioShader - Audio-reactive WebGL Visualizer
 *
 * Main exports for the library
 */

// Types
export type {
  VisualParams,
  AudioMetrics,
  ModulationSlot,
  ParameterModulation,
  AudioMappings,
  LegacyAudioMappingConfig,
  LegacyAudioMappings,
  Preset,
  RenderState,
  BlendMode,
} from './types';

// Rendering
export { Renderer } from './render/Renderer';
export type { RenderOptions } from './render/Renderer';
export { ParameterInterpolator } from './render/ParameterInterpolator';
export type { EasingType } from './render/ParameterInterpolator';
export {
  DEFAULT_PARAMS,
  PARAM_RANGES,
  createDefaultParams,
  mergeParams,
  clampParam,
  randomizeParams,
  applyJiggle,
  dilationSpeedToFactor,
  dilationFactorToSpeed,
} from './render/Parameters';
export { loadShader, loadAllShaders } from './render/shaders';
export type { ShaderSources } from './render/shaders';

// Audio
export { AudioAnalyzer } from './audio/AudioAnalyzer';
export {
  AudioMapper,
  createDefaultSlot,
  createDefaultModulation,
  migrateLegacyMapping,
  migrateLegacyMappings,
  DEFAULT_AUDIO_SOURCES,
  ALL_MAPPABLE_PARAMS,
} from './audio/AudioMapper';

// Presets
export { PresetManager } from './presets/PresetManager';
export {
  getDefaultPresets,
  getDefaultPresetsMap,
  migrateOldPreset,
  migrateOldLocalStorage,
} from './presets/defaultPresets';

// Mapping utilities
export {
  CurveMapper,
  getDefaultCurveSettings,
  getParamDefaultSettings,
  mapNormalizedValue,
  mapSliderToValue,
  reverseMapToNormalized,
  reverseMapValueToSlider,
  PARAM_CURVE_DEFAULTS,
  DilationMapping,
  FadeMapping,
  EffectAmountMapping,
  EffectRateMapping,
  RotationSpeedMapping,
} from './mapping/CurveMapping';
export type { CurveSettings } from './mapping/CurveMapping';

// Capture utilities
export { takeSnapshot, GifRecorder, ScreenRecorder } from './capture/Capture';
export type { CaptureConfig } from './capture/Capture';

// Configuration
export {
  RESOLUTIONS,
  ResolutionManager,
  getResolutionFromUrl,
  setResolutionInUrl,
  getCanvasDimensions,
  getResolutionDisplayString,
  getAspectRatio,
  fitWithinContainer,
} from './config/Resolution';
export type { ResolutionConfig, ResolutionKey } from './config/Resolution';

// Application
export { App } from './App';
export type { AppConfig } from './App';
