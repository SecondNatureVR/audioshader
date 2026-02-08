/**
 * Default presets for AudioShader
 * Values pre-computed from lucas.html formulas to ensure visual parity.
 */

import type { VisualParams, Preset, BlendMode } from '../types';

/**
 * Raw preset data structure
 */
interface RawPreset {
  spikiness?: number;
  spikeFrequency?: number;
  spikeSharpness?: number;
  hue?: number;
  scale?: number;
  fillSize?: number;
  fillOpacity?: number;
  blendOpacity?: number;
  blendMode?: BlendMode;
  expansionFactor?: number;
  fadeAmount?: number;
  hueShiftAmount?: number;
  rotation?: number;
  emanationRate?: number;
  noiseAmount?: number;
  noiseRate?: number;
  blurAmount?: number;
  blurRate?: number;
  autoRotationSpeed?: number;
  jiggleAmount?: number;
}

/**
 * Convert raw preset to VisualParams
 */
function convertRawPreset(raw: RawPreset): VisualParams {
  return {
    spikiness: raw.spikiness ?? 0.5,
    spikeFrequency: raw.spikeFrequency ?? 5,
    spikeSharpness: raw.spikeSharpness ?? 0.5,
    hue: raw.hue ?? 180,
    scale: raw.scale ?? 0.5,
    fillSize: raw.fillSize ?? 0,
    fillOpacity: raw.fillOpacity ?? 0.5,
    blendOpacity: raw.blendOpacity ?? 0.5,
    expansionFactor: raw.expansionFactor ?? 1.0,
    fadeAmount: raw.fadeAmount ?? 0.02,
    hueShiftAmount: raw.hueShiftAmount ?? 0,
    rotation: raw.rotation ?? 0,
    noiseAmount: raw.noiseAmount ?? 0,
    noiseRate: raw.noiseRate ?? 0,
    blurAmount: raw.blurAmount ?? 0,
    blurRate: raw.blurRate ?? 0,
    autoRotationSpeed: raw.autoRotationSpeed ?? 0,
    jiggleAmount: raw.jiggleAmount ?? 0.3,
    emanationRate: raw.emanationRate ?? 30,
  };
}

/**
 * Create a Preset from name and raw data
 */
function createPreset(name: string, raw: RawPreset): Preset {
  return {
    name,
    params: convertRawPreset(raw),
    blendMode: raw.blendMode ?? 'additive',
    emanationRate: raw.emanationRate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Default preset data
 * All values pre-computed from lucas.html formulas to ensure visual parity.
 */
const RAW_PRESETS: Record<string, RawPreset> = {
  "Burn": {
    spikiness: 0.5, hue: 45, scale: 0.88, expansionFactor: 1.0, fadeAmount: 4.8805,
    hueShiftAmount: 0.03, rotation: 0, blendMode: 'alpha', blendOpacity: 0.03, autoRotationSpeed: 10,
    emanationRate: 30
  },
  "Rainbow": {
    spikiness: 0.5, hue: 45, scale: 0.64, expansionFactor: 0.940450, fadeAmount: 3.9149,
    hueShiftAmount: 0.154, rotation: 0, blendMode: 'screen', blendOpacity: 0.08, autoRotationSpeed: 0,
    emanationRate: 30
  },
  "Spray": {
    spikiness: 0.5, hue: 1, scale: 0.05, expansionFactor: 1.175189, fadeAmount: 4.6416,
    hueShiftAmount: 0.124, rotation: 0, blendMode: 'alpha', blendOpacity: 0.27, autoRotationSpeed: 294.49,
    emanationRate: 24.2
  },
  "Flower": {
    spikiness: 0.5, hue: 175, scale: 0.82, expansionFactor: 0.980880, fadeAmount: 5.0,
    hueShiftAmount: 0.072, rotation: 0, blendMode: 'screen', blendOpacity: 0.08, autoRotationSpeed: 326.89,
    emanationRate: 30
  },
  "Portal": {
    spikiness: 0.18, spikeFrequency: 11.4, spikeSharpness: 0.48, hue: 91,
    scale: 1, expansionFactor: 0.985724, fadeAmount: 4.6608, hueShiftAmount: 0.029,
    rotation: 0, blendMode: 'screen', blendOpacity: 1, autoRotationSpeed: 0,
    emanationRate: 7
  },
  "Braid": {
    spikiness: 0.08, spikeFrequency: 20, spikeSharpness: 0, hue: 175,
    scale: 0.82, fillSize: 0, fillOpacity: 0.5, expansionFactor: 0.980880, fadeAmount: 5.0,
    hueShiftAmount: 0.036, rotation: 148, blendMode: 'screen', blendOpacity: 0.14, autoRotationSpeed: 121.42,
    emanationRate: 30
  },
  "Pool": {
    spikiness: 0.05, spikeFrequency: 3.4, spikeSharpness: 0, hue: 175,
    scale: 0.47, fillSize: 1, fillOpacity: 0.19, expansionFactor: 0.995284, fadeAmount: 0,
    hueShiftAmount: 0.192, rotation: 231, blendMode: 'screen', blendOpacity: 0.73, autoRotationSpeed: 217.1,
    emanationRate: 23.6
  },
  "Cross": {
    spikiness: 0, spikeFrequency: 10.01, spikeSharpness: 0.38, hue: 357.1,
    scale: 0.89, fillSize: 0.15, fillOpacity: 0.82, expansionFactor: 0.975991, fadeAmount: 2.8744,
    hueShiftAmount: 0.12, rotation: 183.6, blendMode: 'overlay', blendOpacity: 0.6, autoRotationSpeed: 88.2,
    emanationRate: 24.3
  },
  "Wash": {
    spikiness: 0.15, spikeFrequency: 18.83, spikeSharpness: 0.7, hue: 320.5,
    scale: 0.2, fillSize: 0.35, fillOpacity: 0.78, expansionFactor: 1.045023, fadeAmount: 4.6989,
    hueShiftAmount: 0.11, rotation: 42.5, blendMode: 'screen', blendOpacity: 0.9, autoRotationSpeed: 94.6,
    emanationRate: 19
  },
  "Wiggle": {
    spikiness: 0.12, spikeFrequency: 10.9, spikeSharpness: 0.42, hue: 77.5,
    scale: 0.99, fillSize: 0.49, fillOpacity: 0.05, expansionFactor: 0.980880, fadeAmount: 4.9152,
    hueShiftAmount: 0.019, rotation: 9.2, blendMode: 'screen', blendOpacity: 1, autoRotationSpeed: 8.6,
    emanationRate: 30
  },
  "VHS": {
    spikiness: 0.24, spikeFrequency: 3.77, spikeSharpness: 0.3, hue: 294.9,
    scale: 0.99, fillSize: 0.99, fillOpacity: 0.02, expansionFactor: 0.966077, fadeAmount: 3.803,
    hueShiftAmount: 0.036, rotation: 0, blendMode: 'screen', blendOpacity: 0.14, autoRotationSpeed: 13,
    emanationRate: 300
  },
  "Dive": {
    spikiness: 0.53, spikeFrequency: 7.78, spikeSharpness: 0.33, hue: 88.9,
    scale: 0.05, fillSize: 0, fillOpacity: 0.39, expansionFactor: 1.269305, fadeAmount: 1.71,
    hueShiftAmount: 0, rotation: 0, blendMode: 'screen', blendOpacity: 0, autoRotationSpeed: 1.5,
    emanationRate: 30
  },
  "JiggleFreezeGlitch": {
    spikiness: 0.7, spikeFrequency: 5.41, spikeSharpness: 0, hue: 92.5,
    scale: 0.67, fillSize: 0, fillOpacity: 0.86, expansionFactor: 1.102381, fadeAmount: 3.8597,
    hueShiftAmount: 0.06, rotation: 86.3, blendMode: 'overlay', blendOpacity: 0.66, autoRotationSpeed: 275.7,
    emanationRate: 28.5
  },
  "Conch": {
    spikiness: 0.77, spikeFrequency: 3.8, spikeSharpness: 0, hue: 175,
    scale: 0.82, fillSize: 0, fillOpacity: 0.5, expansionFactor: 0.990525, fadeAmount: 5.0,
    hueShiftAmount: 0.022, rotation: 0, blendMode: 'screen', blendOpacity: 0.14, autoRotationSpeed: 74.8,
    emanationRate: 90
  },
  "Smoke": {
    spikiness: 0.5, spikeFrequency: 5.6, spikeSharpness: 0.79, hue: 31.5,
    scale: 0.84, fillSize: 0.34, fillOpacity: 0.55, expansionFactor: 1.004675, fadeAmount: 4.7732,
    hueShiftAmount: 0.033, rotation: 228, blendMode: 'alpha', blendOpacity: 0.21, autoRotationSpeed: 327.1,
    emanationRate: 9
  },
  "Corduroy": {
    spikiness: 0.03, spikeFrequency: 100, spikeSharpness: 1, hue: 325.7,
    scale: 0.26, fillSize: 0.11, fillOpacity: 0.82, expansionFactor: 1.257618, fadeAmount: 5.0,
    hueShiftAmount: 0, rotation: 0, blendMode: 'screen', blendOpacity: 0.2,
    noiseAmount: 0.022, noiseRate: 10, blurAmount: 1, blurRate: 0,
    autoRotationSpeed: 224.4,
    emanationRate: 196
  },
  "Moire": {
    spikiness: 1, spikeFrequency: 200, spikeSharpness: 1, hue: 325.7,
    scale: 1, fillSize: 0.17, fillOpacity: 0.52, expansionFactor: 1.233504, fadeAmount: 5.0,
    hueShiftAmount: 0.007, rotation: 0, blendMode: 'screen', blendOpacity: 0.2,
    noiseAmount: 0.035, noiseRate: 6.23, blurAmount: 0, blurRate: 0,
    autoRotationSpeed: 6.52,
    emanationRate: 200
  },
  "Conway": {
    spikiness: 2, spikeFrequency: 500, spikeSharpness: 0, hue: 325.7,
    scale: 1, fillSize: 0, fillOpacity: 0.15, expansionFactor: 1.221054, fadeAmount: 5.0,
    hueShiftAmount: 0.009, rotation: 0, blendMode: 'screen', blendOpacity: 0.2,
    noiseAmount: 0.006, noiseRate: 300, blurAmount: 0.0007, blurRate: 300,
    autoRotationSpeed: 101.1,
    emanationRate: 200
  },
  "Doughnut": {
    spikiness: 0.3, spikeFrequency: 2000, spikeSharpness: 0.14, hue: 294.9,
    scale: 1, fillSize: 0.76, fillOpacity: 0.03, expansionFactor: 1.0, fadeAmount: 5.0,
    hueShiftAmount: 0.072, rotation: 0, blendMode: 'screen', blendOpacity: 0.14,
    noiseAmount: 0.018, noiseRate: 9000, blurAmount: 0.0001, blurRate: 9997,
    autoRotationSpeed: -1,
    emanationRate: 2000
  },
  "Sparkle": {
    spikiness: 11.81, spikeFrequency: 1546, spikeSharpness: 1, hue: 294.9,
    scale: 1, fillSize: 1, fillOpacity: 0.28, expansionFactor: 1.0, fadeAmount: 1.9574,
    hueShiftAmount: 1.08, rotation: 0, blendMode: 'screen', blendOpacity: 0.04,
    noiseAmount: 0.069, noiseRate: 2100, blurAmount: 0.024, blurRate: 9997,
    autoRotationSpeed: -1,
    emanationRate: 77
  },
  "Slurry": {
    spikiness: 11.81, spikeFrequency: 1546, spikeSharpness: 1, hue: 294.9,
    scale: 1, fillSize: 1, fillOpacity: 0.28, expansionFactor: 1.239629, fadeAmount: 4.0207,
    hueShiftAmount: 0.49, rotation: 0, blendMode: 'screen', blendOpacity: 0.04,
    noiseAmount: 0.046, noiseRate: 2100, blurAmount: 0, blurRate: 9997,
    autoRotationSpeed: -0.45,
    emanationRate: 130
  },
  "Gunbuster": {
    spikiness: 14, spikeFrequency: 2176, spikeSharpness: 0, hue: 294.9,
    scale: 1, fillSize: 0.33, fillOpacity: 0.08, expansionFactor: 1.009310, fadeAmount: 5.0,
    hueShiftAmount: 0.19, rotation: 0, blendMode: 'screen', blendOpacity: 0.04,
    noiseAmount: 0.02, noiseRate: 1100, blurAmount: 0, blurRate: 9997,
    autoRotationSpeed: 0.5,
    emanationRate: 530
  },
  "EYELINER": {
    spikiness: 1.15, spikeFrequency: 361.8, spikeSharpness: 0.9, hue: 202.1,
    scale: 0.93, fillSize: 0.42, fillOpacity: 0.16, expansionFactor: 0.5, fadeAmount: 5.0,
    hueShiftAmount: 7.37, rotation: 59, blendMode: 'additive', blendOpacity: 0.2,
    noiseAmount: 0.1, noiseRate: 1100, blurAmount: 0.005, blurRate: 70.1,
    autoRotationSpeed: -1,
    emanationRate: 530
  },
  "Ekhart": {
    spikiness: 1, spikeFrequency: 17.67, spikeSharpness: 1, hue: 220.4,
    scale: 0.29, fillSize: 0.28, fillOpacity: 0, expansionFactor: 1.013906, fadeAmount: 3.5236,
    hueShiftAmount: 0.2, rotation: 0, blendMode: 'screen', blendOpacity: 0.23,
    noiseAmount: 0, noiseRate: 3.26, blurAmount: 0, blurRate: 0.65,
    autoRotationSpeed: 769.7,
    emanationRate: 12
  },
  "RainbowSwim": {
    spikiness: 0.98, spikeFrequency: 4.34, spikeSharpness: 0.52, hue: 308.8,
    scale: 0.66, fillSize: 1, fillOpacity: 0.59, expansionFactor: 1.004675, fadeAmount: 4.8979,
    hueShiftAmount: 0.09, rotation: 134.4, blendMode: 'overlay', blendOpacity: 0.18,
    noiseAmount: 0.02, noiseRate: 8.74, blurAmount: 0.085, blurRate: 4.92,
    autoRotationSpeed: 76.5,
    emanationRate: 37
  },
  "Megacross": {
    spikiness: 1, spikeFrequency: 19.71, spikeSharpness: 0.85, hue: 270.1,
    scale: 1, fillSize: 0.61, fillOpacity: 0.7, expansionFactor: 0.885122, fadeAmount: 3.8315,
    hueShiftAmount: 0.17, rotation: 107.5, blendMode: 'overlay', blendOpacity: 0.02,
    noiseAmount: 0.078, noiseRate: 7.33, blurAmount: 0.32, blurRate: 3.34,
    autoRotationSpeed: 179.5,
    emanationRate: 99
  },
  "Feather": {
    spikiness: 0.92, spikeFrequency: 20, spikeSharpness: 1, hue: 142.5,
    scale: 0.88, fillSize: 0, fillOpacity: 0.81, expansionFactor: 0.995284, fadeAmount: 3.3472,
    hueShiftAmount: 0.18, rotation: 231, blendMode: 'screen', blendOpacity: 0.73,
    noiseAmount: 0, noiseRate: 0, blurAmount: 0, blurRate: 0,
    autoRotationSpeed: 217.1,
    emanationRate: 24
  },
  "Gas": {
    spikiness: 0.59, spikeFrequency: 13.76, spikeSharpness: 0.71, hue: 41.3,
    scale: 0.83, fillSize: 0.35, fillOpacity: 0.48, expansionFactor: 1.221054, fadeAmount: 4.8979,
    hueShiftAmount: 0.11, rotation: 58.5, blendMode: 'additive', blendOpacity: 0.65,
    noiseAmount: 0.85, noiseRate: 0.03, blurAmount: 0.72, blurRate: 0.76,
    autoRotationSpeed: 238.2,
    emanationRate: 10
  },
  "Oasis": {
    spikiness: 0.96, spikeFrequency: 15.32, spikeSharpness: 1, hue: 195.6,
    scale: 0.89, fillSize: 1, fillOpacity: 0.91, expansionFactor: 0.990525, fadeAmount: 4.3968,
    hueShiftAmount: 0.18, rotation: 102.5, blendMode: 'overlay', blendOpacity: 0.35,
    noiseAmount: 0.07, noiseRate: 4.99, blurAmount: 0.76, blurRate: 9.36,
    autoRotationSpeed: 285.2,
    emanationRate: 16
  },
  "Daisy": {
    spikiness: 1, spikeFrequency: 17.99, spikeSharpness: 0, hue: 230,
    scale: 0.84, fillSize: 0.43, fillOpacity: 1, expansionFactor: 1.082578, fadeAmount: 3.803,
    hueShiftAmount: 0.18, rotation: 0, blendMode: 'screen', blendOpacity: 0.14,
    autoRotationSpeed: 47.2,
    emanationRate: 300
  },
  "Ryan": {
    spikiness: 0.67, spikeFrequency: 19.42, spikeSharpness: 0.51, hue: 153.6,
    scale: 0.81, fillSize: 0.5, fillOpacity: 0.42, expansionFactor: 1.040685, fadeAmount: 5.0,
    hueShiftAmount: 0.04, rotation: 148, blendMode: 'screen', blendOpacity: 0.14,
    autoRotationSpeed: 27.5,
    emanationRate: 30
  },
  "Cosm": {
    spikiness: 1.36, spikeFrequency: 100, spikeSharpness: 0, hue: 14.9,
    scale: 2.13, fillSize: 0.05, fillOpacity: 0.1, expansionFactor: 1.074453, fadeAmount: 4.6222,
    hueShiftAmount: 0.06, rotation: 29, blendMode: 'screen', blendOpacity: 0.23,
    noiseAmount: 0.007, noiseRate: 659.1, blurAmount: 0, blurRate: 0.65,
    autoRotationSpeed: 31,
    emanationRate: 261
  },
  "Starwash": {
    spikiness: 0.64, spikeFrequency: 5.26, spikeSharpness: 0.01, hue: 78.3,
    scale: 0.55, fillSize: 0.46, fillOpacity: 0.05, expansionFactor: 1.040685, fadeAmount: 3.4898,
    hueShiftAmount: 0.13, rotation: 0, blendMode: 'additive', blendOpacity: 0.24,
    noiseAmount: 0.014, noiseRate: 100, blurAmount: 0, blurRate: 82.9,
    autoRotationSpeed: 200,
    emanationRate: 38
  },
  "Oyster": {
    spikiness: 0.13, spikeFrequency: 12.87, spikeSharpness: 0, hue: 225.1,
    scale: 1.38, fillSize: 0.09, fillOpacity: 0.76, expansionFactor: 0.879253, fadeAmount: 3.8597,
    hueShiftAmount: 0.1, rotation: 256.6, blendMode: 'additive', blendOpacity: 0.23,
    noiseAmount: 0.012, noiseRate: 6.43, blurAmount: 0.63, blurRate: 6.96,
    autoRotationSpeed: 25.2, jiggleAmount: 1,
    emanationRate: 79
  },
  "Peacock": {
    spikiness: 1, spikeFrequency: 17.67, spikeSharpness: 1, hue: 260.5,
    scale: 0.96, fillSize: 0.48, fillOpacity: 0.15, expansionFactor: 1.143598, fadeAmount: 4.6222,
    hueShiftAmount: 0.12, rotation: 0, blendMode: 'screen', blendOpacity: 0.14,
    noiseAmount: 0.009, noiseRate: 3.26, blurAmount: 0.1, blurRate: 0.65,
    autoRotationSpeed: 139, jiggleAmount: 0.09,
    emanationRate: 16
  },
  "RecycledColors": {
    spikiness: 0.18, spikeFrequency: 14.34, spikeSharpness: 0.43, hue: 167.6,
    scale: 0.99, fillSize: 0.17, fillOpacity: 0.58, expansionFactor: 1.0, fadeAmount: 4.68,
    hueShiftAmount: 0.15, rotation: 101.2, blendMode: 'screen', blendOpacity: 0.33,
    noiseAmount: 0.003, noiseRate: 735.1, blurAmount: 0, blurRate: 95.6,
    autoRotationSpeed: 144.8, jiggleAmount: 0.16,
    emanationRate: 144
  },
  "RaveSoap": {
    spikiness: 0.29, spikeFrequency: 13.96, spikeSharpness: 1, hue: 54.9,
    scale: 0.8, fillSize: 0.5, fillOpacity: 0.53, expansionFactor: 1.078531, fadeAmount: 4.8629,
    hueShiftAmount: 0.08, rotation: 21.1, blendMode: 'additive', blendOpacity: 0.49,
    noiseAmount: 0.23, noiseRate: 3, blurAmount: 0.54, blurRate: 6.89,
    autoRotationSpeed: 263.3, jiggleAmount: 0.64,
    emanationRate: 59
  },
  "TyeDyed": {
    spikiness: 0.87, spikeFrequency: 14.07, spikeSharpness: 0.23, hue: 57.6,
    scale: 0.46, fillSize: 0.86, fillOpacity: 0.34, expansionFactor: 1.062034, fadeAmount: 3.3096,
    hueShiftAmount: 0.18, rotation: 0, blendMode: 'additive', blendOpacity: 0.68,
    noiseAmount: 0.022, noiseRate: 626.6, blurAmount: 29, blurRate: 0,
    autoRotationSpeed: 6.5, jiggleAmount: 0.03,
    emanationRate: 196
  },
  "WadingRainbow": {
    spikiness: 0.46, spikeFrequency: 5.82, spikeSharpness: 0, hue: 175,
    scale: 0.43, fillSize: 1, fillOpacity: 0, expansionFactor: 1.086596, fadeAmount: 5.0,
    hueShiftAmount: 0.022, rotation: 0, blendMode: 'screen', blendOpacity: 0.14,
    autoRotationSpeed: 75.6, jiggleAmount: 0.08,
    emanationRate: 3097
  },
  "JiggleStorm": {
    spikiness: 0.09, spikeFrequency: 9.82, spikeSharpness: 0.78, hue: 60,
    scale: 0.05, fillSize: 0.01, fillOpacity: 0.24, expansionFactor: 1.036313, fadeAmount: 2.924,
    hueShiftAmount: 0.005, rotation: 165.7, blendMode: 'additive', blendOpacity: 0.61,
    noiseAmount: 0.02, noiseRate: 3.01, blurAmount: 0.34, blurRate: 1.28,
    autoRotationSpeed: 225.3, jiggleAmount: 0.32,
    emanationRate: 31
  },
  "LUCAS": {
    spikiness: 0.61, spikeFrequency: 11.93, spikeSharpness: 0.67, hue: 334.8,
    scale: 1.5, fillSize: 0.94, fillOpacity: 0.11, expansionFactor: 0.924455, fadeAmount: 3.0184,
    hueShiftAmount: 0.15, rotation: 0, blendMode: 'screen', blendOpacity: 0.33,
    noiseAmount: 0.007, noiseRate: 2.15, blurAmount: 0, blurRate: 0.22,
    autoRotationSpeed: -1, jiggleAmount: 0.87,
    emanationRate: 41
  },
  "BUMPER": {
    spikiness: 0.57, spikeFrequency: 3, spikeSharpness: 0, hue: 163.1,
    scale: 1.34, fillSize: 0.36, fillOpacity: 0.85, expansionFactor: 0.924455, fadeAmount: 4.68,
    hueShiftAmount: 0.12, rotation: 359.1, blendMode: 'screen', blendOpacity: 0.25,
    noiseAmount: 0.058, noiseRate: 7.76, blurAmount: 0, blurRate: 1.75,
    autoRotationSpeed: 35.4, jiggleAmount: 1,
    emanationRate: 127
  },
  "WONDERWELL": {
    spikiness: 0.8, spikeFrequency: 5, spikeSharpness: 0, hue: 1,
    scale: 0.05, fillSize: 0, fillOpacity: 0.6, expansionFactor: 0.980880, fadeAmount: 5.0,
    hueShiftAmount: 0.124, rotation: 360, blendMode: 'screen', blendOpacity: 0.27,
    autoRotationSpeed: 326.9, jiggleAmount: 1,
    emanationRate: 24
  },
  "HUELOOP": {
    spikiness: 1, spikeFrequency: 17.69, spikeSharpness: 0.25, hue: 271,
    scale: 0.89, fillSize: 0, fillOpacity: 0.54, expansionFactor: 0.549630, fadeAmount: 4.5021,
    hueShiftAmount: 0.19, rotation: 189.7, blendMode: 'screen', blendOpacity: 0.69,
    noiseAmount: 0.3, noiseRate: 10, blurAmount: 0.92, blurRate: 8.27,
    autoRotationSpeed: 50.1, jiggleAmount: 0.91,
    emanationRate: 132
  },
  "GUMMY": {
    spikiness: 1.35, spikeFrequency: 5.86, spikeSharpness: 0.36, hue: 182.9,
    scale: 0.86, fillSize: 8.7, fillOpacity: 0, expansionFactor: 0.990525, fadeAmount: 3.3096,
    hueShiftAmount: 39.9, rotation: 27.8, blendMode: 'additive', blendOpacity: 0,
    noiseAmount: 0.69, noiseRate: 8.25, blurAmount: 0.89, blurRate: 3.4,
    autoRotationSpeed: 1, jiggleAmount: 0.34,
    emanationRate: 159
  },
  "DesertSun": {
    spikiness: 0.11, spikeFrequency: 148.6, spikeSharpness: 1, hue: 325.7,
    scale: 0.16, fillSize: 0, fillOpacity: 0.1, expansionFactor: 1.221054, fadeAmount: 5.0,
    hueShiftAmount: 0.036, rotation: 360, blendMode: 'screen', blendOpacity: 0.49,
    noiseAmount: 0.022, noiseRate: 10, blurAmount: 0.26, blurRate: 32.3,
    autoRotationSpeed: 2.4, jiggleAmount: 0.48,
    emanationRate: 3370
  },
  "SolarEclipse": {
    spikiness: 0.04, spikeFrequency: 148.6, spikeSharpness: 1, hue: 325.7,
    scale: 0.15, fillSize: 0.05, fillOpacity: 0.47, expansionFactor: 1.117726, fadeAmount: 3.1913,
    hueShiftAmount: 0.0015, rotation: 360, blendMode: 'screen', blendOpacity: 0.2,
    noiseAmount: 0.022, noiseRate: 10, blurAmount: 1, blurRate: 81.8,
    autoRotationSpeed: 8.5, jiggleAmount: 0.85,
    emanationRate: 423
  },
  "ArcGalaxy": {
    spikiness: 1, spikeFrequency: 2176, spikeSharpness: 0.003, hue: 294.9,
    scale: 1, fillSize: 0.33, fillOpacity: 0.08, expansionFactor: 1.0, fadeAmount: 5.0,
    hueShiftAmount: 0.19, rotation: 0.2, blendMode: 'additive', blendOpacity: 0.04,
    noiseAmount: 0.02, noiseRate: 1100, blurAmount: 0, blurRate: 9997,
    autoRotationSpeed: 0.12, jiggleAmount: 0.01,
    emanationRate: 530
  },
  "p3n0r": {
    spikiness: 0.66, spikeFrequency: 2.6, spikeSharpness: 0.19, hue: 16.4,
    scale: 0.66, fillSize: 0.1, fillOpacity: 0, expansionFactor: 1.208325, fadeAmount: 0,
    hueShiftAmount: 0.15, rotation: 0, blendMode: 'additive', blendOpacity: 0.15,
    noiseAmount: 0.73, noiseRate: 868.5, blurAmount: 0.72, blurRate: 79.9,
    autoRotationSpeed: 32.9, jiggleAmount: 2,
    emanationRate: 97
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
 * Get the default emanationRate for a preset by name
 * Returns undefined if preset is not a built-in default
 */
export function getDefaultEmanationRate(name: string): number | undefined {
  const raw = RAW_PRESETS[name];
  return raw?.emanationRate;
}

/**
 * Get the default blendMode for a preset by name
 * Returns undefined if preset is not a built-in default
 */
export function getDefaultBlendMode(name: string): BlendMode | undefined {
  const raw = RAW_PRESETS[name];
  return raw?.blendMode;
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
