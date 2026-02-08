/**
 * UI Controller
 * Handles all DOM interactions for the AudioShader UI
 */

import type { VisualParams, AudioMetrics, BlendMode } from '../types';
import {
  CurveMapper,
  getParamDefaultSettings,
  resolveSliderToParamValue,
  resolveParamToSliderValue,
  formatParamValue as formatParamValueFn,
  type CurveSettings,
} from '../mapping/CurveMapping';
import type { App } from '../App';
import type { AudioAnalyzer } from '../audio/AudioAnalyzer';
import { AudioMapper } from '../audio/AudioMapper';
import { takeSnapshot, GifRecorder } from '../capture/Capture';
import { type ResolutionKey, getResolutionDisplayString } from '../config/Resolution';
import { parseNumericValue, calculateAdjustedRange } from './valueUtils';
import { getParamLabel } from '../config/paramLabels';
import type { ParamChangeEventDetail, CurveEditRequestEventDetail } from '../components/types';
import type { ParamSlider } from '../components/param-slider/ParamSlider';

export interface JiggleSettings {
  enabled: Record<keyof VisualParams, boolean>;
  amount: number;
}

export interface UIControllerConfig {
  app: App;
  audioAnalyzer?: AudioAnalyzer;
  onParamChange?: (name: keyof VisualParams, value: number) => void;
  onBlendModeChange?: (mode: BlendMode) => void;
  onEmanationRateChange?: (rate: number) => void;
  onPresetLoad?: (name: string) => void;
  onPresetSave?: (name: string) => void;
  onResolutionChange?: (resolution: ResolutionKey) => void;
}

// Jiggle-enabled parameters
const JIGGLE_PARAMS: (keyof VisualParams)[] = [
  'spikiness', 'spikeFrequency', 'spikeSharpness',
  'hue', 'scale', 'fillSize', 'fillOpacity',
  'expansionFactor', 'fadeAmount',
  'noiseAmount', 'noiseRate', 'blurAmount', 'blurRate',
  'autoRotationSpeed', 'hueShiftAmount', 'blendOpacity',
];

export class UIController {
  private app: App;
  private audioAnalyzer: AudioAnalyzer | null;
  private config: UIControllerConfig;

  // DOM element references
  private devToolbox: HTMLElement | null = null;
  private hotkeyLegend: HTMLElement | null = null;
  private curveEditorDrawer: HTMLElement | null = null;
  private currentCurveControlGroup: HTMLElement | null = null;

  // Slider references
  private sliders: Map<string, HTMLInputElement> = new Map();
  private valueDisplays: Map<string, HTMLElement> = new Map();

  // Track if device select handler has been set up
  private deviceSelectHandlerSetup: boolean = false;

  // Curve editor state
  private curveMapper: CurveMapper;
  private currentCurveParam: string | null = null;

  // Recording state
  private gifRecorder: GifRecorder | null = null;

  // Jiggle settings
  private jiggleSettings: JiggleSettings = {
    enabled: {} as Record<keyof VisualParams, boolean>,
    amount: 0.3,
  };

  // Preset state
  private currentPresetName: string | null = null;
  private presetNames: string[] = [];

  // UI visibility
  private uiVisible: boolean = true;

  constructor(config: UIControllerConfig) {
    this.config = config;
    this.app = config.app;
    this.audioAnalyzer = config.audioAnalyzer ?? null;
    this.curveMapper = new CurveMapper();

    // Initialize jiggle settings - all enabled by default
    for (const param of JIGGLE_PARAMS) {
      this.jiggleSettings.enabled[param] = true;
    }
  }

  /**
   * Initialize the UI controller
   */
  init(): void {
    this.cacheElements();
    this.setupComponentListeners();
    this.setupSliders();
    this.setupPresetControls();
    this.setupResolutionControls();
    this.setupInterpolationControls();
    this.setupJiggleControls();
    this.setupAudioControls();
    this.setupCurveEditor();
    this.setupCollapsibleSections();
    this.setupRecorders();
    this.setupKeyboardShortcuts();
    
    // Defer slider updates until after components are connected to DOM
    // Use setTimeout to ensure Lit components are fully upgraded and connected
    setTimeout(() => {
      this.updateAllSliders();
    }, 0);
  }

  /**
   * Cache frequently accessed DOM elements
   */
  private cacheElements(): void {
    this.devToolbox = document.getElementById('dev-toolbox');
    this.hotkeyLegend = document.getElementById('hotkey-legend');
    this.curveEditorDrawer = document.getElementById('curve-editor-drawer');
  }

  /**
   * Setup event listeners for Lit web components
   * Allows incremental migration from vanilla HTML to components
   */
  private setupComponentListeners(): void {
    // Listen for param-change events from <param-slider> components
    document.addEventListener('param-change', (e: CustomEvent<ParamChangeEventDetail>) => {
      const { paramName, value, source } = e.detail;

      let paramValue: number;
      
      if (source === 'slider') {
        // Slider input: apply curve mapping to convert slider position to parameter value
        paramValue = this.sliderToParamValue(paramName, value);
      } else {
        // Direct input: use the exact value entered by user
        paramValue = value;
        
        // Expand curve range if needed (after setting the exact value)
        // This ensures the range includes the value, but we keep the exact value
        this.adjustSliderRange(paramName, paramValue);
      }

      // Set the parameter to the exact value (not expanded)
      // Use immediate=true for direct input to avoid interpolation delay
      // For slider input, use immediate=false to allow smooth interpolation
      const immediate = source === 'input';
      this.app.setParam(paramName as keyof VisualParams, paramValue, immediate);
      
      // For ParamSlider components, update the component's value and slider position
      // Use synchronous update for slider source to keep display in sync during dragging
      if (this.isParamSliderComponent(paramName)) {
        const component = document.querySelector<ParamSlider>(`param-slider[param-name="${paramName}"]`);
        if (component !== null && component.isConnected) {
          // Set value synchronously so the display updates immediately
          component.value = paramValue;
          if (source !== 'slider') {
            // For direct input, also recalculate slider position
            const sliderPos = this.paramToSliderValue(paramName, paramValue);
            component.setSliderPosition(sliderPos);
          }
        }
      } else {
        // Legacy HTML sliders - update value display
        this.updateValueDisplay(paramName, paramValue);
      }
      
      this.config.onParamChange?.(paramName as keyof VisualParams, paramValue);
    });

    // Listen for curve-edit-request events from <param-slider> components
    document.addEventListener('curve-edit-request', (e: CustomEvent<CurveEditRequestEventDetail>) => {
      this.openCurveEditor(e.detail.paramName);
    });
  }

  /**
   * Setup all parameter sliders
   * Note: Migrated sliders (using <param-slider>) are handled by setupComponentListeners
   */
  private setupSliders(): void {
    // Shape sliders
    // 'spikiness' is migrated to <param-slider> component
    this.setupParamSlider('spikeFrequency', 2, 20, 0.1);
    this.setupParamSlider('spikeSharpness', 0, 100, 1);

    // Appearance sliders
    this.setupParamSlider('hue', 0, 360, 1);
    this.setupParamSlider('scale', 0.05, 1, 0.01);
    this.setupParamSlider('fillSize', 0, 100, 1);
    this.setupParamSlider('fillOpacity', 0, 100, 1);
    this.setupParamSlider('blendOpacity', 0, 100, 1);

    // Emanation sliders
    this.setupParamSlider('expansionFactor', 0, 200, 1);
    this.setupParamSlider('fadeAmount', 0, 100, 1);
    this.setupEmanationRateSlider();

    // Filter sliders
    this.setupParamSlider('noiseAmount', 0, 100, 1);
    this.setupParamSlider('noiseRate', 0, 100, 1);
    this.setupParamSlider('blurAmount', 0, 100, 1);
    this.setupParamSlider('blurRate', 0, 100, 1);

    // Rotation sliders
    this.setupParamSlider('rotation', 0, 360, 1);
    this.setupParamSlider('autoRotationSpeed', 0, 200, 1);

    // Effects sliders
    this.setupParamSlider('hueShiftAmount', 0, 100, 1);

    // Blend mode select
    this.setupBlendModeSelect();
  }

  /**
   * Setup a single parameter slider
   */
  private setupParamSlider(
    paramName: string,
    _min: number,
    _max: number,
    _step: number
  ): void {
    const sliderId = `${this.camelToKebab(paramName)}-slider`;
    const valueId = `${this.camelToKebab(paramName)}-value`;
    const slider = document.getElementById(sliderId) as HTMLInputElement | null;
    const valueDisplay = document.getElementById(valueId);

    if (slider === null) return;

    this.sliders.set(paramName, slider);
    if (valueDisplay !== null) {
      this.valueDisplays.set(paramName, valueDisplay);
    }

    slider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const rawSliderValue = parseFloat(target.value);
      
      // Normalize slider value to 0-100 range for curve mapping
      // HTML sliders may have different min/max (e.g., min=2, max=20)
      // but curve mapping functions always expect 0-100
      const sliderMin = parseFloat(target.min) || 0;
      const sliderMax = parseFloat(target.max) || 100;
      const normalizedSliderValue = sliderMin === sliderMax 
        ? 50 // Avoid division by zero
        : ((rawSliderValue - sliderMin) / (sliderMax - sliderMin)) * 100;
      
      const paramValue = this.sliderToParamValue(paramName, normalizedSliderValue);

      this.app.setParam(paramName as keyof VisualParams, paramValue);
      this.updateValueDisplay(paramName, paramValue);
      this.config.onParamChange?.(paramName as keyof VisualParams, paramValue);
    });

    // Setup editable value display
    if (valueDisplay !== null) {
      this.setupEditableValue(valueDisplay, paramName);
    }

    // Setup curve button - it's in the label which is a sibling of control-row
    // Structure: .control-group > label > .curve-btn, .control-group > .control-row > input
    const controlGroup = slider.closest('.control-group');
    const curveBtn = controlGroup?.querySelector('.curve-btn');
    if (curveBtn !== undefined && curveBtn !== null) {
      curveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openCurveEditor(paramName);
      });
    }
  }

  /**
   * Setup emanation rate slider
   *
   * emanationRate is now part of VisualParams but uses instant interpolation
   * (duration=0 via ParameterInterpolator overrides). This setup is kept
   * separate because the HTML slider uses a legacy layout.
   */
  private setupEmanationRateSlider(): void {
    const slider = document.getElementById('emanation-rate-slider') as HTMLInputElement | null;
    const valueDisplay = document.getElementById('emanation-rate-value');

    if (slider === null) return;

    slider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const rate = parseFloat(target.value);
      this.app.setParam('emanationRate', rate, true);
      if (valueDisplay !== null) {
        valueDisplay.textContent = rate.toFixed(1);
      }
      this.config.onEmanationRateChange?.(rate);
    });

    // Setup editable value display for direct input
    if (valueDisplay !== null) {
      this.setupGenericEditableValue(
        valueDisplay,
        slider,
        (rate) => {
          this.app.setParam('emanationRate', rate, true);
          this.config.onEmanationRateChange?.(rate);
        },
        (v) => v.toFixed(1)
      );
    }

    // Setup curve button for emanation rate
    const controlGroup = slider.closest('.control-group');
    const curveBtn = controlGroup?.querySelector('.curve-btn');
    if (curveBtn !== undefined && curveBtn !== null) {
      curveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openCurveEditor('emanationRate');
      });
    }
  }

  /**
   * Setup blend mode select
   */
  private setupBlendModeSelect(): void {
    const select = document.getElementById('blend-mode-select') as HTMLSelectElement | null;
    if (select === null) return;

    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const mode = target.value as BlendMode;
      this.app.setBlendMode(mode);
      this.config.onBlendModeChange?.(mode);
    });
  }

  /**
   * Setup editable value display
   */
  private setupEditableValue(element: HTMLElement, paramName: string): void {
    element.setAttribute('contenteditable', 'true');

    element.addEventListener('blur', () => {
      const text = element.textContent?.trim() ?? '';
      const numValue = parseNumericValue(text);

      if (numValue !== null) {
        // Expand slider range if value exceeds current limits
        this.adjustSliderRange(paramName, numValue);

        // Set parameter with immediate=true for direct input (no interpolation delay)
        // This ensures the value is set immediately and getParam() returns the exact value
        this.app.setParam(paramName as keyof VisualParams, numValue, true);
        this.updateSliderFromValue(paramName, numValue);
        
        // Display the exact value that was entered (not getParam which might have timing issues)
        this.updateValueDisplay(paramName, numValue);
      } else {
        // Invalid input - reset display to current parameter value
        this.updateValueDisplay(paramName, this.app.getParam(paramName as keyof VisualParams));
      }
    });

    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        element.blur();
      }
    });
  }

  /**
   * Setup generic editable value display (for non-param controls like interpolation settings)
   * @param element The value display element
   * @param slider The associated slider element
   * @param onValue Callback when a valid value is entered
   * @param formatValue Optional formatter for display (default: 2 decimal places)
   */
  private setupGenericEditableValue(
    element: HTMLElement,
    slider: HTMLInputElement,
    onValue: (value: number) => void,
    formatValue: (value: number) => string = (v) => v.toFixed(2)
  ): void {
    element.setAttribute('contenteditable', 'true');

    element.addEventListener('blur', () => {
      const text = element.textContent?.trim() ?? '';
      const numValue = parseNumericValue(text);

      if (numValue !== null) {
        // Adjust slider range: moves closest boundary to the entered value
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const adjusted = calculateAdjustedRange(numValue, min, max);

        if (adjusted !== null) {
          slider.min = String(adjusted.min);
          slider.max = String(adjusted.max);
        }

        slider.value = String(numValue);
        onValue(numValue);
        element.textContent = formatValue(numValue);
      }
    });

    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        element.blur();
      }
    });
  }

  /**
   * Adjust curve settings range so the entered value becomes the closest boundary.
   * Works for both expansion (value outside range) and contraction (value inside range).
   * The slider HTML range stays 0-100, only the curve mapping range is adjusted.
   */
  private adjustSliderRange(paramName: string, value: number): void {
    // Get current curve settings (the actual parameter range)
    const currentSettings = this.curveMapper.getSettings(paramName);
    const currentMin = currentSettings.min;
    const currentMax = currentSettings.max;

    const adjusted = calculateAdjustedRange(value, currentMin, currentMax);

    if (adjusted !== null) {
      // Update curve settings to match new range
      this.curveMapper.setSettings(paramName, {
        ...currentSettings,
        min: adjusted.min,
        max: adjusted.max,
      });
    }
  }

  /**
   * Convert slider value to parameter value using curve mapping.
   * Delegates to the pure resolveSliderToParamValue function.
   */
  private sliderToParamValue(paramName: string, sliderValue: number): number {
    const settings = this.curveMapper.getSettings(paramName);
    return resolveSliderToParamValue(paramName, sliderValue, settings);
  }

  /**
   * Convert parameter value to slider value using curve mapping.
   * Delegates to the pure resolveParamToSliderValue function.
   */
  private paramToSliderValue(paramName: string, paramValue: number): number {
    const settings = this.curveMapper.getSettings(paramName);
    return resolveParamToSliderValue(paramName, paramValue, settings);
  }

  /**
   * Format parameter value for display (used by curve editor).
   * Delegates to the pure formatParamValue function.
   */
  private formatParamValue(paramName: string, value: number): string {
    return formatParamValueFn(paramName, value);
  }

  /**
   * Update value display for a parameter
   */
  private updateValueDisplay(paramName: string, value: number): void {
    const display = this.valueDisplays.get(paramName);
    if (display === null || display === undefined) return;
    display.textContent = formatParamValueFn(paramName, value);
  }

  /**
   * Update slider position from parameter value
   */
  private updateSliderFromValue(paramName: string, value: number): void {
    const slider = this.sliders.get(paramName);
    if (slider === null || slider === undefined) return;

    // Convert parameter value to normalized 0-100 slider position
    const normalizedSliderValue = this.paramToSliderValue(paramName, value);
    
    // Denormalize to HTML slider's actual min/max range
    const sliderMin = parseFloat(slider.min) || 0;
    const sliderMax = parseFloat(slider.max) || 100;
    const rawSliderValue = sliderMin === sliderMax
      ? sliderMin
      : sliderMin + (normalizedSliderValue / 100) * (sliderMax - sliderMin);
    
    slider.value = String(rawSliderValue);
  }

  /**
   * Check if a parameter uses a ParamSlider component
   */
  private isParamSliderComponent(paramName: string): boolean {
    const component = document.querySelector<ParamSlider>(`param-slider[param-name="${paramName}"]`);
    return component !== null;
  }

  /**
   * Update all sliders from current app state
   */
  updateAllSliders(): void {
    const params = this.app.getParams();

    for (const [name, value] of Object.entries(params)) {
      // Only update legacy HTML sliders, not ParamSlider components
      if (!this.isParamSliderComponent(name)) {
        this.updateSliderFromValue(name, value);
        this.updateValueDisplay(name, value);
      }
    }

    // Update param-slider components separately
    this.updateParamSliderComponents(params);
  }

  /**
   * Update a single ParamSlider component with a new value
   * Used after direct input or range expansion to sync component state
   */
  private async updateSingleParamSliderComponent(paramName: string, value: number): Promise<void> {
    const component = document.querySelector<ParamSlider>(`param-slider[param-name="${paramName}"]`);
    if (component === null || !component.isConnected) {
      return;
    }

    try {
      // Wait for component to finish any pending updates
      await component.updateComplete;
      
      // Only update if value actually changed to avoid unnecessary updates
      // This prevents overwriting the value that was just set in handleValueBlur
      if (Math.abs(component.value - value) > 0.0001) {
        // Update the component's value property
        component.value = value;
        await component.updateComplete;
      }
      
      // Always recalculate slider position using updated curve mapping (after range expansion)
      // This ensures the slider position matches the new range even if value didn't change
      const sliderValue = this.paramToSliderValue(paramName, value);
      component.setSliderPosition(sliderValue);
    } catch (err: unknown) {
      // Component might not be fully initialized yet, skip silently
      console.debug(`Skipping update for ${paramName} - component not ready:`, err);
    }
  }

  /**
   * Update param-slider components with current values
   * Only updates when component is ready and not currently being manipulated by user
   */
  private updateParamSliderComponents(params: VisualParams): void {
    const components = document.querySelectorAll<ParamSlider>('param-slider');
    // Use for...of instead of forEach to properly handle async operations
    for (const component of components) {
      // Check if component is connected to DOM before updating
      // This prevents Lit errors when components aren't ready yet
      if (!component.isConnected) {
        continue;
      }

      const paramName = component.paramName as keyof VisualParams;
      if (paramName in params) {
        const value = params[paramName];
        
        // Update component asynchronously to avoid blocking
        void this.updateSingleParamSliderComponent(paramName, value);
      }
    }
  }

  /**
   * Setup preset controls
   */
  private setupPresetControls(): void {
    const presetSelect = document.getElementById('preset-select') as HTMLSelectElement | null;
    const presetNameInput = document.getElementById('preset-name-input') as HTMLInputElement | null;
    const saveBtn = document.getElementById('save-preset-btn');
    const deleteBtn = document.getElementById('delete-preset-btn');
    const exportBtn = document.getElementById('export-presets-btn');
    const importInput = document.getElementById('import-presets-input') as HTMLInputElement | null;

    if (presetSelect !== null) {
      presetSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        if (target.value !== '') {
          this.loadPreset(target.value);
        }
      });
    }

    if (saveBtn !== null && presetNameInput !== null) {
      saveBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (name !== '') {
          this.savePreset(name);
          presetNameInput.value = '';
        }
      });
    }

    if (deleteBtn !== null && presetSelect !== null) {
      deleteBtn.addEventListener('click', () => {
        const name = presetSelect.value;
        if (name !== '' && confirm(`Delete preset "${name}"?`)) {
          this.deletePreset(name);
        }
      });
    }

    if (exportBtn !== null) {
      exportBtn.addEventListener('click', () => {
        this.exportPresets();
      });
    }

    if (importInput !== null) {
      importInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file !== undefined) {
          this.importPresets(file);
          target.value = '';
        }
      });
    }

    this.refreshPresetList();
  }

  /**
   * Load a preset
   */
  private loadPreset(name: string): void {
    const success = this.app.loadPreset(name);
    if (success) {
      this.currentPresetName = name;
      this.updateAllSliders();
      this.updateEmanationRateSlider();
      this.updateBlendModeSelect();
      this.updateStatusIndicators();
      this.config.onPresetLoad?.(name);
    }
  }

  /**
   * Update emanation rate slider from app state
   */
  private updateEmanationRateSlider(): void {
    const rate = this.app.getEmanationRate();
    const slider = document.getElementById('emanation-rate-slider') as HTMLInputElement | null;
    const valueDisplay = document.getElementById('emanation-rate-value');

    if (slider !== null) {
      slider.value = String(rate);
    }
    if (valueDisplay !== null) {
      valueDisplay.textContent = rate.toFixed(1);
    }
  }

  /**
   * Update blend mode select from app state
   */
  private updateBlendModeSelect(): void {
    const mode = this.app.getBlendMode();
    const select = document.getElementById('blend-mode-select') as HTMLSelectElement | null;

    if (select !== null) {
      select.value = mode;
    }
  }

  /**
   * Save current state as preset
   */
  private savePreset(name: string): void {
    this.app.savePreset(name);
    this.currentPresetName = name;
    this.refreshPresetList();
    this.updateStatusIndicators();
    this.config.onPresetSave?.(name);
  }

  /**
   * Delete a preset
   */
  private deletePreset(name: string): void {
    this.app.getPresetManager().deletePreset(name);
    if (this.currentPresetName === name) {
      this.currentPresetName = null;
    }
    this.refreshPresetList();
  }

  /**
   * Export all presets to JSON
   */
  private exportPresets(): void {
    const json = this.app.getPresetManager().exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audioshader-presets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import presets from JSON file
   */
  private importPresets(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        const count = this.app.getPresetManager().importPresets(result);
        this.refreshPresetList();
        alert(`Imported ${count} preset(s)`);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Refresh the preset select list
   */
  private refreshPresetList(): void {
    const select = document.getElementById('preset-select') as HTMLSelectElement | null;
    if (select === null) return;

    this.presetNames = this.app.getPresetManager().getPresetNames();

    select.innerHTML = '<option value="">-- Select Preset --</option>';
    for (const name of this.presetNames) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === this.currentPresetName) {
        option.selected = true;
      }
      select.appendChild(option);
    }
  }

  /**
   * Setup resolution controls
   */
  private setupResolutionControls(): void {
    const buttons = document.querySelectorAll('.resolution-btn');

    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const resolution = target.dataset['resolution'] as ResolutionKey | undefined;
        if (resolution !== undefined) {
          this.setResolution(resolution);
        }
      });
    });
  }

  /**
   * Set resolution
   */
  private setResolution(resolution: ResolutionKey): void {
    // Update URL
    const url = new URL(window.location.href);
    if (resolution === 'window') {
      url.searchParams.delete('resolution');
    } else {
      url.searchParams.set('resolution', resolution);
    }
    window.history.replaceState({}, '', url.toString());

    // Update active button
    document.querySelectorAll('.resolution-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-resolution="${resolution}"]`)?.classList.add('active');

    // Update display
    const display = document.getElementById('current-resolution-display');
    if (display !== null) {
      display.textContent = `Current: ${getResolutionDisplayString(resolution)}`;
    }

    // Trigger resize
    this.app.getRenderer().resize();
    this.config.onResolutionChange?.(resolution);
  }

  /**
   * Setup interpolation controls
   */
  private setupInterpolationControls(): void {
    const enabledCheckbox = document.getElementById('interpolation-enabled') as HTMLInputElement | null;
    const durationSlider = document.getElementById('interpolation-duration-slider') as HTMLInputElement | null;
    const springSlider = document.getElementById('interpolation-spring-slider') as HTMLInputElement | null;
    const dampingSlider = document.getElementById('interpolation-damping-slider') as HTMLInputElement | null;
    const rotationSpring = document.getElementById('interpolation-rotation-spring') as HTMLInputElement | null;
    const easingSelect = document.getElementById('interpolation-easing-select') as HTMLSelectElement | null;

    const interpolator = this.app.getInterpolator();

    if (enabledCheckbox !== null) {
      enabledCheckbox.addEventListener('change', (e) => {
        interpolator.setEnabled((e.target as HTMLInputElement).checked);
      });
    }

    if (durationSlider !== null) {
      const valueDisplay = document.getElementById('interpolation-duration-value');
      durationSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        interpolator.defaultDuration = value;
        if (valueDisplay !== null) {
          valueDisplay.textContent = value.toFixed(2);
        }
      });
      // Enable direct value editing
      if (valueDisplay !== null) {
        this.setupGenericEditableValue(valueDisplay, durationSlider, (value) => {
          interpolator.defaultDuration = value;
        });
      }
    }

    if (springSlider !== null) {
      const valueDisplay = document.getElementById('interpolation-spring-value');
      springSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        interpolator.springConstant = value;
        if (valueDisplay !== null) {
          valueDisplay.textContent = value.toFixed(2);
        }
      });
      // Enable direct value editing
      if (valueDisplay !== null) {
        this.setupGenericEditableValue(valueDisplay, springSlider, (value) => {
          interpolator.springConstant = value;
        });
      }
    }

    if (dampingSlider !== null) {
      const valueDisplay = document.getElementById('interpolation-damping-value');
      dampingSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        interpolator.springDamping = value;
        if (valueDisplay !== null) {
          valueDisplay.textContent = value.toFixed(2);
        }
      });
      // Enable direct value editing
      if (valueDisplay !== null) {
        this.setupGenericEditableValue(valueDisplay, dampingSlider, (value) => {
          interpolator.springDamping = value;
        });
      }
    }

    if (rotationSpring !== null) {
      rotationSpring.addEventListener('change', (e) => {
        interpolator.useSpringForRotation = (e.target as HTMLInputElement).checked;
      });
    }

    if (easingSelect !== null) {
      easingSelect.addEventListener('change', (e) => {
        interpolator.defaultEasing = (e.target as HTMLSelectElement).value as 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
      });
    }
  }

  /**
   * Setup jiggle controls
   */
  private setupJiggleControls(): void {
    const jiggleBtn = document.getElementById('jiggle-btn');
    const amountSlider = document.getElementById('jiggle-amount-slider') as HTMLInputElement | null;
    const amountValue = document.getElementById('jiggle-amount-value');

    // Quick action buttons
    const allBtn = document.getElementById('jiggle-all-btn');
    const noneBtn = document.getElementById('jiggle-none-btn');
    const shapeBtn = document.getElementById('jiggle-shape-btn');
    const appearanceBtn = document.getElementById('jiggle-appearance-btn');

    if (jiggleBtn !== null) {
      jiggleBtn.addEventListener('click', () => {
        // Toggle jiggle state properly
        const wasEnabled = this.app.isJiggleEnabled();
        const isEnabled = !wasEnabled;
        this.app.setJiggleEnabled(isEnabled);
        jiggleBtn.textContent = isEnabled ? 'Stop Jiggle' : 'Jiggle';
        jiggleBtn.style.background = isEnabled ? '#a00' : '#a0a';
        this.updateStatusIndicators();

        // When disabling jiggle, update all sliders to show final values
        if (!isEnabled) {
          this.updateAllSliders();
        }
      });
    }

    if (amountSlider !== null) {
      amountSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value) / 100;
        this.jiggleSettings.amount = value;
        this.app.setJiggleAmount(value);
        if (amountValue !== null) {
          amountValue.textContent = `${Math.round(value * 100)}%`;
        }
      });

      // Enable direct value editing for jiggle amount
      if (amountValue !== null) {
        this.setupGenericEditableValue(
          amountValue,
          amountSlider,
          (value) => {
            // Input is in percentage (0-100), convert to 0-1
            const normalizedValue = value / 100;
            this.jiggleSettings.amount = normalizedValue;
            this.app.setJiggleAmount(normalizedValue);
          },
          (v) => `${Math.round(v)}%`
        );
      }
    }

    // Setup per-parameter checkboxes
    for (const param of JIGGLE_PARAMS) {
      const checkbox = document.getElementById(`jiggle-param-${param}`) as HTMLInputElement | null;
      if (checkbox !== null) {
        checkbox.checked = this.jiggleSettings.enabled[param];
        checkbox.addEventListener('change', (e) => {
          this.jiggleSettings.enabled[param] = (e.target as HTMLInputElement).checked;
        });
      }
    }

    // Quick action buttons
    if (allBtn !== null) {
      allBtn.addEventListener('click', () => {
        this.setAllJiggleParams(true);
      });
    }

    if (noneBtn !== null) {
      noneBtn.addEventListener('click', () => {
        this.setAllJiggleParams(false);
      });
    }

    if (shapeBtn !== null) {
      shapeBtn.addEventListener('click', () => {
        const shapeParams = ['spikiness', 'spikeFrequency', 'spikeSharpness'];
        this.setJiggleParamsTo(shapeParams);
      });
    }

    if (appearanceBtn !== null) {
      appearanceBtn.addEventListener('click', () => {
        const appearanceParams = ['hue', 'scale', 'fillSize', 'fillOpacity'];
        this.setJiggleParamsTo(appearanceParams);
      });
    }
  }

  /**
   * Set all jiggle params to a value
   */
  private setAllJiggleParams(enabled: boolean): void {
    for (const param of JIGGLE_PARAMS) {
      this.jiggleSettings.enabled[param] = enabled;
      const checkbox = document.getElementById(`jiggle-param-${param}`) as HTMLInputElement | null;
      if (checkbox !== null) {
        checkbox.checked = enabled;
      }
    }
  }

  /**
   * Enable only specific jiggle params
   */
  private setJiggleParamsTo(enabledParams: string[]): void {
    for (const param of JIGGLE_PARAMS) {
      const enabled = enabledParams.includes(param);
      this.jiggleSettings.enabled[param] = enabled;
      const checkbox = document.getElementById(`jiggle-param-${param}`) as HTMLInputElement | null;
      if (checkbox !== null) {
        checkbox.checked = enabled;
      }
    }
  }

  /**
   * Setup audio controls
   */
  private setupAudioControls(): void {
    if (this.audioAnalyzer === null) return;

    const audioAnalyzer = this.audioAnalyzer;

    const enableBtn = document.getElementById('audio-enable-btn');
    const tabBtn = document.getElementById('audio-tab-btn');
    const status = document.getElementById('audio-status');

    // Helper to reset UI state
    const resetAudioUI = (): void => {
      if (enableBtn !== null) {
        enableBtn.textContent = 'Enable Mic/Device';
        enableBtn.style.background = '#0af';
      }
      if (tabBtn !== null) {
        tabBtn.textContent = 'Capture Tab Audio';
        tabBtn.style.background = '#a0f';
      }
      if (status !== null) {
        status.textContent = 'Audio: Disabled';
        status.style.color = '#888';
      }
    };

    // Helper to set active state
    const setActiveUI = (mode: string, isTab: boolean): void => {
      if (isTab) {
        if (tabBtn !== null) {
          tabBtn.textContent = 'Stop Tab Capture';
          tabBtn.style.background = '#f44';
        }
        if (enableBtn !== null) {
          enableBtn.style.background = '#555';
        }
      } else {
        if (enableBtn !== null) {
          enableBtn.textContent = 'Disable Audio';
          enableBtn.style.background = '#f44';
        }
        if (tabBtn !== null) {
          tabBtn.style.background = '#555';
        }
      }
      if (status !== null) {
        status.textContent = `Audio: ${mode}${isTab ? ' (Tab)' : ''}`;
        status.style.color = audioAnalyzer.isStereoMode ? '#0f0' : '#ff0';
      }
    };

    // Listen for tab audio ending (user stopped sharing)
    window.addEventListener('tabAudioEnded', () => {
      resetAudioUI();
    });

    // Mic/Device button handler
    if (enableBtn !== null) {
      enableBtn.addEventListener('click', () => {
        void (async (): Promise<void> => {
          if (audioAnalyzer.isEnabled) {
            audioAnalyzer.disableAudio();
            resetAudioUI();
          } else {
            try {
              // Get selected device from dropdown (if any)
              const deviceSelect = document.getElementById('audio-device-select') as HTMLSelectElement | null;
              const selectedDeviceId = deviceSelect !== null && deviceSelect.value !== '' && deviceSelect.value !== 'default'
                ? deviceSelect.value
                : null;

              // Only request permission and enumerate devices when user explicitly clicks mic button
              // This prevents double permission prompt when using tab capture
              await audioAnalyzer.enableAudio(selectedDeviceId);
              const mode = audioAnalyzer.isStereoMode ? 'STEREO' : 'MONO';
              setActiveUI(mode, false);
              
              // Populate device dropdown after successful mic enable
              // This allows users to see available devices and switch between them
              await this.populateAudioDevices();
            } catch (err: unknown) {
              console.error('Failed to enable audio:', err);
              alert('Failed to enable audio: ' + (err instanceof Error ? err.message : String(err)));
            }
          }
        })();
      });
    }

    // Tab capture button handler
    if (tabBtn !== null) {
      tabBtn.addEventListener('click', () => {
        void (async (): Promise<void> => {
          if (audioAnalyzer.isEnabled) {
            audioAnalyzer.disableAudio();
            resetAudioUI();
          } else {
            try {
              // Tab capture uses getDisplayMedia, NOT getUserMedia
              // Do NOT call getAudioDevices() here to avoid double permission prompt
              await audioAnalyzer.enableTabAudio();
              const mode = audioAnalyzer.isStereoMode ? 'STEREO' : 'MONO';
              setActiveUI(mode, true);
            } catch (err: unknown) {
              console.error('Failed to capture tab audio:', err);
              alert('Failed to capture tab audio: ' + (err instanceof Error ? err.message : String(err)));
            }
          }
        })();
      });
    }

    // Audio reactive toggle
    const reactiveToggle = document.getElementById('audio-reactive-enabled') as HTMLInputElement | null;
    if (reactiveToggle !== null) {
      reactiveToggle.addEventListener('change', () => {
        this.app.setAudioReactiveEnabled(reactiveToggle.checked);
      });
    }

    // Generate parameter mapping UI
    this.generateParameterMappingsUI();
  }

  /**
   * Populate audio device dropdown (only called after user enables mic)
   * This is deferred to avoid permission prompts on page load
   */
  private async populateAudioDevices(): Promise<void> {
    if (this.audioAnalyzer === null) return;

    const deviceSelect = document.getElementById('audio-device-select') as HTMLSelectElement | null;
    if (deviceSelect === null) return;

    try {
      // Only enumerate devices after permission is granted (via enableAudio)
      // Pass requestPermission: false since we already have permission
      const devices = await this.audioAnalyzer.getAudioDevices(false);
      
      // Clear existing options except the first "Default" option
      const defaultOption = deviceSelect.options[0];
      deviceSelect.innerHTML = '';
      if (defaultOption !== undefined) {
        deviceSelect.appendChild(defaultOption);
      }

      // Add device options
      devices.forEach((device) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label;
        deviceSelect.appendChild(option);
      });

      // Setup change handler only once to avoid duplicate listeners
      if (!this.deviceSelectHandlerSetup) {
        deviceSelect.addEventListener('change', () => {
          // Device selection will be used on next enableAudio call
          // The selected deviceId is read in the enableAudio handler
        });
        this.deviceSelectHandlerSetup = true;
      }
    } catch (err: unknown) {
      console.warn('Failed to enumerate audio devices:', err);
      // Non-fatal: device dropdown will remain empty or show default
    }
  }

  /**
   * Generate the parameter mappings UI in the audio mapping panel
   */
  private generateParameterMappingsUI(): void {
    const container = document.getElementById('parameter-mappings-container');
    if (container === null) return;

    const mappableParams: Array<keyof VisualParams> = [
      'spikiness', 'spikeFrequency', 'spikeSharpness',
      'scale', 'hue', 'fillSize', 'fillOpacity',
      'autoRotationSpeed', 'hueShiftAmount', 'blendOpacity',
      'expansionFactor', 'fadeAmount', 'noiseAmount', 'noiseRate',
      'blurAmount', 'blurRate', 'jiggleAmount', 'emanationRate',
      'rotation',
    ];

    // All available audio sources (now 15 total)
    const audioSources: Array<keyof AudioMetrics> = [
      'rms', 'bass', 'mid', 'high', 'presence', 'harshness',
      'mud', 'compression', 'collision', 'coherence', 'stereoWidth', 'phaseRisk',
      'lowImbalance', 'emptiness', 'panPosition',
    ];

    // Get current mappings from AudioMapper
    const audioMapper = this.app.getAudioMapper();

    container.innerHTML = mappableParams.map((param) => {
      const mod = audioMapper.getModulation(param);
      const slot = mod?.slots[0];
      const currentSource = slot?.source ?? 'rms';
      const currentEnabled = mod?.enabled ?? false;
      const currentAmount = (slot?.amount ?? 0.5) * 100;

      return `
      <div class="mapping-row" style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 3px;">
        <input type="checkbox" id="mapping-${param}-enabled" data-param="${param}" ${currentEnabled ? 'checked' : ''} style="cursor: pointer;">
        <label for="mapping-${param}-enabled" style="font-size: 9px; color: #bbb; width: 80px; cursor: pointer;">${getParamLabel(param)}</label>
        <div class="mapping-bar-container" style="width: 50px; height: 8px; background: #222; border-radius: 2px; overflow: hidden; position: relative;">
          <div id="mapping-${param}-bar" class="mapping-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #0af, #0fa); transition: width 0.05s;"></div>
        </div>
        <span id="mapping-${param}-value" style="font-size: 8px; color: #888; width: 35px; text-align: right;">0.00</span>
        <select id="mapping-${param}-source" data-param="${param}" style="font-size: 8px; padding: 2px; background: #333; color: #eee; border: 1px solid #555; border-radius: 2px; width: 70px;">
          ${audioSources.map((src) => `<option value="${src}" ${src === currentSource ? 'selected' : ''}>${AudioMapper.getMetricLabel(src)}</option>`).join('')}
        </select>
        <input type="range" id="mapping-${param}-amount" data-param="${param}" min="0" max="100" value="${currentAmount}" style="width: 50px;">
      </div>
    `;
    }).join('');

    // Add event listeners for mapping controls
    mappableParams.forEach((param) => {
      const checkbox = document.getElementById(`mapping-${param}-enabled`) as HTMLInputElement | null;
      const sourceSelect = document.getElementById(`mapping-${param}-source`) as HTMLSelectElement | null;
      const amountSlider = document.getElementById(`mapping-${param}-amount`) as HTMLInputElement | null;

      if (checkbox !== null) {
        checkbox.addEventListener('change', () => {
          this.app.updateAudioModulation(param, { enabled: checkbox.checked });
        });
      }

      if (sourceSelect !== null) {
        sourceSelect.addEventListener('change', () => {
          const audioMapperInner = this.app.getAudioMapper();
          audioMapperInner.updatePrimarySlot(param, { source: sourceSelect.value as keyof AudioMetrics });
        });
      }

      if (amountSlider !== null) {
        amountSlider.addEventListener('input', () => {
          const audioMapperInner = this.app.getAudioMapper();
          audioMapperInner.updatePrimarySlot(param, { amount: parseFloat(amountSlider.value) / 100 });
        });
      }
    });
  }

  /**
   * Setup curve editor drawer
   */
  private setupCurveEditor(): void {
    const drawer = this.curveEditorDrawer;
    if (drawer === null) return;

    const closeBtn = document.getElementById('curve-editor-close');
    const resetBtn = document.getElementById('curve-reset');
    const minInput = document.getElementById('curve-min') as HTMLInputElement | null;
    const maxInput = document.getElementById('curve-max') as HTMLInputElement | null;
    const powerSlider = document.getElementById('curve-power') as HTMLInputElement | null;
    const powerValue = document.getElementById('curve-power-value');
    const paramSlider = document.getElementById('curve-param-slider') as HTMLInputElement | null;
    const paramValue = document.getElementById('curve-param-value');
    const paramSliderContainer = document.getElementById('curve-param-slider-container');

    // Close handler
    const closeCurve = (): void => {
      drawer.classList.remove('active');
      drawer.style.display = 'none';
      this.currentCurveParam = null;
      if (this.currentCurveControlGroup !== null) {
        this.currentCurveControlGroup = null;
      }
      if (paramSliderContainer !== null) {
        paramSliderContainer.style.display = 'none';
      }
    };

    if (closeBtn !== null) closeBtn.addEventListener('click', closeCurve);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('active')) {
        closeCurve();
      }
    });

    // Apply handler (auto-applies on change, no separate Apply button needed)
    const applyCurve = (): void => {
      if (this.currentCurveParam === null) return;
      if (minInput === null || maxInput === null || powerSlider === null) return;

      const settings: CurveSettings = {
        min: parseFloat(minInput.value) || 0,
        max: parseFloat(maxInput.value) || 1,
        power: parseFloat(powerSlider.value) || 1,
        type: 'power',
      };

      this.curveMapper.setSettings(this.currentCurveParam, settings);
      this.drawCurve();
      
      // After updating curve settings, recalculate slider position for this parameter
      // This ensures the slider position matches the new range
      const currentValue = this.app.getParam(this.currentCurveParam as keyof VisualParams);
      if (this.isParamSliderComponent(this.currentCurveParam)) {
        void this.updateSingleParamSliderComponent(this.currentCurveParam, currentValue);
      } else {
        // Legacy HTML slider - update slider position
        this.updateSliderFromValue(this.currentCurveParam, currentValue);
      }
      
      // Update param slider in drawer if visible
      if (paramSlider !== null && paramValue !== null && this.currentCurveParam !== null) {
        const normalizedSliderValue = this.paramToSliderValue(this.currentCurveParam, currentValue);
        const sliderMin = parseFloat(paramSlider.min) || 0;
        const sliderMax = parseFloat(paramSlider.max) || 100;
        const rawSliderValue = sliderMin + (normalizedSliderValue / 100) * (sliderMax - sliderMin);
        paramSlider.value = String(rawSliderValue);
        paramValue.textContent = this.formatParamValue(this.currentCurveParam, currentValue);
      }
    };

    // Auto-apply on input changes
    if (minInput !== null) minInput.addEventListener('input', applyCurve);
    if (maxInput !== null) maxInput.addEventListener('input', applyCurve);

    if (powerSlider !== null && powerValue !== null) {
      // Setup editable value display for power slider
      powerValue.setAttribute('contenteditable', 'true');
      
      powerSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        powerValue.textContent = value.toFixed(2);
        applyCurve();
      });
      
      // Setup direct input for power value
      powerValue.addEventListener('blur', () => {
        const text = powerValue.textContent?.trim() ?? '';
        const numValue = parseNumericValue(text);
        
        if (numValue !== null && powerSlider !== null) {
          // Clamp to slider range
          const min = parseFloat(powerSlider.min) || 0.1;
          const max = parseFloat(powerSlider.max) || 5;
          const clampedValue = Math.max(min, Math.min(max, numValue));
          powerSlider.value = String(clampedValue);
          powerValue.textContent = clampedValue.toFixed(2);
          applyCurve();
        } else {
          // Invalid input - reset to current slider value
          const currentValue = parseFloat(powerSlider?.value || '1.0');
          powerValue.textContent = currentValue.toFixed(2);
        }
      });
      
      powerValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          powerValue.blur();
        }
      });
    }
    
    // Setup parameter slider in drawer
    if (paramSlider !== null && paramValue !== null) {
      paramSlider.addEventListener('input', (e) => {
        if (this.currentCurveParam === null) return;
        const target = e.target as HTMLInputElement;
        const rawSliderValue = parseFloat(target.value);
        
        // Normalize slider value to 0-100 range for curve mapping
        const sliderMin = parseFloat(target.min) || 0;
        const sliderMax = parseFloat(target.max) || 100;
        const normalizedSliderValue = sliderMin === sliderMax 
          ? 50
          : ((rawSliderValue - sliderMin) / (sliderMax - sliderMin)) * 100;
        
        const paramValueNum = this.sliderToParamValue(this.currentCurveParam, normalizedSliderValue);
        
        this.app.setParam(this.currentCurveParam as keyof VisualParams, paramValueNum, true);
        paramValue.textContent = this.formatParamValue(this.currentCurveParam, paramValueNum);
        this.config.onParamChange?.(this.currentCurveParam as keyof VisualParams, paramValueNum);
      });
      
      // Setup editable value for param slider
      paramValue.addEventListener('blur', () => {
        if (this.currentCurveParam === null) return;
        const text = paramValue.textContent?.trim() ?? '';
        const numValue = parseNumericValue(text);
        
        if (numValue !== null) {
          this.adjustSliderRange(this.currentCurveParam, numValue);
          this.app.setParam(this.currentCurveParam as keyof VisualParams, numValue, true);
          
          // Update slider position (normalized to 0-100, then denormalized to HTML range)
          const normalizedSliderValue = this.paramToSliderValue(this.currentCurveParam, numValue);
          const sliderMin = parseFloat(paramSlider.min) || 0;
          const sliderMax = parseFloat(paramSlider.max) || 100;
          const rawSliderValue = sliderMin + (normalizedSliderValue / 100) * (sliderMax - sliderMin);
          paramSlider.value = String(rawSliderValue);
          paramValue.textContent = this.formatParamValue(this.currentCurveParam, numValue);
          applyCurve(); // Update curve settings if range expanded
        } else {
          const currentValue = this.app.getParam(this.currentCurveParam as keyof VisualParams);
          paramValue.textContent = this.formatParamValue(this.currentCurveParam, currentValue);
        }
      });
      
      paramValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          paramValue.blur();
        }
      });
    }

    // Reset handler
    if (resetBtn !== null) {
      resetBtn.addEventListener('click', () => {
        if (this.currentCurveParam === null) return;
        const defaults = getParamDefaultSettings(this.currentCurveParam as keyof VisualParams);
        if (defaults !== null && minInput !== null && maxInput !== null && powerSlider !== null) {
          minInput.value = String(defaults.min);
          maxInput.value = String(defaults.max);
          powerSlider.value = String(defaults.power);
          if (powerValue !== null) {
            powerValue.textContent = defaults.power.toFixed(2);
          }
          applyCurve();
        }
      });
    }
  }

  /**
   * Open curve editor drawer for a parameter
   * Toggles closed if already open for the same parameter
   */
  private openCurveEditor(paramName: string): void {
    if (this.curveEditorDrawer === null) {
      console.error('Curve editor drawer element not found');
      return;
    }

    // If drawer is already open for this parameter, close it
    if (this.curveEditorDrawer.classList.contains('active') && this.currentCurveParam === paramName) {
      this.curveEditorDrawer.classList.remove('active');
      this.curveEditorDrawer.style.display = 'none';
      this.currentCurveParam = null;
      const paramSliderContainer = document.getElementById('curve-param-slider-container');
      if (paramSliderContainer !== null) {
        paramSliderContainer.style.display = 'none';
      }
      return;
    }

    this.currentCurveParam = paramName;

    // Get settings - try curve mapper first, then fall back to defaults
    // Note: getParamDefaultSettings accepts string, not just VisualParams keys
    const settings = this.curveMapper.getSettings(paramName) ?? getParamDefaultSettings(paramName);
    if (settings === null) {
      console.warn(`No curve settings found for parameter: ${paramName}`);
      return;
    }

    // Find the control group or element that triggered this
    // For ParamSlider components, find the component itself (curve button is in shadow DOM)
    // For regular HTML sliders, find the curve button with data-param attribute
    let controlGroup: HTMLElement | null = null;
    let positioningElement: HTMLElement | null = null;
    
    // Try finding ParamSlider component first
    const paramSliderComponent = document.querySelector(`param-slider[param-name="${paramName}"]`) as HTMLElement | null;
    if (paramSliderComponent !== null) {
      // Try to find parent control-group, but if not found, use the component itself
      controlGroup = paramSliderComponent.closest('.control-group') as HTMLElement | null;
      positioningElement = controlGroup ?? paramSliderComponent;
    }
    
    // If not found, try finding regular curve button
    if (positioningElement === null) {
      const curveBtn = document.querySelector(`.curve-btn[data-param="${paramName}"]`);
      controlGroup = curveBtn?.closest('.control-group') as HTMLElement | null;
      positioningElement = controlGroup;
    }
    
    this.currentCurveControlGroup = controlGroup;

    const title = document.getElementById('curve-editor-title');
    const minInput = document.getElementById('curve-min') as HTMLInputElement | null;
    const maxInput = document.getElementById('curve-max') as HTMLInputElement | null;
    const powerSlider = document.getElementById('curve-power') as HTMLInputElement | null;
    const powerValue = document.getElementById('curve-power-value');
    const paramSlider = document.getElementById('curve-param-slider') as HTMLInputElement | null;
    const paramValue = document.getElementById('curve-param-value');
    const paramLabel = document.getElementById('curve-param-label');
    const paramSliderContainer = document.getElementById('curve-param-slider-container');

    if (title !== null) title.textContent = getParamLabel(paramName);
    if (minInput !== null) minInput.value = String(settings.min);
    if (maxInput !== null) maxInput.value = String(settings.max);
    if (powerSlider !== null) powerSlider.value = String(settings.power);
    if (powerValue !== null) powerValue.textContent = settings.power.toFixed(2);

    // Setup parameter slider in drawer
    if (paramSlider !== null && paramValue !== null && paramLabel !== null && paramSliderContainer !== null) {
      paramLabel.textContent = getParamLabel(paramName);
      const currentValue = this.app.getParam(paramName as keyof VisualParams);
      
      // Get HTML slider range if it exists, otherwise use 0-100
      const htmlSlider = this.sliders.get(paramName);
      if (htmlSlider !== undefined && htmlSlider !== null) {
        const sliderMin = parseFloat(htmlSlider.min) || 0;
        const sliderMax = parseFloat(htmlSlider.max) || 100;
        paramSlider.min = String(sliderMin);
        paramSlider.max = String(sliderMax);
      } else {
        paramSlider.min = '0';
        paramSlider.max = '100';
      }
      
      // Calculate slider position (normalized to 0-100, then denormalized to HTML range)
      const normalizedSliderValue = this.paramToSliderValue(paramName, currentValue);
      const sliderMin = parseFloat(paramSlider.min) || 0;
      const sliderMax = parseFloat(paramSlider.max) || 100;
      const rawSliderValue = sliderMin + (normalizedSliderValue / 100) * (sliderMax - sliderMin);
      paramSlider.value = String(rawSliderValue);
      paramValue.textContent = this.formatParamValue(paramName, currentValue);
      paramSliderContainer.style.display = 'block';
    }

    // Position drawer to the left of control group/element if found
    if (positioningElement !== null) {
      const rect = positioningElement.getBoundingClientRect();
      // Position drawer to the left of the control group
      // Drawer width is 280px, so position it just to the left (with small gap)
      const drawerLeft = Math.max(0, rect.left - 285); // 5px gap
      this.curveEditorDrawer.style.left = `${drawerLeft}px`;
      
      // Calculate drawer height estimate (approximate based on content)
      const estimatedDrawerHeight = 350; // Approximate height of drawer content
      const viewportHeight = window.innerHeight;
      const padding = 10; // Padding from edges
      
      // Calculate ideal top position
      let drawerTop = rect.top;
      
      // If drawer would extend beyond bottom, adjust top position
      if (drawerTop + estimatedDrawerHeight > viewportHeight - padding) {
        // Position drawer so it fits within viewport
        drawerTop = Math.max(padding, viewportHeight - estimatedDrawerHeight - padding);
      }
      
      // Ensure drawer doesn't go above viewport
      drawerTop = Math.max(padding, drawerTop);
      
      this.curveEditorDrawer.style.top = `${drawerTop}px`;
      this.curveEditorDrawer.style.height = 'auto';
      const maxHeight = viewportHeight - drawerTop - padding;
      this.curveEditorDrawer.style.maxHeight = `${maxHeight}px`;
      
      // Set content max-height to match
      const content = this.curveEditorDrawer.querySelector('.curve-editor-content') as HTMLElement;
      if (content !== null) {
        content.style.maxHeight = `${maxHeight}px`;
      }
    } else {
      // Fallback: position at top left
      this.curveEditorDrawer.style.left = '0px';
      this.curveEditorDrawer.style.top = '10px';
      this.curveEditorDrawer.style.height = 'auto';
      const maxHeight = Math.min(window.innerHeight - 20, 500);
      this.curveEditorDrawer.style.maxHeight = `${maxHeight}px`;
      const content = this.curveEditorDrawer.querySelector('.curve-editor-content') as HTMLElement;
      if (content !== null) {
        content.style.maxHeight = `${maxHeight}px`;
      }
    }

    // Make drawer visible
    this.curveEditorDrawer.style.display = 'block';
    this.curveEditorDrawer.classList.add('active');
    this.drawCurve();
  }

  /**
   * Draw the curve on the canvas
   */
  private drawCurve(): void {
    const canvas = document.getElementById('curve-canvas') as HTMLCanvasElement | null;
    if (canvas === null || this.currentCurveParam === null) return;

    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    const settings = this.curveMapper.getSettings(this.currentCurveParam);
    if (settings === null) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    const padding = 40;
    const w = width - padding * 2;
    const h = height - padding * 2;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = padding + (w * i) / 10;
      const y = padding + (h * i) / 10;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + w, y);
      ctx.stroke();
    }

    // Curve
    ctx.strokeStyle = '#0af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = padding + (w * i) / 100;
      const normalized = i / 100;
      const curved = Math.pow(normalized, settings.power);
      const y = padding + h - curved * h;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  /**
   * Setup collapsible sections
   */
  private setupCollapsibleSections(): void {
    const headers = document.querySelectorAll('#dev-toolbox .section-header');

    headers.forEach((header) => {
      header.addEventListener('click', () => {
        const collapsed = header.classList.toggle('collapsed');
        let el = header.nextElementSibling;

        while (el !== null && !el.classList.contains('section-header')) {
          const element = el as HTMLElement;
          if (collapsed) {
            element.dataset['_display'] = element.style.display || '';
            element.style.display = 'none';
          } else {
            element.style.display = element.dataset['_display'] || '';
          }
          el = el.nextElementSibling;
        }
      });
    });
  }

  /**
   * Setup recorders
   */
  private setupRecorders(): void {
    const canvas = this.app.getRenderer().getCanvas();
    this.gifRecorder = new GifRecorder(canvas, {
      filenamePrefix: 'audioshader',
      maxWidth: 720,
    });

    this.gifRecorder.onProgress((remaining) => {
      const indicator = document.getElementById('record-indicator');
      if (indicator !== null) {
        indicator.textContent = `RECORD ${(remaining / 1000).toFixed(1)}s`;
      }
    });

    this.gifRecorder.onComplete(() => {
      const indicator = document.getElementById('record-indicator');
      if (indicator !== null) {
        indicator.style.display = 'none';
      }
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      const active = document.activeElement;
      if (active !== null) {
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (active as HTMLElement).isContentEditable) {
          return;
        }
      }

      this.handleKeyDown(e);
    });
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.toggleFreeze();
        break;

      case 'KeyR':
        if (!e.ctrlKey && !e.metaKey) {
          this.app.randomize();
          this.updateAllSliders();
        }
        break;

      case 'KeyH':
        this.toggleUIVisibility();
        break;

      case 'KeyJ':
        document.getElementById('jiggle-btn')?.click();
        break;

      case 'KeyF':
        if (!e.ctrlKey && !e.metaKey) {
          this.toggleDilationFreeze();
        }
        break;

      case 'KeyM':
        if (!e.ctrlKey && !e.metaKey) {
          this.toggleAudioMappingPanel();
        }
        break;

      case 'KeyS':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.takeSnapshot();
        }
        break;

      case 'KeyG':
        e.preventDefault();
        this.toggleGifRecording();
        break;

      case 'Digit1': {
        const checkbox = document.getElementById('interpolation-enabled') as HTMLInputElement | null;
        if (checkbox !== null) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
        break;
      }

      case 'Escape':
        this.clearScreen();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this.cyclePreset(-1);
        break;

      case 'ArrowRight':
        e.preventDefault();
        this.cyclePreset(1);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.accelerate();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.decelerate();
        break;
    }
  }

  /**
   * Toggle pause state (stops entire render loop)
   */
  private toggleFreeze(): void {
    this.app.toggleFreeze();
    this.updateStatusIndicators();
  }

  /**
   * Toggle dilation freeze (sets dilation to 1.0, shape still updates)
   */
  private toggleDilationFreeze(): void {
    this.app.toggleDilationFreeze();
    this.updateStatusIndicators();
  }

  /**
   * Toggle UI visibility
   */
  private toggleUIVisibility(): void {
    this.uiVisible = !this.uiVisible;

    if (this.devToolbox !== null) {
      this.devToolbox.hidden = !this.uiVisible;
    }
    if (this.hotkeyLegend !== null) {
      this.hotkeyLegend.hidden = !this.uiVisible;
    }
  }

  /**
   * Toggle audio mapping panel visibility
   */
  private toggleAudioMappingPanel(): void {
    const panel = document.getElementById('audio-mapping-panel');
    if (panel !== null) {
      const isHidden = panel.style.display === 'none' || panel.style.display === '';
      panel.style.display = isHidden ? 'block' : 'none';
    }
  }

  /**
   * Take a PNG snapshot
   */
  private takeSnapshot(): void {
    const canvas = this.app.getRenderer().getCanvas();
    takeSnapshot(canvas, 'audioshader');
  }

  /**
   * Toggle GIF recording
   */
  private toggleGifRecording(): void {
    if (this.gifRecorder === null) return;

    const indicator = document.getElementById('record-indicator');

    if (this.gifRecorder.isRecording) {
      this.gifRecorder.stop();
      if (indicator !== null) {
        indicator.style.display = 'none';
      }
    } else {
      this.gifRecorder.start();
      if (indicator !== null) {
        indicator.style.display = 'inline-block';
        indicator.textContent = 'RECORD 10.0s';
      }
    }
  }

  /**
   * Clear the screen
   */
  private clearScreen(): void {
    this.app.getRenderer().clearHistory();
  }

  /**
   * Cycle through presets
   */
  private cyclePreset(direction: number): void {
    if (this.presetNames.length === 0) return;

    let index = this.presetNames.indexOf(this.currentPresetName ?? '');
    if (index === -1) index = 0;

    index = (index + direction + this.presetNames.length) % this.presetNames.length;
    const name = this.presetNames[index];

    if (name !== undefined) {
      this.loadPreset(name);
      const select = document.getElementById('preset-select') as HTMLSelectElement | null;
      if (select !== null) {
        select.value = name;
      }
    }
  }

  /**
   * Accelerate auto params
   */
  private accelerate(): void {
    const params = this.app.getParams();
    this.app.setParam('autoRotationSpeed', Math.min(360, params.autoRotationSpeed + 0.5));
    this.app.setParam('hueShiftAmount', Math.min(0.2, params.hueShiftAmount + 0.0002));
    this.updateAllSliders();
  }

  /**
   * Decelerate auto params
   */
  private decelerate(): void {
    const params = this.app.getParams();
    this.app.setParam('autoRotationSpeed', params.autoRotationSpeed * 0.98);
    this.app.setParam('hueShiftAmount', params.hueShiftAmount * 0.98);
    this.updateAllSliders();
  }

  /**
   * Update status indicators
   */
  updateStatusIndicators(): void {
    const pause = document.getElementById('pause-indicator');
    const freeze = document.getElementById('freeze-indicator');
    const jiggle = document.getElementById('jiggle-indicator');
    const unsaved = document.getElementById('unsaved-indicator');

    // PAUSE = render loop stopped (spacebar)
    if (pause !== null) {
      pause.style.display = this.app.isFrozen() ? 'inline-block' : 'none';
    }

    // FREEZE = dilation frozen to 1.0 (F key)
    if (freeze !== null) {
      freeze.style.display = this.app.isDilationFrozen() ? 'inline-block' : 'none';
    }

    // Note: jiggle state would be tracked separately
    if (jiggle !== null) {
      // jiggle.style.display = this.jiggleEnabled ? 'inline-block' : 'none';
    }

    if (unsaved !== null) {
      unsaved.style.display = this.app.hasUnsavedChanges() ? 'inline-block' : 'none';
    }
  }

  /**
   * Update audio metrics display
   */
  updateAudioMetrics(metrics: AudioMetrics): void {
    // Update audio metrics visualization table
    const table = document.getElementById('audio-metrics-table');
    if (table !== null) {
      // Map metric names to AudioAnalyzer internal names for min/max lookup
      const metricToAnalyzerName: Record<string, { name: string; index?: number }> = {
        rms: { name: 'audioAmp' },
        bass: { name: 'bandEnergy', index: 0 },
        mid: { name: 'bandEnergy', index: 1 },
        high: { name: 'bandEnergy', index: 2 },
        presence: { name: 'bandEnergy', index: 2 }, // Use high band for presence
        harshness: { name: 'harshness' },
        mud: { name: 'mud' },
        compression: { name: 'compression' },
        collision: { name: 'collision' },
        coherence: { name: 'coherence' },
        stereoWidth: { name: 'stereoWidth', index: 1 }, // Use mid band
        phaseRisk: { name: 'phaseRisk' },
      };

      // Update each metric row
      for (const [name, value] of Object.entries(metrics)) {
        // Skip invalid metric names
        if (typeof name !== 'string' || name.length === 0) continue;
        
        const row = document.querySelector(`[data-metric="${name}"]`);
        if (row === null) continue;

        // Update text value
        const valueCell = row.querySelector('.metric-value');
        if (valueCell !== null) {
          try {
            valueCell.textContent = typeof value === 'number' ? value.toFixed(3) : String(value);
          } catch (err: unknown) {
            console.warn(`Failed to update metric value for ${name}:`, err);
          }
        }

        // Get min/max from AudioAnalyzer if available
        let minMax = { min: 0, max: 1 };
        const analyzerMapping = metricToAnalyzerName[name];
        if (this.audioAnalyzer !== null && analyzerMapping !== undefined) {
          try {
            minMax = this.audioAnalyzer.getMinMax(
              analyzerMapping.name as 'audioAmp' | 'bandEnergy' | 'harshness' | 'mud' | 'compression' | 'collision' | 'coherence' | 'phaseRisk' | 'stereoWidth',
              analyzerMapping.index
            );
          } catch (err: unknown) {
            // Use defaults if getMinMax fails
            console.debug(`Failed to get min/max for metric ${name}:`, err);
          }
        }

        // Update range display text
        const rangeCell = row.querySelector('.metric-range');
        if (rangeCell !== null) {
          rangeCell.textContent = `${minMax.min.toFixed(2)}-${minMax.max.toFixed(2)}`;
        }

        // Update bar visualization
        if (typeof value === 'number') {
          // Update range bar (shows min-max as filled area)
          const rangeBar = row.querySelector('.metric-bar-range') as HTMLElement | null;
          if (rangeBar !== null) {
            const rangeStart = Math.max(0, Math.min(100, minMax.min * 100));
            const rangeWidth = Math.max(0, Math.min(100 - rangeStart, (minMax.max - minMax.min) * 100));
            rangeBar.style.left = `${rangeStart}%`;
            rangeBar.style.width = `${rangeWidth}%`;
          }

          // Update current value marker
          const currentBar = row.querySelector('.metric-bar-current') as HTMLElement | null;
          if (currentBar !== null) {
            const percentage = Math.max(0, Math.min(100, value * 100));
            currentBar.style.left = `${percentage}%`;
            currentBar.style.background = value > 0.3 ? '#0fa' : '#0af';
          }
        }
      }
    }

    // Update mapping bars for each parameter
    this.updateMappingBars(metrics);
  }

  /**
   * Update the visualization bars for audio-mapped parameters
   */
  private updateMappingBars(metrics: AudioMetrics): void {
    try {
      const audioMapper = this.app.getAudioMapper();
      const mappableParams: Array<keyof VisualParams> = [
        'spikiness', 'spikeFrequency', 'spikeSharpness', 'hue', 'scale',
        'fillSize', 'fillOpacity', 'blendOpacity', 'expansionFactor',
        'fadeAmount', 'hueShiftAmount', 'rotation', 'autoRotationSpeed',
        'noiseAmount', 'noiseRate', 'blurAmount', 'blurRate', 'jiggleAmount',
        'emanationRate',
      ];

      for (const param of mappableParams) {
        try {
          const mod = audioMapper.getModulation(param);
          if (mod === undefined) continue;

          const slot = mod.slots[0];
          if (slot === undefined) continue;

          const bar = document.getElementById(`mapping-${param}-bar`);
          const valueDisplay = document.getElementById(`mapping-${param}-value`);

          // Get the current metric value and apply amount (depth)
          const metricValue = metrics[slot.source] ?? 0;
          const effectiveValue = Math.min(1, metricValue * slot.amount);

          if (bar !== null) {
            const barWidth = Math.max(0, Math.min(100, effectiveValue * 100));
            bar.style.width = `${barWidth}%`;

            if (mod.enabled) {
              bar.style.background = 'linear-gradient(90deg, #0af, #0fa)';
            } else {
              bar.style.background = '#555';
            }
          }

          if (valueDisplay !== null) {
            valueDisplay.textContent = effectiveValue.toFixed(2);
            if (mod.enabled && effectiveValue > 0.1) {
              valueDisplay.style.color = '#0af';
            } else {
              valueDisplay.style.color = '#888';
            }
          }
        } catch (err: unknown) {
          console.debug(`Error updating mapping bar for ${param}:`, err);
        }
      }
    } catch (err: unknown) {
      console.debug('Error in updateMappingBars:', err);
    }
  }

  /**
   * Helper to convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
