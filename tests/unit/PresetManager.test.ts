import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresetManager } from '../../src/presets/PresetManager';
import { createDefaultParams } from '../../src/render/Parameters';
import type { VisualParams, LegacyAudioMappings, AudioMappings, ParameterModulation } from '../../src/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('PresetManager', () => {
  let presetManager: PresetManager;
  let testParams: VisualParams;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Set migration key to prevent loading default presets in tests
    localStorageMock.setItem('audioshader_migrated', 'true');
    presetManager = new PresetManager();
    testParams = createDefaultParams();
    testParams.spikiness = 0.8;
    testParams.hue = 200;
  });

  describe('initialization', () => {
    it('should start with no presets', () => {
      expect(presetManager.getPresetNames()).toHaveLength(0);
    });

    it('should have no current preset', () => {
      expect(presetManager.getCurrentPresetName()).toBeNull();
    });
  });

  describe('savePreset', () => {
    it('should save a new preset', () => {
      presetManager.savePreset('Test Preset', testParams);

      expect(presetManager.getPresetNames()).toContain('Test Preset');
    });

    it('should set current preset name after saving', () => {
      presetManager.savePreset('Test Preset', testParams);

      expect(presetManager.getCurrentPresetName()).toBe('Test Preset');
    });

    it('should persist to localStorage', () => {
      presetManager.savePreset('Test Preset', testParams);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should overwrite existing preset with same name', () => {
      presetManager.savePreset('Test', testParams);

      const newParams = { ...testParams, spikiness: 0.1 };
      presetManager.savePreset('Test', newParams);

      const loaded = presetManager.getPreset('Test');
      expect(loaded?.params.spikiness).toBe(0.1);
    });

    it('should save and load emanationRate', () => {
      presetManager.savePreset('WithRate', testParams, undefined, 150);

      const loaded = presetManager.getPreset('WithRate');
      expect(loaded?.emanationRate).toBe(150);
    });

    it('should preserve emanationRate when overwriting preset', () => {
      presetManager.savePreset('Test', testParams, undefined, 100);

      // Save again without specifying emanationRate
      const newParams = { ...testParams, spikiness: 0.1 };
      presetManager.savePreset('Test', newParams);

      const loaded = presetManager.getPreset('Test');
      expect(loaded?.emanationRate).toBe(100); // Should preserve existing rate
    });
  });

  describe('loadPreset', () => {
    beforeEach(() => {
      presetManager.savePreset('Test Preset', testParams);
    });

    it('should load an existing preset', () => {
      const loaded = presetManager.loadPreset('Test Preset');

      expect(loaded).not.toBeNull();
      expect(loaded?.params.spikiness).toBe(testParams.spikiness);
    });

    it('should return null for non-existent preset', () => {
      const loaded = presetManager.loadPreset('Non-existent');

      expect(loaded).toBeNull();
    });

    it('should return a copy, not the original', () => {
      const loaded1 = presetManager.loadPreset('Test Preset');
      const loaded2 = presetManager.loadPreset('Test Preset');

      expect(loaded1).not.toBe(loaded2);
      expect(loaded1?.params).not.toBe(loaded2?.params);
    });
  });

  describe('deletePreset', () => {
    beforeEach(() => {
      presetManager.savePreset('Test Preset', testParams);
    });

    it('should delete an existing preset', () => {
      const result = presetManager.deletePreset('Test Preset');

      expect(result).toBe(true);
      expect(presetManager.getPresetNames()).not.toContain('Test Preset');
    });

    it('should return false for non-existent preset', () => {
      const result = presetManager.deletePreset('Non-existent');

      expect(result).toBe(false);
    });

    it('should clear current preset if deleted', () => {
      presetManager.deletePreset('Test Preset');

      expect(presetManager.getCurrentPresetName()).toBeNull();
    });
  });

  describe('renamePreset', () => {
    beforeEach(() => {
      presetManager.savePreset('Original', testParams);
    });

    it('should rename a preset', () => {
      const result = presetManager.renamePreset('Original', 'Renamed');

      expect(result).toBe(true);
      expect(presetManager.getPresetNames()).toContain('Renamed');
      expect(presetManager.getPresetNames()).not.toContain('Original');
    });

    it('should update current preset name if renamed', () => {
      presetManager.renamePreset('Original', 'Renamed');

      expect(presetManager.getCurrentPresetName()).toBe('Renamed');
    });

    it('should fail if new name already exists', () => {
      presetManager.savePreset('Existing', testParams);

      const result = presetManager.renamePreset('Original', 'Existing');

      expect(result).toBe(false);
    });
  });

  describe('hasUnsavedChanges', () => {
    it('should return false for default params with no preset loaded', () => {
      const defaultParams = createDefaultParams();

      expect(presetManager.hasUnsavedChanges(defaultParams)).toBe(false);
    });

    it('should return true when current params differ from loaded preset', () => {
      presetManager.savePreset('Test', testParams);

      const modifiedParams = { ...testParams, spikiness: 0.1 };

      expect(presetManager.hasUnsavedChanges(modifiedParams)).toBe(true);
    });

    it('should return false when current params match loaded preset', () => {
      presetManager.savePreset('Test', testParams);

      expect(presetManager.hasUnsavedChanges(testParams)).toBe(false);
    });
  });

  describe('export/import', () => {
    beforeEach(() => {
      presetManager.savePreset('Preset1', testParams);
      presetManager.savePreset('Preset2', { ...testParams, hue: 100 });
    });

    it('should export all presets as JSON', () => {
      const json = presetManager.exportAll();
      const parsed = JSON.parse(json);

      expect(Object.keys(parsed)).toHaveLength(2);
      expect(parsed).toHaveProperty('Preset1');
      expect(parsed).toHaveProperty('Preset2');
    });

    it('should export a single preset as JSON', () => {
      const json = presetManager.exportPreset('Preset1');

      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.name).toBe('Preset1');
    });

    it('should import presets from JSON', () => {
      const json = presetManager.exportAll();

      // Clear localStorage so the new manager starts empty
      localStorageMock.clear();
      const newManager = new PresetManager();

      const imported = newManager.importPresets(json);

      expect(imported).toBe(2);
      expect(newManager.getPresetNames()).toContain('Preset1');
      expect(newManager.getPresetNames()).toContain('Preset2');
    });

    it('should not overwrite existing presets by default', () => {
      const newManager = new PresetManager();
      newManager.savePreset('Preset1', { ...testParams, spikiness: 0.1 });

      const json = presetManager.exportAll();
      newManager.importPresets(json, false);

      const preset = newManager.getPreset('Preset1');
      expect(preset?.params.spikiness).toBe(0.1); // Should keep original
    });
  });

  describe('count', () => {
    it('should return 0 for empty manager', () => {
      expect(presetManager.count).toBe(0);
    });

    it('should return correct count after adding presets', () => {
      presetManager.savePreset('P1', testParams);
      presetManager.savePreset('P2', testParams);

      expect(presetManager.count).toBe(2);
    });
  });

  describe('default presets', () => {
    beforeEach(() => {
      // Don't set migrated flag so defaults are loaded
      localStorageMock.clear();
    });

    it('should load default presets with emanationRate', () => {
      const manager = new PresetManager();

      // VHS preset should have emanationRate
      const vhs = manager.getPreset('VHS');
      expect(vhs).not.toBeNull();
      expect(vhs?.emanationRate).toBe(300);

      // Other presets should also have emanationRate
      const burn = manager.getPreset('Burn');
      expect(burn).not.toBeNull();
      expect(burn?.emanationRate).toBe(30);
    });

    it('should have emanationRate on all default presets', () => {
      const manager = new PresetManager();
      const names = manager.getPresetNames();

      // All default presets should have emanationRate defined
      for (const name of names) {
        const preset = manager.getPreset(name);
        expect(preset?.emanationRate).toBeDefined();
        expect(typeof preset?.emanationRate).toBe('number');
      }
    });

    it('should migrate emanationRate from defaults when loading stored presets without it', () => {
      // Simulate stored presets without emanationRate (as if saved before emanationRate was added)
      const storedPresets = {
        'VHS': {
          name: 'VHS',
          params: { spikiness: 0.24, spikeFrequency: 3.77, spikeSharpness: 0.3, hue: 294.9,
            scale: 0.99, fillSize: 0.99, fillOpacity: 0.02, blendOpacity: 0.14,
            expansionFactor: 0.966, fadeAmount: 3.8, hueShiftAmount: 0.036, rotation: 0,
            noiseAmount: 0, noiseRate: 0, blurAmount: 0, blurRate: 0,
            autoRotationSpeed: 13, jiggleAmount: 0.3 },
          // Note: no emanationRate!
        },
      };
      localStorageMock.setItem('audioshader_presets', JSON.stringify(storedPresets));

      const manager = new PresetManager();
      const vhs = manager.getPreset('VHS');

      // Should have migrated emanationRate from defaults
      expect(vhs?.emanationRate).toBe(300);
    });
  });

  describe('audio mapping migration', () => {
    it('migrateAudioMappingsIfNeeded should detect legacy format', () => {
      const legacy: LegacyAudioMappings = {
        spikiness: {
          enabled: true,
          source: 'collision',
          sensitivity: 0.6,
          smoothing: 0.5,
          multiplier: 1,
          offset: 0,
          invert: false,
          minValue: 0,
          maxValue: 1,
        },
      };

      const result = PresetManager.migrateAudioMappingsIfNeeded(legacy);
      expect(result).not.toBeNull();
      expect(result!.spikiness).toBeDefined();
      expect(result!.spikiness!.enabled).toBe(true);
      expect(result!.spikiness!.slots).toHaveLength(1);
      expect(result!.spikiness!.slots[0]!.source).toBe('collision');
      expect(result!.spikiness!.slots[0]!.amount).toBe(0.6);
    });

    it('migrateAudioMappingsIfNeeded should return null for new format', () => {
      const newFormat: AudioMappings = {
        spikiness: {
          enabled: true,
          slots: [{
            source: 'collision',
            amount: 0.5,
            smoothing: 0.5,
            invert: false,
            curve: 1.0,
            rangeMin: 0,
            rangeMax: 1,
          }],
        },
      };

      const result = PresetManager.migrateAudioMappingsIfNeeded(newFormat);
      expect(result).toBeNull();
    });

    it('migrateAudioMappingsIfNeeded should return null for empty mappings', () => {
      const result = PresetManager.migrateAudioMappingsIfNeeded({});
      expect(result).toBeNull();
    });

    it('should auto-migrate legacy audio mappings on load from storage', () => {
      const storedPresets: Record<string, unknown> = {
        TestPreset: {
          name: 'TestPreset',
          params: createDefaultParams(),
          audioMappings: {
            scale: {
              enabled: true,
              source: 'bass',
              sensitivity: 0.8,
              smoothing: 0.3,
              multiplier: 1.0,
              offset: 0,
              invert: false,
              minValue: 0,
              maxValue: 1,
            },
          },
        },
      };

      localStorageMock.setItem('audioshader_presets', JSON.stringify(storedPresets));

      const manager = new PresetManager();
      const preset = manager.getPreset('TestPreset');
      expect(preset).not.toBeNull();
      expect(preset!.audioMappings).toBeDefined();

      // Should have been migrated to new slot format
      const scaleMod = preset!.audioMappings!.scale as ParameterModulation;
      expect(scaleMod).toBeDefined();
      expect(scaleMod.enabled).toBe(true);
      expect(scaleMod.slots).toHaveLength(1);
      expect(scaleMod.slots[0]!.source).toBe('bass');
      expect(scaleMod.slots[0]!.amount).toBe(0.8);
    });
  });
});
