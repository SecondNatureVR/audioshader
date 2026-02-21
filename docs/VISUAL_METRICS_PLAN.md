# Visual Metrics & Optimization Plan

A design document for an analogue to audio analysis that analyzes the **rendered visual output** to drive parameter tuning—either as a fitness function for evolutionary search or as a gradient signal for optimization.

---

## 1. Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Renderer       │────▶│  VisualAnalyzer   │────▶│  VisualMetrics   │
│  (WebGL canvas) │     │  (pixel analysis) │     │  (0–1 normalized)│
└─────────────────┘     └──────────────────┘     └────────┬──────────┘
                                                          │
         ┌────────────────────────────────────────────────┼────────────────────────────────┐
         │                                                │                                │
         ▼                                                ▼                                ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  VisualMapper   │     │  Evolutionary    │     │  Gradient       │
│  (direct drive) │     │  Optimizer       │     │  Optimizer      │
│  metrics→params │     │  (fitness→evolve)│     │  (fitness→step) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Mirrors existing audio flow:**
- `AudioAnalyzer` → `AudioMetrics` → `AudioMapper` → `VisualParams`
- `VisualAnalyzer` → `VisualMetrics` → `VisualMapper` / `Optimizer` → `VisualParams`

---

## 2. Pixel Readback Strategy

### 2.1 Performance Constraints

- **Full-resolution readback is expensive.** At 1920×1080, that's ~8M pixels × 4 bytes = 32MB per frame.
- **Downsample aggressively.** Analyze a small grid (e.g. 64×64 or 128×128) for metrics.
- **Throttle frequency.** Run analysis every N frames (e.g. every 3–5 frames) to stay under 60fps.
- **Use WebGL `readPixels`** into a typed array; avoid `getImageData` on a 2D canvas copy.

### 2.2 Implementation Options

| Approach | Pros | Cons |
|----------|------|------|
| **A. Read full framebuffer, downsample in JS** | Simple, full fidelity | Still reads full res (slow) |
| **B. Render to small offscreen FBO** | Only 64² or 128² pixels read | Requires extra render pass |
| **C. Read center region only** | No extra pass | May miss edge composition |
| **D. Web Worker + shared buffer** | Offloads CPU work | Async, more complex |

**Recommended:** **B** (small FBO) or **C** (center crop). Start with C for simplicity: `gl.readPixels(x, y, 64, 64, ...)` from the composite framebuffer.

---

## 3. Visual Metrics (Fitness Function Components)

These metrics are computed from pixel data and normalized to roughly 0–1. They can be combined into a scalar **fitness score** or used individually for multi-objective optimization.

### 3.1 Spatial Metrics (Single Frame)

| Metric | Description | Computation | "Interesting" Target |
|--------|--------------|-------------|----------------------|
| **luminanceVariance** | Brightness spread | Std dev of (0.299R + 0.587G + 0.114B) | Medium–high (avoid flat or blown) |
| **colorEntropy** | Color diversity | Shannon entropy of quantized RGB bins | Medium–high |
| **edgeDensity** | Structural complexity | Sobel/Laplacian magnitude, normalized | Medium (avoid noise or blank) |
| **saturationMean** | Color intensity | Mean of max(R,G,B)−min / max | Tunable |
| **centerMass** | Composition balance | Distance of luminance centroid from center | Low = centered, high = off-center |
| **radialSymmetry** | Radial structure | Correlation of opposite radial samples | High for kaleidoscope-like |
| **fillRatio** | Non-empty pixels | % of pixels above luminance threshold | Avoid 0 or 100% |

### 3.2 Temporal Metrics (Frame-to-Frame)

| Metric | Description | Computation | "Interesting" Target |
|--------|--------------|-------------|----------------------|
| **temporalFlux** | Frame-to-frame change | Mean absolute diff between frames | Medium–high (motion) |
| **fluxVariance** | Consistency of change | Variance of per-pixel flux | Avoid constant or erratic |
| **novelty** | Deviation from recent history | Distance from exponential moving average | Medium (surprising but coherent) |

### 3.3 Composite Fitness Function

```ts
// Example: weighted sum (tune weights for desired aesthetic)
fitness = 
  w1 * luminanceVariance * (1 - |luminanceVariance - 0.4|) +  // sweet spot
  w2 * colorEntropy +
  w3 * clamp(edgeDensity, 0.2, 0.8) +  // avoid extremes
  w4 * temporalFlux +
  w5 * novelty -
  w6 * (fillRatio < 0.05 || fillRatio > 0.95 ? 1 : 0);  // penalize empty/overfilled
```

**Alternative:** Multi-objective Pareto front—evolve a population and let the user pick from a diverse set of solutions.

---

## 4. Optimization Modes

### 4.1 Mode A: Visual Mapper (Direct Drive)

**Like AudioMapper, but source = visual metrics.**

- `VisualMapper` maps `VisualMetrics` → parameter offsets.
- Example: `luminanceVariance` high → increase `spikiness`; `temporalFlux` low → increase `autoRotationSpeed`.
- Use same slot system as `AudioMapper` (amount, curve, invert, smoothing, range).
- **Use case:** Real-time reactive visuals driven by the image itself (feedback loop).

### 4.2 Mode B: Evolutionary Optimizer

**Genetic algorithm / evolution strategy.**

1. **Population:** N parameter sets (e.g. 20–50).
2. **Fitness:** Composite score from `VisualAnalyzer`.
3. **Selection:** Keep top K, discard rest.
4. **Mutation:** Perturb params (Gaussian, scale by `PARAM_RANGES`).
5. **Crossover:** Optional blend of two parents.
6. **Evaluation:** Render each candidate (or a subset) for a short window, average fitness.

**Considerations:**
- **Evaluation cost:** Each individual = multiple frames. Use small population + short eval windows.
- **Elitism:** Keep best individual unchanged.
- **Diversity:** Niching or novelty search to avoid collapse to one local optimum.

### 4.3 Mode C: Gradient Descent / Hill Climbing

**Finite-difference gradient estimation.**

1. Current params = θ, fitness = F(θ).
2. For each param i: θ' = θ with small ε added to param i.
3. Gradient component: (F(θ') − F(θ)) / ε.
4. Step: θ ← θ + α × gradient (or use Adam/AdaGrad for smoother updates).

**Considerations:**
- **Noisy fitness:** Use multiple samples per direction, or smooth F over time.
- **Parameter scale:** Normalize steps by `PARAM_RANGES` so each param moves proportionally.
- **Sparse updates:** Only compute gradient every N frames.

### 4.4 Mode D: Hybrid

- **VisualMapper** for real-time feedback (e.g. `temporalFlux` → `emanationRate`).
- **Evolutionary** or **gradient** runs periodically (e.g. every 5 seconds) to nudge `baseParams` toward higher fitness.

---

## 5. File Structure (Proposed)

```
src/
├── visual/
│   ├── VisualAnalyzer.ts    # Pixel readback, metric computation
│   ├── VisualMetrics.ts     # Type definitions for metrics
│   ├── VisualMapper.ts      # Metrics → param offsets (like AudioMapper)
│   └── optimizers/
│       ├── EvolutionaryOptimizer.ts
│       └── GradientOptimizer.ts
```

### 5.1 VisualAnalyzer API (Draft)

```ts
interface VisualMetrics {
  luminanceVariance: number;
  colorEntropy: number;
  edgeDensity: number;
  saturationMean: number;
  centerMass: number;
  radialSymmetry: number;
  fillRatio: number;
  temporalFlux: number;
  fluxVariance: number;
  novelty: number;
  // Composite
  fitness: number;
}

class VisualAnalyzer {
  constructor(gl: WebGLRenderingContext, options?: {
    sampleWidth?: number;   // default 64
    sampleHeight?: number;
    sampleRegion?: 'center' | 'full' | 'custom';
    throttleFrames?: number;
    fitnessWeights?: Partial<Record<keyof VisualMetrics, number>>;
  });

  /** Call after render, with framebuffer bound to read from */
  analyze(framebuffer?: WebGLFramebuffer | null): VisualMetrics | null;

  /** Reset temporal state (e.g. when starting optimization) */
  reset(): void;
}
```

### 5.2 Renderer Integration

- `Renderer` exposes `getCompositeFramebuffer()` or `readPixels(x, y, w, h)` so `VisualAnalyzer` can read from the final composite.
- Alternatively, pass the canvas and have `VisualAnalyzer` create a small FBO and blit, or use `readPixels` on the default framebuffer if the composite is drawn to screen.

---

## 6. Implementation Phases

### Phase 1: VisualAnalyzer + Metrics
- [ ] Add `readPixels` path in Renderer (or accept gl + dimensions)
- [ ] Implement `VisualAnalyzer` with downsampled read
- [ ] Implement: luminanceVariance, colorEntropy, edgeDensity, fillRatio
- [ ] Implement: temporalFlux, novelty (with frame history)
- [ ] Composite fitness function with configurable weights
- [ ] Unit tests with synthetic pixel buffers

### Phase 2: VisualMapper
- [ ] `VisualMapper` class mirroring `AudioMapper` slot structure
- [ ] Source = `VisualMetrics` keys instead of `AudioMetrics`
- [ ] Integrate into App tick (optional, behind flag)
- [ ] UI for mapping visual metrics to params (reuse audio mapping panel pattern)

### Phase 3: Evolutionary Optimizer
- [ ] `EvolutionaryOptimizer` with configurable population size, mutation rate
- [ ] Fitness evaluation over a short window (e.g. 1–2 seconds)
- [ ] "Evolve" button / mode that runs for N generations
- [ ] Optional: display population as thumbnails or leaderboard

### Phase 4: Gradient Optimizer
- [ ] `GradientOptimizer` with finite-difference gradient
- [ ] Step size scheduling (e.g. decay over time)
- [ ] "Optimize" button that runs until convergence or timeout

### Phase 5: Hybrid & Polish
- [ ] Combine VisualMapper (real-time) + periodic optimizer (batch)
- [ ] Presets for fitness weights ("dynamic", "calm", "complex", "balanced")
- [ ] Export/import optimizer state

---

## 7. Fitness Function Design Tips

1. **Avoid trivial optima:** Penalize all-black, all-white, or single-color outputs.
2. **Sweet spots:** Use inverted distance from target (e.g. `1 - |x - 0.5|`) for metrics that have an ideal range.
3. **Temporal coherence:** Reward novelty but penalize chaotic flicker (use flux variance).
4. **User override:** Allow "this looks good" → add current frame to positive examples for a learned component (future).
5. **Ablation:** Make each metric toggleable so users can experiment with fitness composition.

---

## 8. References & Prior Art

- **Picbreeder** – evolutionary art with user-driven fitness
- **DeepDream** – gradient ascent on neural activations (conceptually similar)
- **NEAT** for visual agents – evolution of visual behavior
- **Quality diversity (MAP-Elites)** – maintain diverse population in behavior space
- **Audio reactive VJ tools** – often have "video feedback" modes that are conceptually related

---

## 9. Framebuffer Readback (Resolved)

The Renderer pipeline ends with:
- **Step 5:** Postprocess (kaleidoscope, tunnel) draws `compositeTexture` → **default framebuffer** (canvas)
- After `render()`, the canvas holds the final on-screen image

**Readback strategy:** Call `gl.readPixels(x, y, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, buffer)` with `gl.bindFramebuffer(gl.FRAMEBUFFER, null)` (or no bind—default is already active). Read from the center region to capture the main visual. The Renderer already unbinds at the end of `render()`, so the default framebuffer is active.

---

## 10. Open Questions

1. **Fitness subjectivity:** Should we support user feedback (thumbs up/down) to adapt weights?
2. **Optimization UX:** Run in background vs. dedicated "lab" mode with pause/step?
3. **Web Worker:** Is it worth moving pixel processing to a worker to avoid blocking the main thread?
