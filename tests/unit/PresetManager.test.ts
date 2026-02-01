import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresetManager } from '../../src/presets/PresetManager';
import { createDefaultParams } from '../../src/render/Parameters';
import type { VisualParams } from '../../src/types';

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
});
