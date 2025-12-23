# Audio Metrics → Sandbox Visualizer Mapping Design

## Overview
This document describes how audio analysis metrics map to the sandbox visualizer parameters, implementing multi-band frequency analysis and rhythmic energy detection.

## New Metric: Rhythmic Energy

**Calculation:**
- Combines spectral flux (rate of frequency change), transient density, high-frequency variance, and amplitude variance
- Range: 0.0 (calm/ambient) to 1.0 (high-energy/jungle beats)
- Used to drive acceleration/deceleration parameters and detect tempo changes

**Tempo Change Detection:**
- Compares recent rhythmic energy average to older average
- Threshold: 0.3 difference triggers dilation direction flip
- When triggered: flips dilation speed across 1.0 (contracting ↔ expanding)

## Multi-Band Mappings

### Low Band (20-250 Hz)
**Characteristics:** Kick, bass, snares, piano, frontal/mono low-mid frequencies

**Parameter Mappings:**
- `fillOpacity`: Maps to opacity (larger fill size if dominant)
- `fillSize`: Larger if low band is dominant frequency
- `hue`: 
  - Subbass (very low) → dark red (0-30°)
  - Bass into mid → blue-green (150-180°)
- `spikiness`: Rounder spikes (reduced)
- `spikeFrequency`: Less frequency (2-4 spikes)

### Mid Band (250-4 kHz)
**Characteristics:** Snappy and crunchy timbres

**Parameter Mappings:**
- `hue`: Blue/green (180-240°)
- `spikeFrequency`: Snappy/crunchy → more frequency (5-17 spikes)
- `noiseAmount`: Maps to snappy timbres
- `noiseRate`: Spikes on transients (detected from rhythmic energy)

### High Band (4 kHz+)
**Characteristics:** Lead (magenta), high hats, resonant peaks (orange/yellow)

**Parameter Mappings:**
- `hue`: 
  - Very high → orange/yellow (30-60°)
  - High → magenta (300-330°)
- `spikiness`: More spikes
- `spikeSharpness`: Sharper spikes
- `dilationSpeed`: Biased to high value (>1.0, expanding)
- `emanationRate`: Spiked to very high (faster ripples)

## Overall Analysis

### Dominant Band Detection
- Determines which band (low/mid/high) has the most energy
- Sets `hue` based on dominant band:
  - **Low** → Red (0-30°) or Blue-Green (150-180°)
  - **Mid** → Blue-Green (180-240°)
  - **High** → Magenta (300-330°) or Orange/Yellow (30-60°)

### Cross-Band Parameters

**Shape:**
- `spikiness`: `u_coherence` (high coherence = crisp shape)
- `spikeFrequency`: Weighted by band contributions (low reduces, mid/high increase)
- `spikeSharpness`: `u_harshness` (harsh highs = sharp spikes)

**Scale & Size:**
- `scale`: `u_audioAmp * 0.9 + 0.1` (louder = bigger, 0.1-1.0 range)
- `fillSize`: `u_coherence` (high coherence = more filled)
- `fillOpacity`: `u_coherence * 0.8 + 0.2` (coherent = more opaque)

**Emanation:**
- `emanationRate`: `u_audioAmp * 198 + 2` (loud = faster, 2-200 range)
- `dilationSpeed`: Compression + rhythmic energy, with tempo change flip
- `fadeAmount`: `(1.0 - u_coherence) * 5.0` (low coherence = faster fade)

**Rotation:**
- `autoRotationSpeed`: Low vs high energy balance + rhythmic energy scaling
- `rotation`: Pan position (if stereo)

**Filters:**
- `noiseAmount`: `(u_harshness * 0.6 + u_collision * 0.4) * 0.8`
- `noiseRate`: `(u_harshness + u_collision) * 5.0`
- `blurAmount`: `u_mud * 0.5`
- `blurRate`: `u_mud * 5.0`

**Effects:**
- `hueShiftAmount`: `u_mud * 0.2` (muddy = more hue shift)
- `blendOpacity`: `u_coherence * 0.7 + 0.3` (coherent = more visible)

## Implementation Files

1. **audio/analyzer.js**: Added `calculateRhythmicEnergy()` and `detectTempoChange()`
2. **audio/paramMapper.js**: New class that maps metrics to parameters
3. **main.js**: Will be updated to use ParamMapper and sandbox renderer

## Next Steps

1. Extract SimpleRenderer from sandbox.html to separate file
2. Update main.js to use sandbox renderer
3. Wire ParamMapper to drive parameters in real-time
4. Remove old water ripple shader code


