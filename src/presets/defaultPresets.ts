/**
 * Default presets for AudioShader
 * Converted from lucas.html sandbox-presets.json
 */

import type { VisualParams, Preset } from '../types';
import { DilationMapping, FadeMapping } from '../mapping/CurveMapping';

/**
 * Raw preset data from old format
 * Contains dilationSlider/fadeSlider values that need conversion
 */
interface RawPreset {
  spikiness?: number;
  spikes?: number; // Old name for spikiness
  spikeFrequency?: number;
  spikeSharpness?: number;
  hue?: number;
  scale?: number;
  fillSize?: number;
  fillOpacity?: number;
  blendOpacity?: number;
  dilationSlider?: number;
  fadeSlider?: number;
  expansionFactor?: number; // Already converted
  fadeAmount?: number; // Already converted
  hueShiftAmount?: number;
  rotation?: number;
  blendMode?: string;
  emanationRate?: number;
  noiseAmount?: number;
  noiseRate?: number;
  blurAmount?: number;
  blurRate?: number;
  autoRotationSpeed?: number;
  autoRotationSlider?: number;
  jiggleAmount?: number;
  jiggleEnabledParams?: Record<string, boolean>;
  audioMapping?: Record<string, unknown>;
  dilationPolarityFlip?: boolean;
}

/**
 * Convert raw preset to VisualParams
 */
function convertRawPreset(raw: RawPreset): VisualParams {
  // Handle spikes -> spikiness rename
  const spikiness = raw.spikiness ?? raw.spikes ?? 0.5;

  // Convert slider values to actual values
  const expansionFactor = raw.expansionFactor ??
    (raw.dilationSlider !== undefined ? DilationMapping.sliderToFactor(raw.dilationSlider) : 1.005);
  const fadeAmount = raw.fadeAmount ??
    (raw.fadeSlider !== undefined ? FadeMapping.sliderToAmount(raw.fadeSlider) : 0.02);

  return {
    spikiness,
    spikeFrequency: raw.spikeFrequency ?? 5,
    spikeSharpness: raw.spikeSharpness ?? 0.5,
    hue: raw.hue ?? 180,
    scale: raw.scale ?? 0.5,
    fillSize: raw.fillSize ?? 0,
    fillOpacity: raw.fillOpacity ?? 0.5,
    blendOpacity: raw.blendOpacity ?? 0.5,
    expansionFactor,
    fadeAmount,
    hueShiftAmount: raw.hueShiftAmount ?? 0,
    rotation: raw.rotation ?? 0,
    noiseAmount: raw.noiseAmount ?? 0,
    noiseRate: raw.noiseRate ?? 0,
    blurAmount: raw.blurAmount ?? 0,
    blurRate: raw.blurRate ?? 0,
    autoRotationSpeed: raw.autoRotationSpeed ?? 0,
    jiggleAmount: raw.jiggleAmount ?? 0.3,
  };
}

/**
 * Create a Preset from name and raw data
 */
function createPreset(name: string, raw: RawPreset): Preset {
  return {
    name,
    params: convertRawPreset(raw),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Raw preset data from sandbox-presets.json
 */
const RAW_PRESETS: Record<string, RawPreset> = {
  "Burn": {
    spikes: 5, hue: 45, scale: 0.88, dilationSlider: 100, fadeSlider: 93,
    hueShiftAmount: 0.03, rotation: 0, blendOpacity: 0.03, autoRotationSpeed: 10
  },
  "Rainbow": {
    spikes: 5, hue: 45, scale: 0.64, dilationSlider: 88, fadeSlider: 48,
    hueShiftAmount: 0.154, rotation: 0, blendOpacity: 0.08, autoRotationSpeed: 0
  },
  "Spray": {
    spikes: 5, hue: 1, scale: 0.05, dilationSlider: 144, fadeSlider: 80,
    hueShiftAmount: 0.124, rotation: 0, blendOpacity: 0.27, autoRotationSpeed: 294.49
  },
  "Flower": {
    spikes: 5, hue: 175, scale: 0.82, dilationSlider: 96, fadeSlider: 100,
    hueShiftAmount: 0.072, rotation: 0, blendOpacity: 0.08, autoRotationSpeed: 326.89
  },
  "Portal": {
    spikiness: 0.18, spikeFrequency: 11.4, spikeSharpness: 0.48, hue: 91,
    scale: 1, dilationSlider: 97, fadeSlider: 81, hueShiftAmount: 0.029,
    rotation: 0, blendOpacity: 1, autoRotationSpeed: 0
  },
  "Braid": {
    spikiness: 0.08, spikeFrequency: 20, spikeSharpness: 0, hue: 175,
    scale: 0.82, fillSize: 0, fillOpacity: 0.5, dilationSlider: 96, fadeSlider: 100,
    hueShiftAmount: 0.036, rotation: 148, blendOpacity: 0.14, autoRotationSpeed: 121.42
  },
  "Pool": {
    spikiness: 0.05, spikeFrequency: 3.4, spikeSharpness: 0, hue: 175,
    scale: 0.47, fillSize: 1, fillOpacity: 0.19, dilationSlider: 99, fadeSlider: 0,
    hueShiftAmount: 0.192, rotation: 231, blendOpacity: 0.73, autoRotationSpeed: 217.1
  },
  "Cross": {
    spikiness: 0, spikeFrequency: 10.01, spikeSharpness: 0.38, hue: 357.1,
    scale: 0.89, fillSize: 0.15, fillOpacity: 0.82, dilationSlider: 95, fadeSlider: 19,
    hueShiftAmount: 0.12, rotation: 183.6, blendOpacity: 0.6, autoRotationSpeed: 88.2
  },
  "Wash": {
    spikiness: 0.15, spikeFrequency: 18.83, spikeSharpness: 0.7, hue: 320.5,
    scale: 0.2, fillSize: 0.35, fillOpacity: 0.78, dilationSlider: 110, fadeSlider: 83,
    hueShiftAmount: 0.11, rotation: 42.5, blendOpacity: 0.9, autoRotationSpeed: 94.6
  },
  "Wiggle": {
    spikiness: 0.12, spikeFrequency: 10.9, spikeSharpness: 0.42, hue: 77.5,
    scale: 0.99, fillSize: 0.49, fillOpacity: 0.05, dilationSlider: 96, fadeSlider: 95,
    hueShiftAmount: 0.019, rotation: 9.2, blendOpacity: 1, autoRotationSpeed: 8.6
  },
  "VHS": {
    spikiness: 0.24, spikeFrequency: 3.77, spikeSharpness: 0.3, hue: 294.9,
    scale: 0.99, fillSize: 0.99, fillOpacity: 0.02, dilationSlider: 93, fadeSlider: 44,
    hueShiftAmount: 0.036, rotation: 0, blendOpacity: 0.14, autoRotationSpeed: 13
  },
  "Dive": {
    spikiness: 0.53, spikeFrequency: 7.78, spikeSharpness: 0.33, hue: 88.9,
    scale: 0.05, fillSize: 0, fillOpacity: 0.39, dilationSlider: 174, fadeSlider: 4,
    hueShiftAmount: 0, rotation: 0, blendOpacity: 0, autoRotationSpeed: 1.5
  },
  "JiggleFreezeGlitch": {
    spikiness: 0.7, spikeFrequency: 5.41, spikeSharpness: 0, hue: 92.5,
    scale: 0.67, fillSize: 0, fillOpacity: 0.86, dilationSlider: 124, fadeSlider: 46,
    hueShiftAmount: 0.06, rotation: 86.3, blendOpacity: 0.66, autoRotationSpeed: 275.7
  },
  "Conch": {
    spikiness: 0.77, spikeFrequency: 3.8, spikeSharpness: 0, hue: 175,
    scale: 0.82, fillSize: 0, fillOpacity: 0.5, dilationSlider: 98, fadeSlider: 100,
    hueShiftAmount: 0.022, rotation: 0, blendOpacity: 0.14, autoRotationSpeed: 74.8
  },
  "Smoke": {
    spikiness: 0.5, spikeFrequency: 5.6, spikeSharpness: 0.79, hue: 31.5,
    scale: 0.84, fillSize: 0.34, fillOpacity: 0.55, dilationSlider: 101, fadeSlider: 87,
    hueShiftAmount: 0.033, rotation: 228, blendOpacity: 0.21, autoRotationSpeed: 327.1
  },
  "Corduroy": {
    spikiness: 0.03, spikeFrequency: 100, spikeSharpness: 1, hue: 325.7,
    scale: 0.26, fillSize: 0.11, fillOpacity: 0.82, dilationSlider: 170, fadeSlider: 100,
    hueShiftAmount: 0, rotation: 0, blendOpacity: 0.2,
    noiseAmount: 0.022, noiseRate: 10, blurAmount: 1, blurRate: 0,
    autoRotationSpeed: 224.4
  },
  "Moire": {
    spikiness: 1, spikeFrequency: 200, spikeSharpness: 1, hue: 325.7,
    scale: 1, fillSize: 0.17, fillOpacity: 0.52, dilationSlider: 162, fadeSlider: 100,
    hueShiftAmount: 0.007, rotation: 0, blendOpacity: 0.2,
    noiseAmount: 0.035, noiseRate: 6.23, blurAmount: 0, blurRate: 0,
    autoRotationSpeed: 6.52
  },
  "Conway": {
    spikiness: 2, spikeFrequency: 500, spikeSharpness: 0, hue: 325.7,
    scale: 1, fillSize: 0, fillOpacity: 0.15, dilationSlider: 158, fadeSlider: 100,
    hueShiftAmount: 0.009, rotation: 0, blendOpacity: 0.2,
    noiseAmount: 0.006, noiseRate: 300, blurAmount: 0.0007, blurRate: 300,
    autoRotationSpeed: 101.1
  },
  "Doughnut": {
    spikiness: 0.3, spikeFrequency: 2000, spikeSharpness: 0.14, hue: 294.9,
    scale: 1, fillSize: 0.76, fillOpacity: 0.03, dilationSlider: 100, fadeSlider: 100,
    hueShiftAmount: 0.072, rotation: 0, blendOpacity: 0.14,
    noiseAmount: 0.018, noiseRate: 9000, blurAmount: 0.0001, blurRate: 9997,
    autoRotationSpeed: -1
  },
  "Sparkle": {
    spikiness: 11.81, spikeFrequency: 1546, spikeSharpness: 1, hue: 294.9,
    scale: 1, fillSize: 1, fillOpacity: 0.28, dilationSlider: 100, fadeSlider: 6,
    hueShiftAmount: 1.08, rotation: 0, blendOpacity: 0.04,
    noiseAmount: 0.069, noiseRate: 2100, blurAmount: 0.024, blurRate: 9997,
    autoRotationSpeed: -1
  },
  "Slurry": {
    spikiness: 11.81, spikeFrequency: 1546, spikeSharpness: 1, hue: 294.9,
    scale: 1, fillSize: 1, fillOpacity: 0.28, dilationSlider: 164, fadeSlider: 52,
    hueShiftAmount: 0.49, rotation: 0, blendOpacity: 0.04,
    noiseAmount: 0.046, noiseRate: 2100, blurAmount: 0, blurRate: 9997,
    autoRotationSpeed: -0.45
  },
  "Gunbuster": {
    spikiness: 14, spikeFrequency: 2176, spikeSharpness: 0, hue: 294.9,
    scale: 1, fillSize: 0.33, fillOpacity: 0.08, dilationSlider: 102, fadeSlider: 100,
    hueShiftAmount: 0.19, rotation: 0, blendOpacity: 0.04,
    noiseAmount: 0.02, noiseRate: 1100, blurAmount: 0, blurRate: 9997,
    autoRotationSpeed: 0.5
  },
  "EYELINER": {
    spikiness: 1.15, spikeFrequency: 361.8, spikeSharpness: 0.9, hue: 202.1,
    scale: 0.93, fillSize: 0.42, fillOpacity: 0.16, dilationSlider: 0, fadeSlider: 100,
    hueShiftAmount: 7.37, rotation: 59, blendOpacity: 0.2,
    noiseAmount: 0.1, noiseRate: 1100, blurAmount: 0.005, blurRate: 70.1,
    autoRotationSpeed: -1
  },
  "Ekhart": {
    spikiness: 1, spikeFrequency: 17.67, spikeSharpness: 1, hue: 220.4,
    scale: 0.29, fillSize: 0.28, fillOpacity: 0, dilationSlider: 103, fadeSlider: 35,
    hueShiftAmount: 0.2, rotation: 0, blendOpacity: 0.23,
    noiseAmount: 0, noiseRate: 3.26, blurAmount: 0, blurRate: 0.65,
    autoRotationSpeed: 769.7
  },
  "RainbowSwim": {
    spikiness: 0.98, spikeFrequency: 4.34, spikeSharpness: 0.52, hue: 308.8,
    scale: 0.66, fillSize: 1, fillOpacity: 0.59, dilationSlider: 101, fadeSlider: 94,
    hueShiftAmount: 0.09, rotation: 134.4, blendOpacity: 0.18,
    noiseAmount: 0.02, noiseRate: 8.74, blurAmount: 0.085, blurRate: 4.92,
    autoRotationSpeed: 76.5
  },
  "Megacross": {
    spikiness: 1, spikeFrequency: 19.71, spikeSharpness: 0.85, hue: 270.1,
    scale: 1, fillSize: 0.61, fillOpacity: 0.7, dilationSlider: 78, fadeSlider: 45,
    hueShiftAmount: 0.17, rotation: 107.5, blendOpacity: 0.02,
    noiseAmount: 0.078, noiseRate: 7.33, blurAmount: 0.32, blurRate: 3.34,
    autoRotationSpeed: 179.5
  },
  "Feather": {
    spikiness: 0.92, spikeFrequency: 20, spikeSharpness: 1, hue: 142.5,
    scale: 0.88, fillSize: 0, fillOpacity: 0.81, dilationSlider: 99, fadeSlider: 30,
    hueShiftAmount: 0.18, rotation: 231, blendOpacity: 0.73,
    noiseAmount: 0, noiseRate: 0, blurAmount: 0, blurRate: 0,
    autoRotationSpeed: 217.1
  },
  "Gas": {
    spikiness: 0.59, spikeFrequency: 13.76, spikeSharpness: 0.71, hue: 41.3,
    scale: 0.83, fillSize: 0.35, fillOpacity: 0.48, dilationSlider: 158, fadeSlider: 94,
    hueShiftAmount: 0.11, rotation: 58.5, blendOpacity: 0.65,
    noiseAmount: 0.85, noiseRate: 0.03, blurAmount: 0.72, blurRate: 0.76,
    autoRotationSpeed: 238.2
  },
  "Oasis": {
    spikiness: 0.96, spikeFrequency: 15.32, spikeSharpness: 1, hue: 195.6,
    scale: 0.89, fillSize: 1, fillOpacity: 0.91, dilationSlider: 98, fadeSlider: 68,
    hueShiftAmount: 0.18, rotation: 102.5, blendOpacity: 0.35,
    noiseAmount: 0.07, noiseRate: 4.99, blurAmount: 0.76, blurRate: 9.36,
    autoRotationSpeed: 285.2
  },
  "Daisy": {
    spikiness: 1, spikeFrequency: 17.99, spikeSharpness: 0, hue: 230,
    scale: 0.84, fillSize: 0.43, fillOpacity: 1, dilationSlider: 119, fadeSlider: 44,
    hueShiftAmount: 0.18, rotation: 0, blendOpacity: 0.14,
    autoRotationSpeed: 47.2
  },
  "Ryan": {
    spikiness: 0.67, spikeFrequency: 19.42, spikeSharpness: 0.51, hue: 153.6,
    scale: 0.81, fillSize: 0.5, fillOpacity: 0.42, dilationSlider: 109, fadeSlider: 100,
    hueShiftAmount: 0.04, rotation: 148, blendOpacity: 0.14,
    autoRotationSpeed: 27.5
  },
  "Cosm": {
    spikiness: 1.36, spikeFrequency: 100, spikeSharpness: 0, hue: 14.9,
    scale: 2.13, fillSize: 0.05, fillOpacity: 0.1, dilationSlider: 117, fadeSlider: 79,
    hueShiftAmount: 0.06, rotation: 29, blendOpacity: 0.23,
    noiseAmount: 0.007, noiseRate: 659.1, blurAmount: 0, blurRate: 0.65,
    autoRotationSpeed: 31
  },
  "Starwash": {
    spikiness: 0.64, spikeFrequency: 5.26, spikeSharpness: 0.01, hue: 78.3,
    scale: 0.55, fillSize: 0.46, fillOpacity: 0.05, dilationSlider: 109, fadeSlider: 34,
    hueShiftAmount: 0.13, rotation: 0, blendOpacity: 0.24,
    noiseAmount: 0.014, noiseRate: 100, blurAmount: 0, blurRate: 82.9,
    autoRotationSpeed: 200
  },
  "Oyster": {
    spikiness: 0.13, spikeFrequency: 12.87, spikeSharpness: 0, hue: 225.1,
    scale: 1.38, fillSize: 0.09, fillOpacity: 0.76, dilationSlider: 77, fadeSlider: 46,
    hueShiftAmount: 0.1, rotation: 256.6, blendOpacity: 0.23,
    noiseAmount: 0.012, noiseRate: 6.43, blurAmount: 0.63, blurRate: 6.96,
    autoRotationSpeed: 25.2, jiggleAmount: 1
  },
  "Peacock": {
    spikiness: 1, spikeFrequency: 17.67, spikeSharpness: 1, hue: 260.5,
    scale: 0.96, fillSize: 0.48, fillOpacity: 0.15, dilationSlider: 135, fadeSlider: 79,
    hueShiftAmount: 0.12, rotation: 0, blendOpacity: 0.14,
    noiseAmount: 0.009, noiseRate: 3.26, blurAmount: 0.1, blurRate: 0.65,
    autoRotationSpeed: 139, jiggleAmount: 0.09
  },
  "RecycledColors": {
    spikiness: 0.18, spikeFrequency: 14.34, spikeSharpness: 0.43, hue: 167.6,
    scale: 0.99, fillSize: 0.17, fillOpacity: 0.58, dilationSlider: 100, fadeSlider: 82,
    hueShiftAmount: 0.15, rotation: 101.2, blendOpacity: 0.33,
    noiseAmount: 0.003, noiseRate: 735.1, blurAmount: 0, blurRate: 95.6,
    autoRotationSpeed: 144.8, jiggleAmount: 0.16
  },
  "RaveSoap": {
    spikiness: 0.29, spikeFrequency: 13.96, spikeSharpness: 1, hue: 54.9,
    scale: 0.8, fillSize: 0.5, fillOpacity: 0.53, dilationSlider: 118, fadeSlider: 92,
    hueShiftAmount: 0.08, rotation: 21.1, blendOpacity: 0.49,
    noiseAmount: 0.23, noiseRate: 3, blurAmount: 0.54, blurRate: 6.89,
    autoRotationSpeed: 263.3, jiggleAmount: 0.64
  },
  "TyeDyed": {
    spikiness: 0.87, spikeFrequency: 14.07, spikeSharpness: 0.23, hue: 57.6,
    scale: 0.46, fillSize: 0.86, fillOpacity: 0.34, dilationSlider: 114, fadeSlider: 29,
    hueShiftAmount: 0.18, rotation: 0, blendOpacity: 0.68,
    noiseAmount: 0.022, noiseRate: 626.6, blurAmount: 29, blurRate: 0,
    autoRotationSpeed: 6.5, jiggleAmount: 0.03
  },
  "WadingRainbow": {
    spikiness: 0.46, spikeFrequency: 5.82, spikeSharpness: 0, hue: 175,
    scale: 0.43, fillSize: 1, fillOpacity: 0, dilationSlider: 120, fadeSlider: 100,
    hueShiftAmount: 0.022, rotation: 0, blendOpacity: 0.14,
    autoRotationSpeed: 75.6, jiggleAmount: 0.08
  },
  "JiggleStorm": {
    spikiness: 0.09, spikeFrequency: 9.82, spikeSharpness: 0.78, hue: 60,
    scale: 0.05, fillSize: 0.01, fillOpacity: 0.24, dilationSlider: 108, fadeSlider: 20,
    hueShiftAmount: 0.005, rotation: 165.7, blendOpacity: 0.61,
    noiseAmount: 0.02, noiseRate: 3.01, blurAmount: 0.34, blurRate: 1.28,
    autoRotationSpeed: 225.3, jiggleAmount: 0.32
  },
  "LUCAS": {
    spikiness: 0.61, spikeFrequency: 11.93, spikeSharpness: 0.67, hue: 334.8,
    scale: 1.5, fillSize: 0.94, fillOpacity: 0.11, dilationSlider: 85, fadeSlider: 22,
    hueShiftAmount: 0.15, rotation: 0, blendOpacity: 0.33,
    noiseAmount: 0.007, noiseRate: 2.15, blurAmount: 0, blurRate: 0.22,
    autoRotationSpeed: -1, jiggleAmount: 0.87
  },
  "BUMPER": {
    spikiness: 0.57, spikeFrequency: 3, spikeSharpness: 0, hue: 163.1,
    scale: 1.34, fillSize: 0.36, fillOpacity: 0.85, dilationSlider: 85, fadeSlider: 82,
    hueShiftAmount: 0.12, rotation: 359.1, blendOpacity: 0.25,
    noiseAmount: 0.058, noiseRate: 7.76, blurAmount: 0, blurRate: 1.75,
    autoRotationSpeed: 35.4, jiggleAmount: 1
  },
  "WONDERWELL": {
    spikiness: 0.8, spikeFrequency: 5, spikeSharpness: 0, hue: 1,
    scale: 0.05, fillSize: 0, fillOpacity: 0.6, dilationSlider: 96, fadeSlider: 100,
    hueShiftAmount: 0.124, rotation: 360, blendOpacity: 0.27,
    autoRotationSpeed: 326.9, jiggleAmount: 1
  },
  "HUELOOP": {
    spikiness: 1, spikeFrequency: 17.69, spikeSharpness: 0.25, hue: 271,
    scale: 0.89, fillSize: 0, fillOpacity: 0.54, dilationSlider: 36, fadeSlider: 73,
    hueShiftAmount: 0.19, rotation: 189.7, blendOpacity: 0.69,
    noiseAmount: 0.3, noiseRate: 10, blurAmount: 0.92, blurRate: 8.27,
    autoRotationSpeed: 50.1, jiggleAmount: 0.91
  },
  "GUMMY": {
    spikiness: 1.35, spikeFrequency: 5.86, spikeSharpness: 0.36, hue: 182.9,
    scale: 0.86, fillSize: 8.7, fillOpacity: 0, dilationSlider: 98, fadeSlider: 29,
    hueShiftAmount: 39.9, rotation: 27.8, blendOpacity: 0,
    noiseAmount: 0.69, noiseRate: 8.25, blurAmount: 0.89, blurRate: 3.4,
    autoRotationSpeed: 1, jiggleAmount: 0.34
  },
  "DesertSun": {
    spikiness: 0.11, spikeFrequency: 148.6, spikeSharpness: 1, hue: 325.7,
    scale: 0.16, fillSize: 0, fillOpacity: 0.1, dilationSlider: 158, fadeSlider: 100,
    hueShiftAmount: 0.036, rotation: 360, blendOpacity: 0.49,
    noiseAmount: 0.022, noiseRate: 10, blurAmount: 0.26, blurRate: 32.3,
    autoRotationSpeed: 2.4, jiggleAmount: 0.48
  },
  "SolarEclipse": {
    spikiness: 0.04, spikeFrequency: 148.6, spikeSharpness: 1, hue: 325.7,
    scale: 0.15, fillSize: 0.05, fillOpacity: 0.47, dilationSlider: 128, fadeSlider: 26,
    hueShiftAmount: 0.0015, rotation: 360, blendOpacity: 0.2,
    noiseAmount: 0.022, noiseRate: 10, blurAmount: 1, blurRate: 81.8,
    autoRotationSpeed: 8.5, jiggleAmount: 0.85
  },
  "ArcGalaxy": {
    spikiness: 1, spikeFrequency: 2176, spikeSharpness: 0.003, hue: 294.9,
    scale: 1, fillSize: 0.33, fillOpacity: 0.08, dilationSlider: 100, fadeSlider: 100,
    hueShiftAmount: 0.19, rotation: 0.2, blendOpacity: 0.04,
    noiseAmount: 0.02, noiseRate: 1100, blurAmount: 0, blurRate: 9997,
    autoRotationSpeed: 0.12, jiggleAmount: 0.01
  },
  "p3n0r": {
    spikiness: 0.66, spikeFrequency: 2.6, spikeSharpness: 0.19, hue: 16.4,
    scale: 0.66, fillSize: 0.1, fillOpacity: 0, dilationSlider: 154, fadeSlider: 0,
    hueShiftAmount: 0.15, rotation: 0, blendOpacity: 0.15,
    noiseAmount: 0.73, noiseRate: 868.5, blurAmount: 0.72, blurRate: 79.9,
    autoRotationSpeed: 32.9, jiggleAmount: 2
  },
};

/**
 * Get all default presets as an array
 */
export function getDefaultPresets(): Preset[] {
  return Object.entries(RAW_PRESETS).map(([name, raw]) => createPreset(name, raw));
}

/**
 * Get default presets as a Map
 */
export function getDefaultPresetsMap(): Map<string, Preset> {
  const map = new Map<string, Preset>();
  for (const [name, raw] of Object.entries(RAW_PRESETS)) {
    map.set(name, createPreset(name, raw));
  }
  return map;
}

/**
 * Migrate old format preset (from sandboxPresets) to new format
 */
export function migrateOldPreset(name: string, raw: RawPreset): Preset {
  return createPreset(name, raw);
}

/**
 * Try to load and migrate presets from old localStorage key
 */
export function migrateOldLocalStorage(): Map<string, Preset> | null {
  try {
    const oldData = localStorage.getItem('sandboxPresets');
    if (oldData === null) {
      return null;
    }

    const oldPresets = JSON.parse(oldData) as Record<string, RawPreset>;
    const migrated = new Map<string, Preset>();

    for (const [name, raw] of Object.entries(oldPresets)) {
      migrated.set(name, migrateOldPreset(name, raw));
    }

    return migrated;
  } catch (error) {
    console.warn('Failed to migrate old presets:', error);
    return null;
  }
}
