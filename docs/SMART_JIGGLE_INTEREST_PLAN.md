# Smart Jiggle: Interest-Driven Exploration Plan

## Aesthetic End Result

**Goal:** Automatically find visuals that are *interesting* — not just responsive, but surprising, diverse, and sustained over time.

### Rationales

| Aesthetic quality | Rationale | Current gap |
|-------------------|-----------|-------------|
| **Responsiveness** | Visuals should react to music. When bass drops, something changes. When beat hits, there's a pulse. | ✓ We have this via correlation fitness |
| **Rhythmic alignment** | When music has a clear beat, visuals should lock in — scale pulses, expansion syncs. | ✓ Beat detection + beatOnset mapping |
| **Novelty** | Repetitive visuals (static rotation, same colors) feel dead. Interest requires change. | Partial: boredom penalizes, but doesn't drive exploration |
| **Diversity** | Same "good" state committed repeatedly = stuck. We want variety across the session. | ✗ No diversity tracking |
| **Coherence** | Not random chaos — changes should flow, transitions should feel intentional. | Partial: producer-style tuning, interpolation |
| **Surprise** | Predictable visuals are boring. Occasional unexpected shifts maintain attention. | ✗ No surprise metric |
| **Sustained evolution** | The system should keep finding new interesting states, not converge to one. | Partial: drift on commit, but can loop |

### Target experience

A user starts Smart Jiggle with a preset. Over 2–5 minutes:
- Visuals respond to the music (correlation)
- When the beat is clear, they lock in (beatOnset → scale/expansion)
- When visuals get repetitive, the system tries something different (boredom → exploration)
- When stuck in a local optimum, it widens search or jumps to a new preset (meta-tuning)
- Committed states are both good *and* different from recent commits (diversity)
- The result feels like a live VJ that's actually listening and adapting

---

## System Interactions (Current + Proposed)

```
                    ┌─────────────────┐
                    │  AudioAnalyzer  │
                    │  (FFT, bands,   │
                    │   beat, tempo)  │
                    └────────┬────────┘
                             │ AudioMetrics
                             ▼
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ VisualAnalyzer│◄───│  AudioMapper   │────►│  VisualParams   │
│ (pixels →    │     │ (metrics →     │     │  (shader in)    │
│  VisualMetrics)│   │  param mods)   │     └────────┬────────┘
└──────┬───────┘     └───────┬───────┘              │
       │                     │                      │
       │                     │  getActiveRoutes    │
       │                     │  add/remove/tune    │
       ▼                     ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│              AudioVisualCorrespondence                       │
│  record(audio, visual) → evaluate(mappings) → fitness,       │
│  boredom, routeScores, [NEW: interest, diversity, novelty]    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ResponsivityOptimizer (Smart Jiggle)            │
│  tick() → perturb params, add routes, escape, commit          │
│  [NEW: interest score, diversity-aware commit, preset seed,  │
│   interest-driven param selection]                           │
└─────────────────────────────────────────────────────────────┘
```

### Combinatory interactions to add

| Interaction | Description | Rationale |
|-------------|-------------|-----------|
| **Audio × Visual** | beatOnset × fillRatio = rhythmic pulse. bass × scale = energy swell. | Already via mappings; ensure beatOnset is favored when beatConfidence high |
| **Boredom × Param selection** | When boredom > 0.6, prioritize params that increase temporalFlux, novelty | Boredom should drive exploration, not just penalize |
| **Diversity × Commit** | Before committing, check distance from last N commits. Prefer diverse commits | Avoid committing same state repeatedly |
| **Escape × Preset** | When escaping, pick preset that's *different* from current (param-space distance) | Jump to unexplored region, not random |
| **Interest × Fitness** | interest = α·fitness + β·novelty + γ·diversity. Optimize interest, not just fitness | Single objective that captures "interesting" |

---

## Phase 1: Interest Score (Foundation)

**Goal:** Replace/adjoin fitness with a composite "interest" score that combines responsiveness, novelty, and diversity.

### 1.1 Extend AudioVisualCorrespondence

**File:** `src/visual/AudioVisualCorrespondence.ts`

**Changes:**
- Add `interest` to `CorrespondenceResult` (0–1)
- Add `novelty` (0–1) — already computed internally; expose it
- Add `diversity` (0–1) — distance of current visual vector from recent commit history (needs commit history from outside)
- Formula: `interest = α·fitness + β·(1 - boredom) + γ·novelty` initially; add diversity when we have commit history

**Options:**
```ts
interestWeights?: { fitness: number; novelty: number; boredomInverse: number };
// e.g. { fitness: 0.5, novelty: 0.3, boredomInverse: 0.2 }
```

**Rationale:** Interest is the single number we optimize. It rewards responsiveness (fitness), change (novelty), and non-repetition (1 - boredom).

### 1.2 ResponsivityOptimizer uses interest

**File:** `src/visual/ResponsivityOptimizer.ts`

**Changes:**
- Add callback `evaluateInterest?: () => number` or extend `evaluateFitness` to return interest when available
- Optimizer tracks `bestInterest` alongside `bestMaxFitness`; use interest for "new best" and commit decisions when available
- Fallback: if no interest, use fitness (backward compatible)

**Rationale:** Optimizer should optimize interest when we have it. During migration, fitness remains the fallback.

---

## Phase 2: Diversity-Aware Commit ✓ Implemented

**Goal:** Avoid committing states that are too similar to recent commits. Prefer diverse states.

### 2.1 Commit history

**File:** `src/visual/ResponsivityOptimizer.ts` or new `src/visual/CommitHistory.ts`

**Data structure:**
```ts
interface CommitRecord {
  params: VisualParams;
  mappings: AudioMappings | null;
  interest: number;
  time: number;
}
private commitHistory: CommitRecord[] = [];
private static COMMIT_HISTORY_SIZE = 5;
```

**Flow:**
- On `performCommit`, push `{ params, mappings, interest, time }` to history
- Before commit, compute `diversity` = min distance from current best to each of last N commits (in normalized param space)
- When choosing what to commit: if `significantImprovement` OR `diversity > threshold`, commit full best; else preserve 1–3 deltas

### 2.2 Diversity metric

**Approach:** Normalize each param to 0–1 (using param range), form vector, compute Euclidean distance. Average over last N commits.

```ts
function paramDistance(a: VisualParams, b: VisualParams, params: string[]): number {
  let sum = 0;
  for (const p of params) {
    const range = getOptimizerParamRange(p);
    const na = (a[p] - range.min) / (range.max - range.min);
    const nb = (b[p] - range.min) / (range.max - range.min);
    sum += (na - nb) ** 2;
  }
  return Math.sqrt(sum / params.length);
}
```

**Rationale:** Committing a state that's very close to a recent commit is redundant. We want the session to explore the space.

---

## Phase 3: Interest-Driven Param Selection ✓ Implemented

**Goal:** When boredom is high, prioritize params that tend to increase visual change (temporalFlux, novelty, colorEntropy).

### 3.1 Extend prioritizeParamsForVisual

**File:** `src/visual/ResponsivityOptimizer.ts`

**Current:** Prioritizes scale, strokeWeight, etc. when too bright/dark/flat.

**Add:** When `boredom > 0.6`, boost params that affect:
- `temporalFlux`: expansionFactor, fadeAmount, emanationRate, autoRotationSpeed, jiggleAmount, spikeFrequency
- `colorEntropy`: hue, hueShiftAmount
- `edgeDensity`: spikiness, strokeWeight, noiseAmount

**Logic:**
```ts
if (boredom > 0.6) {
  const changeParams = ['expansionFactor', 'fadeAmount', 'autoRotationSpeed', 'jiggleAmount', 
    'spikeFrequency', 'hueShiftAmount', 'spikiness', 'noiseAmount'];
  if (changeParams.includes(p)) score = 0.85;
}
```

**Rationale:** Boredom means "we're stuck in a repetitive loop." The fix is to perturb params that actually change the visual, not just fix brightness.

---

## Phase 4: Preset-as-Seed Exploration ✓ Implemented

**Goal:** When escaping or when bored for too long, jump to a preset that's *different* from current state, then tune from there.

### 4.1 Preset distance

**File:** `src/presets/PresetManager.ts` or utility in `ResponsivityOptimizer`

**Function:**
```ts
function presetDistance(preset: Preset, current: VisualParams, params: string[]): number {
  return paramDistance(preset.params, current, params);
}
```

### 4.2 Escape logic change

**File:** `src/visual/ResponsivityOptimizer.ts`

**Current:** On escape, 70% revert to best, 25% random preset, 5% revert.

**New:** When loading random preset, pick one that maximizes distance from current params (among top 5 by distance). This ensures we jump to an *explored* region.

```ts
// Instead of: names[Math.floor(Math.random() * names.length)]
// Use: pickDiversePreset(currentParams, names) 
//   -> sort presets by distance, pick randomly from top 3 most distant
```

### 4.3 Boredom-triggered preset jump (optional)

**New trigger:** When `boredom > 0.85` for `boredomPresetJumpSec` (e.g. 12s), trigger a "soft escape" — load a diverse preset, reset correspondence, continue. Don't reset best; just change the exploration seed.

**Rationale:** If we're bored for a long time, we're stuck. A preset jump is a structured way to try a completely different visual regime.

---

## Phase 5: Novelty and Surprise (Optional Enhancement)

**Goal:** Add explicit novelty/surprise to the interest score.

### 5.1 Surprise metric

**Concept:** Predict next-frame visual metrics from recent history (simple linear or EMA). Surprise = prediction error.

**File:** `src/visual/VisualAnalyzer.ts` or `AudioVisualCorrespondence.ts`

**Approach:**
- Keep EMA of each visual metric
- Surprise = |current - predicted|, averaged over key metrics
- Add to VisualMetrics or compute in Correspondence

**Rationale:** Predictable visuals are boring. When the next frame surprises us (in a good way), that's interesting.

### 5.2 Novelty exposure

**Current:** Novelty is in VisualMetrics, used in boredom. Not exposed in CorrespondenceResult.

**Change:** Add `novelty` to CorrespondenceResult. Use it in interest formula.

---

## Phase 6: Audio Structure Awareness ✓ Implemented

**Goal:** Adapt exploration to song structure (intro, build, drop, breakdown).

### 6.1 Structure signals

**From AudioMetrics / AudioEventDetector:**
- `emptiness` high + `rms` low = breakdown / intro
- `rms` rising after low = build
- `beatConfidence` high = drop / chorus
- Event types: drop, breakdown, songStart

### 6.2 Regime switching

**Concept:** Different "regimes" with different goals:
- **Rhythmic:** Maximize beat alignment (when beatConfidence > 0.5)
- **Ambient:** Prefer smooth, low variance (when emptiness high)
- **Chaotic:** Prefer high novelty (when coming out of breakdown)

**Implementation:** Adjust interest weights or param prioritization based on current audio regime. E.g. in rhythmic regime, add extra weight to beatOnset correlation.

**Rationale:** A good VJ adapts to the song's structure. Breakdown = calm visuals. Drop = punchy, rhythmic.

---

## Implementation Order

| Phase | Scope | Dependencies | Risk |
|-------|-------|--------------|------|
| **1** | Interest score (fitness + novelty + boredom) | None | Low |
| **2** | Diversity-aware commit | Phase 1 (interest) | Medium |
| **3** | Interest-driven param selection (boredom) | None | Low |
| **4** | Preset-as-seed (diverse preset on escape) | None | Low |
| **5** | Novelty/surprise in interest | Phase 1 | Low |
| **6** | Audio structure / regimes | Phase 1–3 | Medium |

**Recommended sequence:** 1 → 3 → 4 → 2 → 5 → 6

Phase 1 and 3 give immediate benefit (interest score, boredom-driven exploration). Phase 4 improves escape behavior. Phase 2 requires commit history and is more involved. Phase 5 and 6 are refinements.

---

## File Change Summary

| File | Changes |
|------|---------|
| `src/visual/AudioVisualCorrespondence.ts` | Add interest, novelty to result; interest formula; optional diversity input |
| `src/visual/ResponsivityOptimizer.ts` | Use interest; commit history; diversity-aware commit; boredom param boost; diverse preset on escape |
| `src/visual/VisualMetrics.ts` | Possibly add surprise (or compute in Correspondence) |
| `src/App.ts` | Wire evaluateInterest; pass commit history to Correspondence if needed |
| `src/presets/PresetManager.ts` | Add `getPresetByName` return type for distance; or add `getPresetParams(name)` |
| New: `src/visual/CommitHistory.ts` (optional) | Encapsulate commit history and diversity computation |

---

## Route Exploration (Implemented)

**Goal:** Make route/mapping add/remove a first-class part of the search, not a rare side effect.

### Options (ResponsivityOptimizer)

| Option | Default | Description |
|--------|---------|-------------|
| `routeAddCooldownSec` | 12 | Min seconds between add attempts (was 30) |
| `routeAddProbabilityBase` | 0.008 | Per-frame probability when canTryAdd (~1 try per 2s at 60fps) |
| `routeAddFewRoutesThreshold` | 2 | When routes < this, 4× add probability |
| `routeAddBoredomThreshold` | 0.5 | When boredom > this, 2× add probability |
| `routeAddScheduleEvals` | 4 | Every N evals, force an add attempt |
| `routeRemoveProbability` | 0.06 | Per-perturb chance to try removing a route |

### Behavior

- **0 routes:** 2s cooldown, always try add when candidates exist
- **Few routes (< 2):** 4× add probability
- **Boredom high:** 2× add probability (try new mappings when stuck)
- **Schedule:** Every 4 evals (~8s), force an add attempt
- **Remove:** 6% chance per perturb cycle when routes ≥ 2

---

## Configuration Options (New)

```ts
// ResponsivityOptimizerOptions
interestWeights?: { fitness: number; novelty: number; boredomInverse: number };
diversityCommitThreshold?: number;  // min distance to commit full best when improvement marginal
boredomParamBoostThreshold?: number;  // boredom above this → prioritize change-inducing params
boredomPresetJumpSec?: number;  // 0 = disabled. When boredom high for this long, load diverse preset
presetDiversityTopK?: number;  // when escaping, pick from top K most distant presets
```

---

## Success Criteria

1. **Interest increases over session** — not just fitness; the composite interest score trends up or stays high.
2. **Diverse commits** — consecutive commits are measurably different (param distance > threshold).
3. **Boredom recovery** — when boredom exceeds 0.7, the system tries change-inducing params within ~30s.
4. **Escape effectiveness** — after escape to preset, we find a new good state within 1–2 commits (not immediate revert).
5. **User perception** — "It keeps finding new interesting looks" rather than "It found one good look and stuck."
