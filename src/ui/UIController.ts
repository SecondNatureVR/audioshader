/**
 * UI Controller
 * Handles all DOM interactions for the AudioShader UI
 */

import type { VisualParams, AudioMetrics } from '../types';
import {
  CurveMapper,
  getParamDefaultSettings,
  mapSliderToValue,
  reverseMapValueToSlider,
  DilationMapping,
  FadeMapping,
  EffectAmountMapping,
  EffectRateMapping,
  RotationSpeedMapping,
  type CurveSettings,
} from '../mapping/CurveMapping';
import type { BlendMode } from '../render/Renderer';
import type { App } from '../App';
import type { AudioAnalyzer } from '../audio/AudioAnalyzer';
import { takeSnapshot, GifRecorder } from '../capture/Capture';
import { type ResolutionKey, getResolutionDisplayString } from '../config/Resolution';

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
  private curveEditorOverlay: HTMLElement | null = null;

  // Slider references
  private sliders: Map<string, HTMLInputElement> = new Map();
  private valueDisplays: Map<string, HTMLElement> = new Map();

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
    this.updateAllSliders();
  }

  /**
   * Cache frequently accessed DOM elements
   */
  private cacheElements(): void {
    this.devToolbox = document.getElementById('dev-toolbox');
    this.hotkeyLegend = document.getElementById('hotkey-legend');
    this.curveEditorOverlay = document.getElementById('curve-editor-overlay');
  }

  /**
   * Setup all parameter sliders
   */
  private setupSliders(): void {
    // Shape sliders
    this.setupParamSlider('spikiness', 0, 100, 1);
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
      const sliderValue = parseFloat(target.value);
      const paramValue = this.sliderToParamValue(paramName, sliderValue);

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
   * Setup emanation rate slider (separate from visual params)
   */
  private setupEmanationRateSlider(): void {
    const slider = document.getElementById('emanation-rate-slider') as HTMLInputElement | null;
    const valueDisplay = document.getElementById('emanation-rate-value');

    if (slider === null) return;

    slider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const rate = parseFloat(target.value);
      this.app.setEmanationRate(rate);
      if (valueDisplay !== null) {
        valueDisplay.textContent = rate.toFixed(1);
      }
      this.config.onEmanationRateChange?.(rate);
    });

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
      const numValue = parseFloat(text.replace(/[^0-9.-]/g, ''));

      if (!isNaN(numValue)) {
        this.app.setParam(paramName as keyof VisualParams, numValue);
        this.updateSliderFromValue(paramName, numValue);
      }
      this.updateValueDisplay(paramName, this.app.getParam(paramName as keyof VisualParams));
    });

    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        element.blur();
      }
    });
  }

  /**
   * Convert slider value to parameter value using curve mapping
   */
  private sliderToParamValue(paramName: string, sliderValue: number): number {
    const settings = this.curveMapper.getSettings(paramName);

    // Special mappings for certain parameters
    switch (paramName) {
      case 'expansionFactor':
        return DilationMapping.sliderToFactor(sliderValue);
      case 'fadeAmount':
        return FadeMapping.sliderToAmount(sliderValue);
      case 'noiseAmount':
      case 'blurAmount':
        return EffectAmountMapping.sliderToAmount(sliderValue);
      case 'noiseRate':
      case 'blurRate':
        return EffectRateMapping.sliderToRate(sliderValue);
      case 'autoRotationSpeed':
        return RotationSpeedMapping.sliderToSpeed(sliderValue);
      default:
        return mapSliderToValue(sliderValue, settings);
    }
  }

  /**
   * Convert parameter value to slider value using curve mapping
   */
  private paramToSliderValue(paramName: string, paramValue: number): number {
    const settings = this.curveMapper.getSettings(paramName);

    switch (paramName) {
      case 'expansionFactor':
        return DilationMapping.factorToSlider(paramValue);
      case 'fadeAmount':
        return FadeMapping.amountToSlider(paramValue);
      case 'noiseAmount':
      case 'blurAmount':
        return EffectAmountMapping.amountToSlider(paramValue);
      case 'noiseRate':
      case 'blurRate':
        return EffectRateMapping.rateToSlider(paramValue);
      case 'autoRotationSpeed':
        return RotationSpeedMapping.speedToSlider(paramValue);
      default:
        return reverseMapValueToSlider(paramValue, settings);
    }
  }

  /**
   * Update value display for a parameter
   */
  private updateValueDisplay(paramName: string, value: number): void {
    const display = this.valueDisplays.get(paramName);
    if (display === null || display === undefined) return;

    // Format based on parameter type
    switch (paramName) {
      case 'hue':
      case 'rotation':
        display.textContent = `${Math.round(value)}°`;
        break;
      case 'autoRotationSpeed':
        display.textContent = `${value.toFixed(1)}°`;
        break;
      case 'expansionFactor':
        display.textContent = value.toFixed(4);
        break;
      case 'fadeAmount':
      case 'hueShiftAmount':
        display.textContent = value.toFixed(3);
        break;
      case 'spikeFrequency':
        display.textContent = value.toFixed(1);
        break;
      default:
        display.textContent = value.toFixed(2);
    }
  }

  /**
   * Update slider position from parameter value
   */
  private updateSliderFromValue(paramName: string, value: number): void {
    const slider = this.sliders.get(paramName);
    if (slider === null || slider === undefined) return;

    const sliderValue = this.paramToSliderValue(paramName, value);
    slider.value = String(sliderValue);
  }

  /**
   * Update all sliders from current app state
   */
  updateAllSliders(): void {
    const params = this.app.getParams();

    for (const [name, value] of Object.entries(params)) {
      this.updateSliderFromValue(name, value);
      this.updateValueDisplay(name, value);
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
      this.updateStatusIndicators();
      this.config.onPresetLoad?.(name);
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
      enableBtn.addEventListener('click', async () => {
        if (audioAnalyzer.isEnabled) {
          audioAnalyzer.disableAudio();
          resetAudioUI();
        } else {
          try {
            await audioAnalyzer.enableAudio();
            const mode = audioAnalyzer.isStereoMode ? 'STEREO' : 'MONO';
            setActiveUI(mode, false);
          } catch (err) {
            console.error('Failed to enable audio:', err);
            alert('Failed to enable audio: ' + (err instanceof Error ? err.message : String(err)));
          }
        }
      });
    }

    // Tab capture button handler
    if (tabBtn !== null) {
      tabBtn.addEventListener('click', async () => {
        if (audioAnalyzer.isEnabled) {
          audioAnalyzer.disableAudio();
          resetAudioUI();
        } else {
          try {
            await audioAnalyzer.enableTabAudio();
            const mode = audioAnalyzer.isStereoMode ? 'STEREO' : 'MONO';
            setActiveUI(mode, true);
          } catch (err) {
            console.error('Failed to capture tab audio:', err);
            alert('Failed to capture tab audio: ' + (err instanceof Error ? err.message : String(err)));
          }
        }
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
   * Generate the parameter mappings UI in the audio mapping panel
   */
  private generateParameterMappingsUI(): void {
    const container = document.getElementById('parameter-mappings-container');
    if (container === null) return;

    const mappableParams: Array<keyof VisualParams> = [
      'spikiness', 'spikeFrequency', 'spikeSharpness',
      'scale', 'hue', 'fillSize', 'fillOpacity',
      'autoRotationSpeed', 'hueShiftAmount', 'blendOpacity',
    ];

    // All available audio sources matching lucas.html
    const audioSources = [
      'rms', 'bass', 'mid', 'high', 'presence', 'harshness',
      'mud', 'compression', 'collision', 'coherence', 'stereoWidth', 'phaseRisk',
    ];

    // Get current mappings from AudioMapper
    const audioMapper = this.app.getAudioMapper();

    container.innerHTML = mappableParams.map((param) => {
      const mapping = audioMapper.getMapping(param);
      const currentSource = mapping?.source ?? 'rms';
      const currentEnabled = mapping?.enabled ?? false;
      const currentSensitivity = (mapping?.sensitivity ?? 1.0) * 100;

      return `
      <div class="mapping-row" style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 3px;">
        <input type="checkbox" id="mapping-${param}-enabled" data-param="${param}" ${currentEnabled ? 'checked' : ''} style="cursor: pointer;">
        <label for="mapping-${param}-enabled" style="font-size: 9px; color: #bbb; width: 100px; cursor: pointer;">${param}</label>
        <select id="mapping-${param}-source" data-param="${param}" style="font-size: 8px; padding: 2px; background: #333; color: #eee; border: 1px solid #555; border-radius: 2px;">
          ${audioSources.map((src) => `<option value="${src}" ${src === currentSource ? 'selected' : ''}>${src}</option>`).join('')}
        </select>
        <input type="range" id="mapping-${param}-sensitivity" data-param="${param}" min="0" max="200" value="${currentSensitivity}" style="width: 60px;">
      </div>
    `;
    }).join('');

    // Add event listeners for mapping controls
    mappableParams.forEach((param) => {
      const checkbox = document.getElementById(`mapping-${param}-enabled`) as HTMLInputElement | null;
      const sourceSelect = document.getElementById(`mapping-${param}-source`) as HTMLSelectElement | null;
      const sensitivitySlider = document.getElementById(`mapping-${param}-sensitivity`) as HTMLInputElement | null;

      if (checkbox !== null) {
        checkbox.addEventListener('change', () => {
          this.app.setAudioMapping(param, { enabled: checkbox.checked });
        });
      }

      if (sourceSelect !== null) {
        sourceSelect.addEventListener('change', () => {
          this.app.setAudioMapping(param, { source: sourceSelect.value as keyof AudioMetrics });
        });
      }

      if (sensitivitySlider !== null) {
        sensitivitySlider.addEventListener('input', () => {
          this.app.setAudioMapping(param, { sensitivity: parseFloat(sensitivitySlider.value) / 100 });
        });
      }
    });
  }

  /**
   * Setup curve editor modal
   */
  private setupCurveEditor(): void {
    const overlay = this.curveEditorOverlay;
    if (overlay === null) return;

    const closeBtn = document.getElementById('curve-editor-close');
    const doneBtn = document.getElementById('curve-close');
    const applyBtn = document.getElementById('curve-apply');
    const resetBtn = document.getElementById('curve-reset');
    const minInput = document.getElementById('curve-min') as HTMLInputElement | null;
    const maxInput = document.getElementById('curve-max') as HTMLInputElement | null;
    const powerSlider = document.getElementById('curve-power') as HTMLInputElement | null;
    const powerValue = document.getElementById('curve-power-value');

    // Close handlers
    const closeCurve = (): void => {
      overlay.classList.remove('active');
      this.currentCurveParam = null;
    };

    if (closeBtn !== null) closeBtn.addEventListener('click', closeCurve);
    if (doneBtn !== null) doneBtn.addEventListener('click', closeCurve);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCurve();
    });

    // Apply handler
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
    };

    if (applyBtn !== null) applyBtn.addEventListener('click', applyCurve);
    if (minInput !== null) minInput.addEventListener('input', applyCurve);
    if (maxInput !== null) maxInput.addEventListener('input', applyCurve);

    if (powerSlider !== null) {
      powerSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        if (powerValue !== null) {
          powerValue.textContent = value.toFixed(2);
        }
        applyCurve();
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
   * Open curve editor for a parameter
   */
  private openCurveEditor(paramName: string): void {
    if (this.curveEditorOverlay === null) return;

    this.currentCurveParam = paramName;

    const settings = this.curveMapper.getSettings(paramName) ?? getParamDefaultSettings(paramName as keyof VisualParams);
    if (settings === null) return;

    const title = document.getElementById('curve-editor-title');
    const minInput = document.getElementById('curve-min') as HTMLInputElement | null;
    const maxInput = document.getElementById('curve-max') as HTMLInputElement | null;
    const powerSlider = document.getElementById('curve-power') as HTMLInputElement | null;
    const powerValue = document.getElementById('curve-power-value');

    if (title !== null) title.textContent = `Curve Editor: ${paramName}`;
    if (minInput !== null) minInput.value = String(settings.min);
    if (maxInput !== null) maxInput.value = String(settings.max);
    if (powerSlider !== null) powerSlider.value = String(settings.power);
    if (powerValue !== null) powerValue.textContent = settings.power.toFixed(2);

    this.curveEditorOverlay.classList.add('active');
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
    if (table === null) return;

    // Update each metric row
    for (const [name, value] of Object.entries(metrics)) {
      const row = document.querySelector(`[data-metric="${name}"]`);
      if (row !== null) {
        const valueCell = row.querySelector('.metric-value');
        if (valueCell !== null) {
          valueCell.textContent = typeof value === 'number' ? value.toFixed(3) : String(value);
        }
      }
    }
  }

  /**
   * Helper to convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
