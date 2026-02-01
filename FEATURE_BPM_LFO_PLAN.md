# Feature: Global BPM with LFO-Style Modulation

## Overview
Implement a global BPM (beats per minute) system that drives LFO-style modulation for rate-based parameters. This will allow synchronized, tempo-based animations across multiple parameters.

## Current Rate-Based Parameters
Based on codebase analysis, these parameters are time/rate-based and could benefit from BPM modulation:

1. **Emanation Rate** (`emanationRate`) - Currently: 2-200 per second
2. **Noise Rate** (`noiseRate`) - Currently: time-based (1.0 = every 2s, range 0-10)
3. **Blur Rate** (`blurRate`) - Currently: time-based (1.0 = every 2s, range 0-10)
4. **Auto Rotation Speed** (`autoRotationSpeed`) - Currently: degrees per second (-1 to 360)
5. **Jiggle Amount** (if we want to sync jiggle to BPM)

## Questions for Clarification

1. **BPM Input Methods:**
   - Should tap tempo allow multiple taps to calculate average?
   - What's the acceptable BPM range? (e.g., 60-200 BPM?)
   - Should BPM be saved in presets?

2. **LFO Modulation:**
   - Which waveform shapes? (Sine, Triangle, Square, Sawtooth, Custom?)
   - Should each parameter have independent LFO settings (phase offset, depth, waveform)?
   - Should LFO depth be a percentage (0-100%) or absolute value?
   - Do we want sync to beat divisions? (1/1, 1/2, 1/4, 1/8, 1/16, etc.)

3. **Parameter Mapping:**
   - Should BPM modulation multiply the base rate, or replace it?
   - Example: If emanationRate is 10/sec and BPM is 120, should modulation be:
     - Multiplicative: `10 * (1 + LFO_value)` 
     - Additive: `10 + LFO_value`
     - Replacement: `LFO_value` (ignoring base value)

4. **UI Design:**
   - Where should BPM display/controls live? (Status bar? Dev toolbox section?)
   - Should there be a visual BPM indicator (pulsing dot, waveform)?
   - For the future "detailed widget" - what level of control? (Per-parameter LFO settings, waveform editor, phase relationships?)

5. **Integration:**
   - Should BPM sync with audio analysis if audio is active? (Auto-detect BPM from audio)
   - Should BPM override audio tempo, or work alongside it?

## Implementation Plan

### Phase 1: Core BPM System
1. **BPM State Management**
   - Add `globalBPM` variable (default: 120)
   - Add `bpmEnabled` flag (toggle BPM modulation on/off)
   - Store BPM in presets

2. **BPM Input UI**
   - BPM display (large, visible)
   - Direct input field (number input)
   - Tap tempo button (spacebar or dedicated button)
   - BPM slider (optional, for fine-tuning)

3. **Tap Tempo Logic**
   - Track tap timestamps
   - Calculate average interval between taps
   - Convert to BPM: `60 / averageIntervalSeconds`
   - Handle edge cases (single tap, very fast taps, etc.)

### Phase 2: Basic LFO Modulation
1. **LFO Calculation**
   - Calculate phase: `phase = (currentTime * BPM / 60) % 1.0`
   - Generate waveform values (start with sine: `Math.sin(phase * 2 * Math.PI)`)
   - Map to modulation range (e.g., -1 to +1, then scale by depth)

2. **Parameter Integration**
   - Create modulation function: `modulateRate(baseRate, lfoValue, depth)`
   - Apply to rate-based parameters in render loop
   - Ensure modulation doesn't break parameter bounds

3. **Simple UI Controls**
   - Global LFO depth slider (0-100%)
   - Waveform selector (Sine, Triangle, Square)
   - Enable/disable toggle

### Phase 3: Advanced LFO Widget (Future)
1. **Per-Parameter LFO Settings**
   - Individual enable/disable per parameter
   - Per-parameter depth, phase offset, waveform
   - Beat division sync (1/1, 1/2, 1/4, etc.)

2. **Visual LFO Editor**
   - Waveform preview
   - Phase relationship visualization
   - Real-time parameter preview

## Technical Considerations

### BPM to Rate Conversion
- BPM represents beats per minute
- For rate-based params, we need beats per second: `BPS = BPM / 60`
- LFO cycles per beat depends on waveform and sync settings

### Performance
- LFO calculations are lightweight (just math)
- Should be calculated once per frame, not per parameter
- Cache LFO values if multiple params use same settings

### Preset Compatibility
- Old presets without BPM should default to BPM=120, modulation disabled
- BPM settings should be optional in preset format

## Files to Modify

1. **sandbox.html**
   - Add BPM UI elements
   - Add BPM state variables
   - Add tap tempo logic
   - Add LFO calculation in render loop
   - Modify rate-based parameter calculations
   - Update preset save/load

2. **Potential New File: `audio/bpmDetector.js`** (Future)
   - Audio-based BPM detection
   - Integration with AudioAnalyzer

## Example Code Structure

```javascript
// BPM State
let globalBPM = 120;
let bpmEnabled = false;
let lfoDepth = 0.5; // 0-1
let lfoWaveform = 'sine'; // 'sine', 'triangle', 'square', 'sawtooth'

// Tap Tempo
let tapTimes = [];
const MAX_TAPS = 8;

function tapTempo() {
    const now = Date.now();
    tapTimes.push(now);
    if (tapTimes.length > MAX_TAPS) tapTimes.shift();
    
    if (tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
            intervals.push((tapTimes[i] - tapTimes[i-1]) / 1000);
        }
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        globalBPM = 60 / avgInterval;
        // Clamp to reasonable range
        globalBPM = Math.max(60, Math.min(200, globalBPM));
    }
}

// LFO Calculation
function calculateLFO(time, waveform = 'sine') {
    const phase = (time * globalBPM / 60) % 1.0;
    let value = 0;
    
    switch(waveform) {
        case 'sine':
            value = Math.sin(phase * 2 * Math.PI);
            break;
        case 'triangle':
            value = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
            break;
        case 'square':
            value = phase < 0.5 ? 1 : -1;
            break;
        case 'sawtooth':
            value = phase * 2 - 1;
            break;
    }
    
    return value * lfoDepth;
}

// Apply to parameters
function modulateRate(baseRate, lfoValue) {
    if (!bpmEnabled) return baseRate;
    // Multiplicative modulation: rate varies by ±lfoDepth%
    return baseRate * (1 + lfoValue);
}
```

## Testing Checklist

- [ ] BPM input accepts valid range
- [ ] Tap tempo calculates BPM correctly
- [ ] LFO modulates parameters smoothly
- [ ] Modulation respects parameter bounds
- [ ] BPM saves/loads in presets
- [ ] Disabling BPM returns to base values
- [ ] Multiple parameters modulate independently
- [ ] Performance is acceptable (60fps maintained)


