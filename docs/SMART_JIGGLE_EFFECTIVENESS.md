# Smart Jiggle: Param Effectiveness Rules & Temporary Beliefs

## Goal

Stop wasting perturbations on params that have no effect in the current context. Examples:
- `fillOpacity` when `fillSize ≈ 0` — nothing to fill
- `strokeOpacity` / `strokeGlow` when `strokeWeight ≈ 0` — no stroke visible

We want:
1. **Generalized rules** — declarative, easy to extend (not hardcoded if/else)
2. **Temporary beliefs** — learned from experience, decay over time, invalidate when context changes

---

## Param Effectiveness Rules (Static)

Declarative rules for known param dependencies. A param is **ineffective** when its prerequisites are not met.

### Data Structure

```ts
type EffectivenessCondition =
  | { param: keyof VisualParams; above: number }   // param must be > threshold
  | { param: keyof VisualParams; below: number };  // param must be < threshold

interface ParamEffectivenessRule {
  param: keyof VisualParams;
  /** Rule is active (param ineffective) when ANY condition fails */
  requires: EffectivenessCondition[];
}
```

### Example Rules

| Param        | Requires                          | Rationale                          |
|--------------|-----------------------------------|------------------------------------|
| fillOpacity  | fillSize > 0.02                   | Nothing to fill when fillSize ≈ 0  |
| strokeOpacity| strokeWeight > 0.002              | No stroke when weight ≈ 0          |
| strokeGlow   | strokeWeight > 0.002              | Same as strokeOpacity              |
| blendOpacity | fillSize > 0.02 (optional)       | Blending near-empty may be weak    |

### Evaluation

```ts
function isRuleSatisfied(rule: ParamEffectivenessRule, current: VisualParams): boolean {
  for (const cond of rule.requires) {
    const val = current[cond.param] ?? 0;
    if ('above' in cond && val <= cond.above) return false;
    if ('below' in cond && val >= cond.below) return false;
  }
  return true;
}
// Param is effective when rule is satisfied (all prerequisites met)
```

---

## Temporary Beliefs (Learned)

Empirically learned effectiveness: when we perturb a param and see no visual change, we deprioritize it for a while.

### Data Structure

```ts
interface ParamBelief {
  /** 0 = ineffective, 1 = effective. Used as multiplier when selecting params. */
  score: number;
  /** When this belief was last updated (seconds) */
  updatedAt: number;
  /** Param snapshot when belief was formed (for invalidation) */
  context?: Partial<VisualParams>;
}
```

### Lifecycle

1. **Initial state:** All params have implicit score 1.0 (no belief yet).
2. **On single-param perturb:** Store `lastSinglePerturbedParam`, `lastPerturbVisualBefore`.
3. **On next eval:** Get visual after. For the param's expected metrics (from `PARAM_TO_VISUAL_METRICS`), compute change. If change < threshold → decrement that param's score (e.g. `score *= 0.7`).
4. **Decay:** Each tick or eval, slowly recover: `score = min(1, score + 0.02)` so beliefs fade.
5. **Invalidation:** When a prerequisite param changes significantly (e.g. `fillSize` crosses 0.02), clear beliefs for dependent params (`fillOpacity`).
6. **Reset on commit/restart:** Clear all beliefs when we commit or restart a run — fresh context.

### Integration with Selection

When building `toPerturb`, multiply prioritization score by `paramEffectiveness.get(param) ?? 1`. Params with low scores are deprioritized (or filtered if below threshold, e.g. 0.3).

---

## Hybrid Approach

| Source        | Use case                          | Persistence   |
|---------------|-----------------------------------|---------------|
| Static rules  | Known dependencies (fillOpacity, strokeOpacity) | Always applied |
| Beliefs       | Learned ineffectiveness (e.g. blendOpacity in some presets) | Session-only, decays |

Flow:
1. Filter out params that fail static rules (hard filter).
2. For remaining params, multiply prioritization score by belief score.
3. Sort by combined score, take top N.

---

## Future Extensions

- **Visual-metric rules:** `fillOpacity` ineffective when `fillRatio < 0.01` (from VisualMetrics).
- **Persistence:** Store beliefs in localStorage, keyed by preset or param hash.
- **Rule discovery:** When belief score stays low for many evals, suggest adding a static rule.

---

## File Changes

| File | Changes |
|------|---------|
| `src/visual/ResponsivityOptimizer.ts` | EFFECTIVENESS_RULES, paramBeliefs map, isParamEffectiveInContext uses rules; empirical tracking on single-param perturb + eval; decay; invalidation on commit |
| `src/visual/AudioVisualCorrespondence.ts` | Export `PARAM_TO_VISUAL_METRICS` for empirical tracking |
