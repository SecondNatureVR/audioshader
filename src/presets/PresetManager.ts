/**
 * Preset management system
 * Handles saving, loading, import/export of visual presets
 */

import type { VisualParams, AudioMappings, Preset, BlendMode, LegacyAudioMappings } from '../types';
import { DEFAULT_PARAMS } from '../render/Parameters';
import { getDefaultPresetsMap, migrateOldLocalStorage, getDefaultEmanationRate, getDefaultBlendMode } from './defaultPresets';
import { migrateLegacyMappings } from '../audio/AudioMapper';

const STORAGE_KEY = 'audioshader_presets';
const CURRENT_PRESET_KEY = 'audioshader_current_preset';
const MIGRATION_KEY = 'audioshader_migrated';

export class PresetManager {
  private presets: Map<string, Preset> = new Map();
  private currentPresetName: string | null = null;
  private onChangeCallbacks: Array<() => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load presets from localStorage, with migration and defaults
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored !== null) {
        // User has existing presets in new format
        const data = JSON.parse(stored) as Record<string, Preset>;
        this.presets = new Map(Object.entries(data));

        // Migrate: add missing emanationRate, blendMode, and audio mappings from defaults
        let needsSave = false;
        for (const [name, preset] of this.presets) {
          if (preset.emanationRate === undefined) {
            const defaultRate = getDefaultEmanationRate(name);
            if (defaultRate !== undefined) {
              preset.emanationRate = defaultRate;
              needsSave = true;
            }
          }
          if (preset.blendMode === undefined) {
            const defaultMode = getDefaultBlendMode(name);
            if (defaultMode !== undefined) {
              preset.blendMode = defaultMode;
              needsSave = true;
            }
          }
          // Migrate legacy flat AudioMappingConfig to slot-based ParameterModulation
          if (preset.audioMappings !== undefined) {
            const migrated = PresetManager.migrateAudioMappingsIfNeeded(preset.audioMappings as AudioMappings | LegacyAudioMappings);
            if (migrated !== null) {
              preset.audioMappings = migrated;
              needsSave = true;
            }
          }
        }
        if (needsSave) {
          this.saveToStorage();
        }
      } else {
        // No new-format presets - try migration or use defaults
        const hasMigrated = localStorage.getItem(MIGRATION_KEY) === 'true';

        if (!hasMigrated) {
          // Try to migrate from old sandboxPresets
          const migrated = migrateOldLocalStorage();
          if (migrated !== null && migrated.size > 0) {
            this.presets = migrated;
            this.saveToStorage();
            localStorage.setItem(MIGRATION_KEY, 'true');
            console.info(`Migrated ${migrated.size} presets from old format`);
          } else {
            // No old presets found - load defaults
            this.presets = getDefaultPresetsMap();
            this.saveToStorage();
            localStorage.setItem(MIGRATION_KEY, 'true');
            console.info(`Loaded ${this.presets.size} default presets`);
          }
        }
        // If already migrated but storage is empty, keep empty (user cleared presets)
      }

      const currentName = localStorage.getItem(CURRENT_PRESET_KEY);
      if (currentName !== null && this.presets.has(currentName)) {
        this.currentPresetName = currentName;
      }
    } catch (error) {
      console.error('Failed to load presets from storage:', error);
      // Fallback to defaults on error
      this.presets = getDefaultPresetsMap();
    }
  }

  /**
   * Save presets to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: Record<string, Preset> = {};
      this.presets.forEach((preset, name) => {
        data[name] = preset;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      if (this.currentPresetName !== null) {
        localStorage.setItem(CURRENT_PRESET_KEY, this.currentPresetName);
      } else {
        localStorage.removeItem(CURRENT_PRESET_KEY);
      }
    } catch (error) {
      console.error('Failed to save presets to storage:', error);
    }
  }

  /**
   * Get all preset names
   */
  getPresetNames(): string[] {
    return Array.from(this.presets.keys()).sort();
  }

  /**
   * Get the current preset name
   */
  getCurrentPresetName(): string | null {
    return this.currentPresetName;
  }

  /**
   * Get a preset by name
   */
  getPreset(name: string): Preset | null {
    return this.presets.get(name) ?? null;
  }

  /**
   * Save current parameters as a new preset or overwrite existing
   */
  savePreset(
    name: string,
    params: VisualParams,
    audioMappings?: AudioMappings,
    emanationRate?: number,
    blendMode?: BlendMode
  ): void {
    const now = new Date().toISOString();
    const existing = this.presets.get(name);

    const preset: Preset = {
      name,
      params: { ...params },
      blendMode: blendMode ?? existing?.blendMode,
      emanationRate: emanationRate ?? existing?.emanationRate,
      audioMappings: audioMappings !== undefined ? { ...audioMappings } : undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.presets.set(name, preset);
    this.currentPresetName = name;
    this.saveToStorage();
    this.notifyChange();
  }

  /**
   * Load a preset by name
   */
  loadPreset(name: string): Preset | null {
    const preset = this.presets.get(name);
    if (preset === undefined) {
      return null;
    }

    this.currentPresetName = name;
    this.saveToStorage();
    this.notifyChange();

    return {
      ...preset,
      params: { ...preset.params },
      audioMappings: preset.audioMappings !== undefined ? { ...preset.audioMappings } : undefined,
    };
  }

  /**
   * Delete a preset by name
   */
  deletePreset(name: string): boolean {
    if (!this.presets.has(name)) {
      return false;
    }

    this.presets.delete(name);

    if (this.currentPresetName === name) {
      this.currentPresetName = null;
    }

    this.saveToStorage();
    this.notifyChange();
    return true;
  }

  /**
   * Rename a preset
   */
  renamePreset(oldName: string, newName: string): boolean {
    const preset = this.presets.get(oldName);
    if (preset === undefined) {
      return false;
    }

    if (this.presets.has(newName)) {
      return false; // Name already exists
    }

    preset.name = newName;
    preset.updatedAt = new Date().toISOString();

    this.presets.delete(oldName);
    this.presets.set(newName, preset);

    if (this.currentPresetName === oldName) {
      this.currentPresetName = newName;
    }

    this.saveToStorage();
    this.notifyChange();
    return true;
  }

  /**
   * Check if current parameters differ from the loaded preset
   */
  hasUnsavedChanges(currentParams: VisualParams): boolean {
    if (this.currentPresetName === null) {
      // No preset loaded, check if params differ from defaults
      return !this.paramsEqual(currentParams, DEFAULT_PARAMS);
    }

    const preset = this.presets.get(this.currentPresetName);
    if (preset === undefined) {
      return true;
    }

    return !this.paramsEqual(currentParams, preset.params);
  }

  /**
   * Compare two VisualParams objects for equality
   */
  private paramsEqual(a: VisualParams, b: VisualParams): boolean {
    const keys = Object.keys(a) as Array<keyof VisualParams>;
    return keys.every((key) => Math.abs(a[key] - b[key]) < 0.0001);
  }

  /**
   * Export all presets as JSON string
   */
  exportAll(): string {
    const data: Record<string, Preset> = {};
    this.presets.forEach((preset, name) => {
      data[name] = preset;
    });
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export a single preset as JSON string
   */
  exportPreset(name: string): string | null {
    const preset = this.presets.get(name);
    if (preset === undefined) {
      return null;
    }
    return JSON.stringify(preset, null, 2);
  }

  /**
   * Import presets from JSON string
   */
  importPresets(json: string, overwrite: boolean = false): number {
    try {
      const data = JSON.parse(json) as Record<string, Preset> | Preset;

      // Handle single preset or multiple presets
      const presets: Record<string, Preset> =
        'name' in data && typeof data.name === 'string'
          ? { [data.name]: data as Preset }
          : (data as Record<string, Preset>);

      let imported = 0;

      for (const [name, preset] of Object.entries(presets)) {
        if (!overwrite && this.presets.has(name)) {
          continue;
        }

        // Validate preset structure
        if (this.isValidPreset(preset)) {
          this.presets.set(name, preset);
          imported++;
        }
      }

      if (imported > 0) {
        this.saveToStorage();
        this.notifyChange();
      }

      return imported;
    } catch (error) {
      console.error('Failed to import presets:', error);
      return 0;
    }
  }

  /**
   * Validate preset structure
   */
  private isValidPreset(preset: unknown): preset is Preset {
    if (typeof preset !== 'object' || preset === null) {
      return false;
    }

    const p = preset as Record<string, unknown>;

    if (typeof p['name'] !== 'string') {
      return false;
    }

    if (typeof p['params'] !== 'object' || p['params'] === null) {
      return false;
    }

    // Check required param fields exist
    const params = p['params'] as Record<string, unknown>;
    const requiredParams: Array<keyof VisualParams> = [
      'spikiness',
      'spikeFrequency',
      'scale',
      'hue',
    ];

    return requiredParams.every((key) => typeof params[key] === 'number');
  }

  /**
   * Clear the current preset selection (mark as unsaved)
   */
  clearCurrentPreset(): void {
    this.currentPresetName = null;
    this.saveToStorage();
    this.notifyChange();
  }

  /**
   * Register a callback for preset changes
   */
  onChange(callback: () => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      const index = this.onChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.onChangeCallbacks.splice(index, 1);
      }
    };
  }

  private notifyChange(): void {
    this.onChangeCallbacks.forEach((cb) => cb());
  }

  /**
   * Get the number of saved presets
   */
  get count(): number {
    return this.presets.size;
  }

  /**
   * Reset all presets to defaults
   */
  resetToDefaults(): void {
    this.presets = getDefaultPresetsMap();
    this.currentPresetName = null;
    this.saveToStorage();
    this.notifyChange();
  }

  /**
   * Merge default presets with current presets (adds missing defaults)
   */
  addMissingDefaults(): number {
    const defaults = getDefaultPresetsMap();
    let added = 0;

    defaults.forEach((preset, name) => {
      if (!this.presets.has(name)) {
        this.presets.set(name, preset);
        added++;
      }
    });

    if (added > 0) {
      this.saveToStorage();
      this.notifyChange();
    }

    return added;
  }

  /**
   * Check if audio mappings are in legacy format and migrate if needed.
   * Returns migrated AudioMappings or null if already in new format.
   */
  static migrateAudioMappingsIfNeeded(
    mappings: AudioMappings | LegacyAudioMappings
  ): AudioMappings | null {
    // Check if it's legacy format by looking at the first non-undefined entry
    const firstEntry = Object.values(mappings).find((v) => v !== undefined && v !== null);
    if (firstEntry === undefined || firstEntry === null) return null;

    // Legacy format has 'sensitivity' field; new format has 'slots' field
    if ('sensitivity' in firstEntry) {
      return migrateLegacyMappings(mappings as LegacyAudioMappings);
    }

    // Already new format
    return null;
  }
}
