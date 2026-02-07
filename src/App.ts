/**
 * AudioShader Application
 * Main application state and render loop management
 */

import { Renderer, type RenderOptions } from './render/Renderer';
import { loadAllShaders } from './render/shaders';
import { ParameterInterpolator } from './render/ParameterInterpolator';
import { createDefaultParams, PARAM_RANGES, applyJiggle, randomizeParams } from './render/Parameters';
import { PresetManager } from './presets/PresetManager';
import { AudioMapper } from './audio/AudioMapper';
import type { VisualParams, AudioMetrics, RenderState, AudioMappingConfig, BlendMode } from './types';

export interface AppConfig {
  canvas: HTMLCanvasElement;
}

export class App {
  private renderer: Renderer;
  private interpolator: ParameterInterpolator;
  private presetManager: PresetManager;
  private audioMapper: AudioMapper;

  private params: VisualParams;
  private baseParams: VisualParams;
  private targetParams: VisualParams;

  private renderState: RenderState = {
    time: 0,
    frozen: false,
    recording: false,
  };

  private jiggleEnabled: boolean = false;
  private jiggleAmount: number = 0;

  // Dilation freeze - when true, expansionFactor is set to 1.0 (no dilation)
  private dilationFrozen: boolean = false;

  private blendMode: BlendMode = 'additive';
  private emanationRate: number = 2.0;  // Match lucas.html default
  private lastCaptureTime: number = 0;
  private totalRotation: number = 0;

  // Use fixed interval timing like lucas.html for consistent behavior across browsers
  private static readonly TARGET_FPS = 60;
  private static readonly FRAME_TIME = 1000 / App.TARGET_FPS;  // ~16.67ms per frame
  private intervalId: number | null = null;
  private lastFrameTime: number = 0;

  private audioMetrics: AudioMetrics | null = null;

  private onParamsChangeCallbacks: Array<(params: VisualParams) => void> = [];

  constructor(config: AppConfig) {
    this.renderer = new Renderer(config.canvas);
    this.interpolator = new ParameterInterpolator();
    this.presetManager = new PresetManager();
    this.audioMapper = new AudioMapper();

    this.params = createDefaultParams();
    this.baseParams = createDefaultParams();
    this.targetParams = createDefaultParams();
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    const shaders = await loadAllShaders();
    await this.renderer.init(
      shaders.starVertex,
      shaders.starFragment,
      shaders.dilationVertex,
      shaders.dilationFragment
    );

    // Load last used preset if available
    const lastPreset = this.presetManager.getCurrentPresetName();
    if (lastPreset !== null) {
      const preset = this.presetManager.loadPreset(lastPreset);
      if (preset !== null) {
        this.setParams(preset.params);
        this.emanationRate = preset.emanationRate ?? App.DEFAULT_EMANATION_RATE;
        if (preset.audioMappings !== undefined) {
          this.audioMapper.setMappings(preset.audioMappings);
        }
      }
    }
  }

  /**
   * Start the render loop using fixed interval timing (like lucas.html)
   */
  start(): void {
    if (this.intervalId !== null) return;
    this.lastFrameTime = performance.now();
    // Use setInterval for fixed 60fps like lucas.html - more consistent across browsers
    this.intervalId = window.setInterval(this.tick, App.FRAME_TIME);
    this.tick(); // Initial render
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Main render loop tick
   */
  private tick = (): void => {
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (!this.renderState.frozen) {
      this.update(deltaTime);
      this.render();
    }
  };

  /**
   * Update state
   */
  private update(deltaTime: number): void {
    this.renderState.time += deltaTime;

    // Update interpolation
    this.interpolator.update();

    // Apply interpolated values to params
    this.applyInterpolatedParams();

    // Apply jiggle effect
    if (this.jiggleEnabled && this.jiggleAmount > 0) {
      this.applyJiggleEffect();
    }

    // Apply audio mapping
    if (this.audioMetrics !== null) {
      const audioModifications = this.audioMapper.applyMappings(this.baseParams, this.audioMetrics);
      Object.assign(this.params, audioModifications);
    }

    // Calculate total rotation for captured shapes (matches lucas.html approach)
    // Use absolute time * speed rather than accumulating, prevents drift
    this.totalRotation = this.params.rotation + (this.renderState.time * this.params.autoRotationSpeed);
  }

  /**
   * Apply interpolated values from the interpolator
   */
  private applyInterpolatedParams(): void {
    const paramNames = Object.keys(this.params) as Array<keyof VisualParams>;

    for (const name of paramNames) {
      const value = this.interpolator.getCurrent(name);
      if (value !== null) {
        this.params[name] = value;
      }
    }
  }

  /**
   * Apply jiggle effect to all parameters
   */
  private applyJiggleEffect(): void {
    const paramNames = Object.keys(this.baseParams) as Array<keyof VisualParams>;

    for (const name of paramNames) {
      if (name === 'jiggleAmount') continue; // Don't jiggle the jiggle amount

      const range = PARAM_RANGES[name];
      this.params[name] = applyJiggle(
        this.baseParams[name],
        this.renderState.time,
        this.jiggleAmount,
        name,
        range
      );
    }
  }

  /**
   * Render the current frame
   */
  private render(): void {
    const now = this.renderState.time;
    const captureInterval = 1 / this.emanationRate;
    const shouldCaptureShape = now - this.lastCaptureTime >= captureInterval;

    if (shouldCaptureShape) {
      this.lastCaptureTime = now;
    }

    const options: RenderOptions = {
      uniforms: {
        u_time: this.renderState.time,
        u_spikiness: this.params.spikiness,
        u_spikeFrequency: this.params.spikeFrequency,
        u_spikeSharpness: this.params.spikeSharpness,
        u_hue: this.params.hue,
        u_scale: this.params.scale,
        u_rotation: this.params.rotation,
        u_autoRotationSpeed: this.params.autoRotationSpeed,
        u_blendOpacity: this.params.blendOpacity,
        u_fillSize: this.params.fillSize,
        u_fillOpacity: this.params.fillOpacity,
      },
      dilationFactor: this.dilationFrozen ? 1.0 : this.params.expansionFactor,
      shouldCaptureShape,
      fadeAmount: this.params.fadeAmount,
      hueShiftAmount: this.params.hueShiftAmount,
      emanationRate: this.emanationRate,
      noiseAmount: this.params.noiseAmount,
      noiseRate: this.params.noiseRate,
      blurAmount: this.params.blurAmount,
      blurRate: this.params.blurRate,
      rotation: this.params.rotation,
      blendMode: this.blendMode,
      blendOpacity: this.params.blendOpacity,
      autoRotationSpeed: this.params.autoRotationSpeed,
      totalRotation: this.totalRotation,
    };

    this.renderer.render(options);
  }

  /**
   * Set all parameters at once
   * @param params - Parameters to set
   * @param immediate - If true, snap to values immediately (no interpolation)
   */
  setParams(params: Partial<VisualParams>, immediate: boolean = true): void {
    Object.assign(this.params, params);
    Object.assign(this.baseParams, params);
    Object.assign(this.targetParams, params);

    // Update interpolator - snap or set targets based on immediate flag
    for (const [name, value] of Object.entries(params)) {
      if (immediate) {
        this.interpolator.snapTo(name, value as number);
      } else if (name === 'rotation') {
        this.interpolator.setTargetRotation(name, value as number);
      } else {
        this.interpolator.setTarget(name, value as number);
      }
    }

    this.notifyParamsChange();
  }

  /**
   * Set a single parameter with interpolation
   */
  setParam(name: keyof VisualParams, value: number, immediate: boolean = false): void {
    this.targetParams[name] = value;

    if (immediate) {
      this.params[name] = value;
      this.baseParams[name] = value;
      this.interpolator.snapTo(name, value);
    } else {
      if (name === 'rotation') {
        this.interpolator.setTargetRotation(name, value);
      } else {
        this.interpolator.setTarget(name, value);
      }
    }

    if (!this.jiggleEnabled) {
      this.baseParams[name] = value;
    }

    this.notifyParamsChange();
  }

  /**
   * Get current parameters
   */
  getParams(): VisualParams {
    return { ...this.params };
  }

  /**
   * Get a single parameter value
   */
  getParam(name: keyof VisualParams): number {
    return this.params[name];
  }

  /**
   * Set audio metrics for visualization
   */
  setAudioMetrics(metrics: AudioMetrics | null): void {
    this.audioMetrics = metrics;
  }

  /**
   * Enable/disable audio reactive mode
   */
  setAudioReactiveEnabled(enabled: boolean): void {
    this.audioMapper.setEnabled(enabled);
  }

  /**
   * Set audio mapping configuration for a parameter
   */
  setAudioMapping(param: keyof VisualParams, config: Partial<AudioMappingConfig>): void {
    this.audioMapper.setMapping(param, config);
  }

  /**
   * Toggle freeze state
   */
  toggleFreeze(): boolean {
    this.renderState.frozen = !this.renderState.frozen;
    return this.renderState.frozen;
  }

  /**
   * Set freeze state
   */
  setFrozen(frozen: boolean): void {
    this.renderState.frozen = frozen;
  }

  /**
   * Check if paused (render loop stopped)
   */
  isFrozen(): boolean {
    return this.renderState.frozen;
  }

  /**
   * Toggle dilation freeze (sets dilation to 1.0 = no expansion)
   * This is different from pause - the shape still updates, only dilation stops
   */
  toggleDilationFreeze(): boolean {
    this.dilationFrozen = !this.dilationFrozen;
    return this.dilationFrozen;
  }

  /**
   * Set dilation freeze state
   */
  setDilationFrozen(frozen: boolean): void {
    this.dilationFrozen = frozen;
  }

  /**
   * Check if dilation is frozen
   */
  isDilationFrozen(): boolean {
    return this.dilationFrozen;
  }

  /**
   * Check if jiggle is enabled
   */
  isJiggleEnabled(): boolean {
    return this.jiggleEnabled;
  }

  /**
   * Enable/disable jiggle
   */
  setJiggleEnabled(enabled: boolean): void {
    this.jiggleEnabled = enabled;

    if (!enabled) {
      // Preserve current values when disabling jiggle
      Object.assign(this.baseParams, this.params);
    }
  }

  /**
   * Set jiggle amount
   */
  setJiggleAmount(amount: number): void {
    this.jiggleAmount = amount;
  }

  /**
   * Get blend mode
   */
  getBlendMode(): BlendMode {
    return this.blendMode;
  }

  /**
   * Set blend mode
   */
  setBlendMode(mode: BlendMode): void {
    this.blendMode = mode;
  }

  /**
   * Get emanation rate
   */
  getEmanationRate(): number {
    return this.emanationRate;
  }

  /**
   * Set emanation rate
   */
  setEmanationRate(rate: number): void {
    this.emanationRate = rate;
  }

  /**
   * Randomize all parameters
   */
  randomize(): void {
    const newParams = randomizeParams();
    this.setParams(newParams);
  }

  /**
   * Get the preset manager
   */
  getPresetManager(): PresetManager {
    return this.presetManager;
  }

  /**
   * Get the audio mapper
   */
  getAudioMapper(): AudioMapper {
    return this.audioMapper;
  }

  /**
   * Get the interpolator
   */
  getInterpolator(): ParameterInterpolator {
    return this.interpolator;
  }

  /**
   * Get the renderer
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Get current render state
   */
  getRenderState(): RenderState {
    return { ...this.renderState };
  }

  /**
   * Register callback for parameter changes
   */
  onParamsChange(callback: (params: VisualParams) => void): () => void {
    this.onParamsChangeCallbacks.push(callback);
    return () => {
      const index = this.onParamsChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.onParamsChangeCallbacks.splice(index, 1);
      }
    };
  }

  private notifyParamsChange(): void {
    const params = this.getParams();
    this.onParamsChangeCallbacks.forEach((cb) => cb(params));
  }

  /**
   * Save current state as a preset
   */
  savePreset(name: string): void {
    this.presetManager.savePreset(
      name,
      this.params,
      this.audioMapper.getMappings(),
      this.emanationRate,
      this.blendMode
    );
  }

  // Default emanation rate used when preset doesn't specify one
  private static readonly DEFAULT_EMANATION_RATE = 30;

  /**
   * Load a preset by name
   */
  loadPreset(name: string): boolean {
    const preset = this.presetManager.loadPreset(name);
    if (preset === null) return false;

    this.setParams(preset.params);
    // Always set emanationRate - use preset value or default
    this.emanationRate = preset.emanationRate ?? App.DEFAULT_EMANATION_RATE;
    // Set blendMode from preset or default to 'additive'
    this.blendMode = preset.blendMode ?? 'additive';
    if (preset.audioMappings !== undefined) {
      this.audioMapper.setMappings(preset.audioMappings);
    }
    return true;
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.presetManager.hasUnsavedChanges(this.params);
  }
}
