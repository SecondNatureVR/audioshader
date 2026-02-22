# Audio Rate of Change & Event Detection — Exploration

A design exploration for:
1. **Rate-of-change metrics** — derivatives of audio features for responsive modulation
2. **Event detection** — song changes, section boundaries, drops, and other transitions to trigger preset changes or large visual shifts

---

## Part 1: Rate of Change Parameters

### 1.1 Why Rate of Change?

Current metrics (rms, bass, mid, high, collision, etc.) are **level-based**. They tell you *how much* of something is present. Rate of change tells you *how fast* it's changing.

**Use cases:**
- **Attack vs. sustain:** High positive rate = attack/onset; low or negative = decay/sustain
- **Energy build-up:** Rising RMS derivative before a drop
- **Transient emphasis:** Map rate to stroke weight, scale burst, or flash intensity
- **Smoother modulation:** Derivative can feel more "alive" than raw level for certain params

### 1.2 Computation Approaches

#### A. Finite Difference (Simplest)

For any metric `M(t)`:
```
rate(t) = M(t) - M(t-1)
```

Or with longer window for stability:
```
rate(t) = (M(t) - M(t - k)) / k   // k = frames
```

**Pros:** Trivial, no extra state beyond previous value  
**Cons:** Noisy; sensitive to frame rate; needs smoothing

#### B. Smoothed Derivative (Recommended)

1. Keep a short history of the metric (e.g. last 5–10 frames)
2. Fit a line (linear regression) or compute (M_now - M_old) / dt
3. Apply EMA to the raw derivative to reduce noise

```ts
// Pseudocode
const history: number[] = [];  // e.g. last 8 values
const dt = 1/60;  // ~16.67ms per frame at 60fps

// Raw derivative: slope over last N frames
const slope = (history[history.length-1] - history[0]) / (history.length * dt);
// Or: central difference for less lag
const slope = (history[history.length-1] - history[1]) / ((history.length - 2) * dt);

// Smooth it
smoothedRate = smooth(smoothedRate, slope);
```

#### C. Envelope Follower with Asymmetric Attack/Decay

Track an envelope with different rise/fall times:
```
if (input > envelope) envelope = input;           // instant attack
else envelope = envelope * decayFactor + input * (1 - decayFactor);  // slow decay
rate = envelope - prevEnvelope;
```

The **rate** here is the change in the envelope, which naturally emphasizes attacks.

#### D. Band-Specific Rate of Change

Compute rate for each band (bass, mid, high) separately. Useful for:
- **Bass rate** — kick drum hits, sub drops
- **High rate** — hi-hat bursts, cymbal crashes
- **Mid rate** — vocal/instrument attacks

### 1.3 Proposed New Metrics

| Metric | Description | Computation |
|--------|-------------|-------------|
| **rmsRate** | Rate of change of RMS | Smoothed (rms[t] - rms[t-1]) / dt |
| **bassRate** | Rate of change of bass energy | Same, for bandEnergy[0] |
| **midRate** | Rate of change of mid energy | Same, for bandEnergy[1] |
| **highRate** | Rate of change of high energy | Same, for bandEnergy[2] |
| **rmsRatePositive** | Only positive RMS changes (attacks) | max(0, rmsRate) |
| **rmsRateNegative** | Only negative RMS changes (decays) | max(0, -rmsRate) |
| **spectralFlux** | Full spectral flux (L2 norm) | √Σ(X_t - X_{t-1})² — more precise than collision |
| **onsetStrength** | Peak-picked spectral flux | Local max of spectral flux, or threshold crossing |

**Note:** `collision` already approximates **positive-only spectral flux**. You could:
- Expose it as `spectralFlux` and add a **full** (signed) spectral flux variant
- Add `collisionRate` = rate of change of collision (second derivative of spectrum — very transient-focused)

### 1.4 Normalization of Rate Metrics

Rates can be positive or negative and unbounded. Options:

1. **Symmetric clamp:** `clamp(rate, -1, 1)` then map to `[0, 1]` via `(rate + 1) / 2`
2. **Separate positive/negative:** Two metrics, each in `[0, 1]`
3. **Magnitude only:** `abs(rate)` then normalize — loses direction
4. **Min-max over window:** Like existing metrics, track min/max over last N seconds and normalize

Recommendation: **Separate positive/negative** for attack vs. decay, or **magnitude** if you only care about "how much change."

---

## Part 2: Event Detection

### 2.1 Event Types & Use Cases

| Event | Description | Trigger Use |
|-------|-------------|-------------|
| **Onset / Hit** | Transient (drum hit, note start) | Flash, scale pulse, stroke burst |
| **Drop** | Sudden energy increase (EDM drop, chorus entry) | Preset change, emanation rate jump, full visual shift |
| **Breakdown** | Sudden energy decrease (breakdown, verse) | Calmer preset, reduced rate |
| **Section change** | Verse→chorus, chorus→bridge | Preset rotation, palette shift |
| **Song change** | New track (e.g. in a mix or playlist) | Reset, load new preset |
| **Silence** | Extended quiet (gap between songs) | Fade out, hold last frame |

### 2.2 Detection Approaches

#### A. Onset Detection (Already Partially There)

**Current:** `collision` = positive spectral flux. High collision ≈ onset.

**Improvements:**
1. **Threshold + debounce:** Fire "onset" when collision > threshold, with min time between events (e.g. 80ms)
2. **Peak picking:** Onset = local maximum of collision in a short window
3. **Superflux variant:** Use max-filtered spectral flux to reduce vibrato false positives (more complex)

**Implementation:** Add `onsetTrigger` boolean or `onsetStrength` (0–1) that peaks briefly on hits. Optionally expose a callback: `onOnset?: () => void`.

#### B. Drop Detection

A "drop" is typically:
- **Rapid RMS increase** over 0.5–2 seconds
- **Bass energy surge**
- **Spectral flux spike** (new content)
- **Low→high transition** in energy

**Algorithm:**
1. Keep a short-term RMS (e.g. 200ms) and a longer-term RMS (e.g. 2s)
2. Drop = short-term > long-term × (1 + threshold), e.g. 1.5×
3. Or: track RMS derivative; sustained positive derivative = build-up; sudden step up = drop
4. Debounce: one drop per N seconds

```ts
// Pseudocode
const shortRMS = ema(rms, 0.1);   // ~100ms
const longRMS = ema(rms, 1.5);    // ~1.5s
if (shortRMS > longRMS * 1.4 && !recentDrop) {
  fireDrop();
  recentDrop = true;
  setTimeout(() => recentDrop = false, 3000);
}
```

#### C. Breakdown Detection

Opposite of drop:
- **Rapid RMS decrease**
- **Emptiness increase** (many silent bins)
- **Low imbalance** shift (bass drops out)

**Algorithm:** Same as drop but inverted: `shortRMS < longRMS * 0.5` or similar.

#### D. Section Change (Verse/Chorus/Bridge)

Harder without ML. Options:

1. **Chroma / harmonic change:** Requires FFT → chroma transform. Significant chroma shift = possible section change.
2. **Timbre change:** MFCC or spectral centroid shift. More instrumentation = different centroid.
3. **Novelty-based:** Self-similarity matrix diagonal (offline) — not real-time.
4. **Heuristic:** Combine several cues:
   - Energy contour change (rise/fall)
   - Emptiness spike (brief silence between sections)
   - Harshness / mud / coherence shift (different mix)

**Practical approach:** Use a **"structure change"** score that combines:
- `abs(rmsRate)` large
- `emptiness` spike
- `coherence` change
- Debounce heavily (e.g. one event per 8–16 bars at 120 BPM = 16–32 seconds)

#### E. Song Change

**Cues:**
- **Extended silence:** emptiness ≈ 1, rms ≈ 0 for 2–5 seconds
- **Abrupt timbre shift** when new song starts (attack + new spectral profile)
- **Metadata:** If using a player API (Spotify, etc.), song change is explicit

**Algorithm:**
1. If `emptiness > 0.9` and `rms < 0.05` for > 2 seconds → "silence" event
2. When coming out of silence, `rms` and `collision` spike → "song start" event
3. Optional: reset all min/max normalization on song start

#### F. Silence Detection

Simple: `rms < threshold` for N consecutive frames. Used to:
- Pause visual updates
- Fade to black
- Hold last frame
- Trigger "song end" before "song start"

### 2.3 Event Output Design

**Option 1: Callback-based**
```ts
interface AudioEventCallbacks {
  onOnset?: () => void;
  onDrop?: () => void;
  onBreakdown?: () => void;
  onSectionChange?: () => void;
  onSongStart?: () => void;
  onSilence?: () => void;
}
```

**Option 2: Event stream + state**
```ts
interface AudioEvent {
  type: 'onset' | 'drop' | 'breakdown' | 'section' | 'songStart' | 'silence';
  strength: number;  // 0-1 confidence
  timestamp: number;
}

// Consumer polls or subscribes
getRecentEvents(): AudioEvent[];
```

**Option 3: Boolean flags in metrics**
```ts
// Add to AudioMetrics
onset: boolean;      // true for 1-2 frames on hit
drop: boolean;
breakdown: boolean;
sectionChange: boolean;
silence: boolean;
```

**Recommendation:** **Option 2** (event stream) for flexibility. Preset manager or App can subscribe and decide what to do (e.g. only `drop` and `sectionChange` trigger preset change; `onset` triggers a subtle flash).

### 2.4 Integration with Preset Changes

- **Drop** → Load "intense" preset from a pool, or increase emanation rate
- **Breakdown** → Load "calm" preset
- **Section change** → Cycle through a user-defined preset list
- **Song start** → Optional: load random preset, or user-configured "default for new song"
- **Silence** → Fade to black or hold; on **song start** after silence, reset and load preset

---

## Part 3: Implementation Sketch

### 3.1 Rate of Change — Minimal Addition

1. **State:** For each metric you want a rate for, keep `prevValue` and optionally a short `history: number[]`.
2. **Compute:** `rate = (current - prev) / dt` or use linear regression over history.
3. **Smooth:** EMA on rate.
4. **Expose:** Add `rmsRate`, `bassRate`, etc. to `AudioMetrics` and `AudioMapper` source list.

### 3.2 Event Detection — New Module or Extend Analyzer

**Option A:** Extend `AudioAnalyzer` with event detection logic.  
**Option B:** New `AudioEventDetector` that consumes `AudioMetrics` (and optionally raw FFT) and emits events.

**Recommendation:** **Option A** for simplicity — events are derived from the same FFT data. Add:
- `getEvents(): AudioEvent[]` or `getEventState(): AudioEventState`
- Internal state: onset debounce, drop/breakdown debounce, silence timer, etc.

### 3.3 File Structure

```
src/audio/
├── AudioAnalyzer.ts      # Add rate metrics, event detection
├── AudioMapper.ts        # Add new metric sources (rmsRate, etc.)
└── types.ts (or types/index.ts)  # AudioEvent, AudioEventState
```

### 3.4 Tuning Parameters (User-Adjustable?)

- Onset threshold
- Drop ratio (short/long RMS)
- Breakdown ratio
- Silence duration before "silence" event
- Section change debounce (seconds)
- Min time between same event type

---

## Part 4: Summary Table

| Feature | Complexity | Data Needed | Use Case |
|---------|------------|-------------|----------|
| **rmsRate, bassRate, etc.** | Low | Prev value + dt | Modulation routing |
| **Onset (peak collision)** | Low | collision + threshold + debounce | Flash, pulse |
| **Drop** | Low | Short/long RMS | Preset change |
| **Breakdown** | Low | Same, inverted | Preset change |
| **Silence** | Low | rms + emptiness + timer | Fade, hold |
| **Song change** | Low | Silence → start | Reset, new preset |
| **Section change** | Medium | Multi-metric heuristic | Preset rotation |

---

---

## Part 5: Testing & Validation

### 5.1 The Accuracy Problem

**Ground truth is subjective.** There's no definitive "correct" answer for "was that a drop?" — different listeners might disagree. You can still validate that:

1. **Logic behaves as designed** — given synthetic inputs, outputs match expectations
2. **Events fire when they should** — on known test sequences
3. **Events don't fire when they shouldn't** — false positive rate is acceptable
4. **Real-world behavior** — manual testing with diverse music

### 5.2 Unit Tests (Synthetic Metric Sequences)

**Approach:** Feed a **sequence of synthetic `AudioMetrics`** into the event detector (or a thin wrapper that consumes metrics and emits events). No real audio, no `AudioContext`, no `getUserMedia`.

```ts
// Event detector accepts metrics + timestamp, returns events
// So we can drive it with fake data
const detector = new AudioEventDetector();
const events: AudioEvent[] = [];

// Simulate: quiet → sudden loud (drop)
for (let i = 0; i < 60; i++) {
  const rms = i < 30 ? 0.1 : 0.9;  // step at frame 30
  const metrics = makeMetrics({ rms, bass: rms * 0.8 });
  events.push(...detector.update(metrics, i / 60));
}
expect(events.some(e => e.type === 'drop')).toBe(true);
```

**Test cases:**

| Scenario | Metric sequence | Expected event |
|---------|-----------------|----------------|
| **Drop** | rms: 0.1 for 1s, then 0.9 for 0.5s | `drop` |
| **Breakdown** | rms: 0.8 for 1s, then 0.15 for 0.5s | `breakdown` |
| **Silence** | rms: 0.02, emptiness: 0.95 for 3s | `silence` |
| **Song start** | silence for 2s, then rms: 0.7 + collision spike | `songStart` |
| **Onset** | collision: 0.1, 0.1, 0.8, 0.2 (spike) | `onset` |
| **No false drop** | rms: 0.5 constant for 5s | no `drop` |
| **Debounce** | two drops 1s apart | only first `drop` (or both if debounce allows) |

**Key:** The event detector must be **injectable** — it receives metrics and time, not raw audio. That allows unit tests without `AudioContext` or `getUserMedia`.

### 5.3 Integration Tests (Mock AnalyserNode)

If the event logic lives inside `AudioAnalyzer`, you need to either:

- **Extract** the event logic into a separate `AudioEventDetector` that takes `AudioMetrics` — then unit test with synthetic metrics (above), and integration test that `AudioAnalyzer.getMetrics()` + `AudioEventDetector.update()` works when fed by a real analyser
- **Mock** `AnalyserNode` and drive it with precomputed FFT data — more complex, requires building fake `Uint8Array` frequency/time data

**Recommendation:** Extract event detection into a separate module that consumes `AudioMetrics`. Then `AudioAnalyzer` just produces metrics; the event detector is pure logic and easily unit-tested.

### 5.4 Manual Testing (Real Audio)

**Debug UI / visualization:**

1. **Event log panel** — show last N events with timestamp and type
2. **Metric strip chart** — plot rms, shortRMS, longRMS, collision over last 10–30 seconds
3. **Event markers** — vertical lines on the strip chart when events fire
4. **Preset change indicator** — flash or badge when an event triggers a preset change

**Test playlist:**

- **EDM with clear drops** — verify drops fire at the right moments
- **Acoustic / sparse** — verify no false drops during quiet sections
- **Mix/continuous DJ set** — test song change (silence → new track)
- **Speech/podcast** — verify no spurious events (or acceptable behavior)
- **Classical** — gradual dynamics; section changes may be subtle

**Validation checklist:**

- [ ] Drops fire within ~200ms of the perceived drop
- [ ] No more than 1–2 false drops per minute on calm music
- [ ] Breakdown fires when energy clearly drops
- [ ] Silence detected within 2–3 seconds of actual silence
- [ ] Song start fires when new track begins after silence
- [ ] Onset (if implemented) fires on drum hits without excessive false positives

### 5.5 Regression Tests with Recorded Metrics

**Approach:** Record `AudioMetrics` during manual testing (e.g. `JSON.stringify` of metrics array over time), save as fixture files. Replay through the event detector and assert events match what was manually annotated.

```ts
// fixtures/drop-test.json: { metrics: [...], expectedEvents: [{ type: 'drop', approxTime: 12.5 }] }
const fixture = loadFixture('drop-test.json');
const events = replayThroughDetector(fixture.metrics);
expect(events).toContainEventNear('drop', 12.5, toleranceSeconds: 0.5);
```

**Effort:** Higher — requires building a recorder, annotation tool, and fixture format. Useful once the detector is stable and you want to lock in behavior.

### 5.6 Test Structure Summary

| Level | What | How |
|-------|------|-----|
| **Unit** | Event logic with synthetic metrics | `AudioEventDetector.update(metrics, time)` → events |
| **Unit** | Rate-of-change math | `computeRate(history, dt)` → correct derivative |
| **Integration** | Analyzer + detector | Real `AudioContext` + test audio file (optional, may need Playwright) |
| **Manual** | Real music | Debug UI + test playlist + checklist |
| **Regression** | Locked behavior | Recorded metric fixtures + replay |

### 5.7 Design for Testability

To make event detection testable:

1. **Separate event logic from audio I/O** — `AudioEventDetector` takes `(metrics, timestamp)` and returns events
2. **Use `performance.now()` or injected time** — avoid `Date.now()` if you need deterministic tests
3. **Configurable thresholds** — pass options so tests can tune sensitivity
4. **No global state** — detector is stateless per update, or state is explicit and resettable

### 5.8 Low-Hanging Fruit Tests

Concrete tests to add first — minimal effort, high value. Implement in this order:

#### Rate-of-change math (`rateUtils.test.ts` or similar)

```ts
it('computes positive rate when value increases', () => {
  expect(computeRate(0.2, 0.5, 1/60)).toBeGreaterThan(0);
});
it('computes negative rate when value decreases', () => {
  expect(computeRate(0.8, 0.3, 1/60)).toBeLessThan(0);
});
it('returns 0 when value unchanged', () => {
  expect(computeRate(0.5, 0.5, 1/60)).toBe(0);
});
it('scales with dt', () => {
  const r1 = computeRate(0, 1, 1);
  const r2 = computeRate(0, 1, 0.5);
  expect(r2).toBe(2 * r1);
});
```

#### Event detector — drop & steady (`AudioEventDetector.test.ts`)

```ts
it('fires drop when short RMS exceeds long RMS by threshold', () => {
  const detector = new AudioEventDetector({ dropRatio: 1.4 });
  for (let i = 0; i < 30; i++) detector.update(makeMetrics({ rms: 0.1 }), i/60);
  const events = detector.update(makeMetrics({ rms: 0.9 }), 30/60);
  expect(events.some(e => e.type === 'drop')).toBe(true);
});

it('does NOT fire drop when RMS is steady', () => {
  const detector = new AudioEventDetector();
  for (let i = 0; i < 60; i++) {
    const events = detector.update(makeMetrics({ rms: 0.5 }), i/60);
    expect(events.some(e => e.type === 'drop')).toBe(false);
  }
});

it('fires silence after sustained quiet', () => {
  const detector = new AudioEventDetector({ silenceDuration: 2 });
  for (let i = 0; i < 150; i++) {
    const events = detector.update(makeMetrics({ rms: 0.02, emptiness: 0.9 }), i/60);
    if (i > 120) expect(events.some(e => e.type === 'silence')).toBe(true);
  }
});
```

#### Debounce

```ts
it('debounces drop events', () => {
  const detector = new AudioEventDetector({ dropDebounceMs: 2000 });
  const allEvents: AudioEvent[] = [];
  for (let i = 0; i < 30; i++) detector.update(makeMetrics({ rms: 0.1 }), i/60);
  allEvents.push(...detector.update(makeMetrics({ rms: 0.9 }), 30/60));
  for (let i = 31; i < 90; i++) detector.update(makeMetrics({ rms: 0.1 }), i/60);
  allEvents.push(...detector.update(makeMetrics({ rms: 0.9 }), 90/60));
  const drops = allEvents.filter(e => e.type === 'drop');
  expect(drops.length).toBe(1);
});
```

#### AudioMapper with new metrics

When `rmsRate`, `bassRate`, etc. are added to `AudioMetrics`:

```ts
it('maps rmsRate to parameter when source is rmsRate', () => {
  mapper.setModulation('scale', {
    enabled: true,
    slots: [{ ...createDefaultSlot('rmsRate', 'scale'), amount: 1, smoothing: 0 }],
  });
  const result = mapper.applyMappings(createDefaultParams(), makeMetrics({ rmsRate: 0.5 }));
  expect(result.scale).toBeDefined();
});
```

#### Spectral flux / collision (if extracted)

```ts
it('collision is high when spectrum changes positively', () => {
  const prev = new Uint8Array(1024).fill(50);
  const curr = new Uint8Array(1024).fill(150);
  expect(calculateSpectralFlux(prev, curr)).toBeGreaterThan(0.5);
});
it('collision is low when spectrum unchanged', () => {
  const data = new Uint8Array(1024).fill(100);
  expect(calculateSpectralFlux(data, data)).toBe(0);
});
```

#### Edge cases

```ts
it('handles first frame (no prev value)', () => {
  const detector = new AudioEventDetector();
  const events = detector.update(makeMetrics({ rms: 0.9 }), 0);
  expect(events).toEqual([]);
});

it('handles all-zero metrics', () => {
  const detector = new AudioEventDetector();
  expect(() => detector.update(makeMetrics({ rms: 0, bass: 0 }), 1)).not.toThrow();
});
```

#### Priority summary

| Test | Effort | Value |
|------|--------|-------|
| Rate math (4 tests) | ~10 min | High |
| Drop detection (2 tests) | ~15 min | High |
| No false drop on steady | ~5 min | High |
| Silence detection (1 test) | ~10 min | Medium |
| Debounce (1 test) | ~10 min | Medium |
| AudioMapper + new metric | ~5 min | Low |
| Edge cases (2 tests) | ~5 min | Medium |

**Start with:** Rate math + drop + no-false-drop. These cover the core behavior with minimal setup.

---

## References

- Dixon (2006) — Onset detection revisited
- Spectral flux: L2-norm of frame-to-frame spectrum difference
- Envelope followers: asymmetric attack/decay for amplitude tracking
- Music structure: novelty, repetition, homogeneity (offline SSM; real-time heuristics)
