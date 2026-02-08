# Modulation Signal Flow (Review)

## Does the metric get normalized in a min/max window, then output 0–100% in the target range?

**Yes**, in two stages:

### 1. Analyzer: metric → 0–1 (within auto min/max)

- **AudioAnalyzer** keeps a running min/max per metric and normalizes into 0–1:
  - `normalize(value, min, max) = clamp((value - min) / (max - min), 0, 1)`
- So **getMetrics()** already returns metrics in **0–1** (normalized within the analyzer’s adaptive window).
- There is no user-visible “input min/max” in the modulation UI; that window is internal and adaptive.

### 2. Mapper: 0–1 → parameter-space output (slot range = “0–100%”)

Per-slot chain in **AudioMapper.computeSlotValue()**:

1. **Metric (0–1)** × **amount** → clamp 0–1  
2. **Curve** (power) → still 0–1  
3. **Invert** (optional) → still 0–1  
4. **EMA smoothing** → still 0–1  
5. **Multiplier + offset** → clamp 0–1  
6. **Range map**: `output = rangeMin + normalized × (rangeMax - rangeMin)`

So the internal 0–1 value is mapped to the slot’s **output range** `[rangeMin, rangeMax]` in the **target parameter’s units** (e.g. scale 0.2–1.5, hue 0–360). That is exactly “0–100% of the slot’s chosen range”:

- **0%** → `rangeMin`  
- **100%** → `rangeMax`  

If the slot’s range equals the param’s full range, then 0–100% is the full parameter range. If the slot uses a subset (e.g. scale 0.3–0.8), then 0–100% is that subset.

**Summary:** The metric is normalized to 0–1 in the analyzer (min/max window). The mapper then turns that 0–1 into a value that is “0–100% of the slot’s output range” in the target visual parameter’s units.

---

## More elegant synth/LFO-style visualization (suggestions)

Current UI: horizontal bar with “Live” marker and optional min/max bands. To make the mapping easier to read (input → processing → output), you could add one of these:

### A. Dual strip (input vs output)

- **Left strip:** Source metric 0–1 (e.g. “RMS” level).
- **Right strip:** Output in parameter space:
  - Full bar = param’s full range (e.g. scale 0.1–2).
  - A **band** shows the slot’s `[rangeMin, rangeMax]`.
  - A **marker** shows current output value.
- Labels: “In” and “Out” (or source name and param name). Makes “this much input → this much output in this range” obvious.

### B. Mini LFO waveform

- Small canvas or div (e.g. 120×24 px) per slot.
- Draw the last ~0.5–1 s of **slot output** (or the 0–1 value before range map) as a waveform.
- Optional horizontal lines for `rangeMin` / `rangeMax` (or 0 / 1) so you see modulation depth and shape at a glance (LFO-style).

### C. Single vertical “mod” meter (synth style)

- One vertical bar per slot:
  - Bottom = `rangeMin`, top = `rangeMax`.
  - A moving fill or needle = current output.
  - Optional: dim band for “base value” and a different color for “modulation amount” (if you later expose base vs mod).
- Reads like a VCA or mod amount meter: “needle in this range = output in this range.”

### D. Inline “signal flow” labels

- Keep the current bar but add very short labels:
  - Above bar: “Source → [rangeMin, rangeMax]”
  - Or: “0–1 → [rangeMin, rangeMax]” and show the current value (e.g. “0.47”).
- Helps tie the bar to “normalized in, 0–100% of this range out” without changing layout much.

Recommendation: **A (dual strip)** or **B (mini waveform)** give the clearest “synth/LFO” feel and make the mapping (normalized metric → 0–100% of slot range) obvious. **C** is good if you want a compact, single vertical meter per slot.
