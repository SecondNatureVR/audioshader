/**
 * ResponsivityOptimizer — fitness-guided parameter discovery
 *
 * A "smarter jiggle" that uses Audio-Visual Correspondence fitness to
 * automatically find more responsive parameter values.
 *
 * Algorithm: Accumulating exploration with escape recovery
 * - Patient waiting: perturb every perturbInterval (0.8s), evaluate every 2s
 * - Visual params: optimize for max fitness (peak responsiveness)
 * - Audio mapping: optimize for avg fitness (stability)
 * - Producer-style: sweep/twist with adaptive width, zero-in on fitness improvement
 * - Dead-end escape: blow-up (fitness < 0.08) or plateau → revert or random preset (smooth)
 *
 * Requires: audio capture enabled + audio mappings active for meaningful fitness.
 */

import type { VisualParams, AudioMetrics, AudioMappings, ModulationSlot } from '../types';
import type { VisualMetrics, VisualMetricKey } from './VisualMetrics';
import { PARAM_TO_VISUAL_METRICS } from './AudioVisualCorrespondence';
import { getOptimizerParamRange, clampParamForOptimizer } from '../render/Parameters';

/** Param is ineffective when prerequisites are not met. See docs/SMART_JIGGLE_EFFECTIVENESS.md */
type EffectivenessCondition =
  | { param: keyof VisualParams; above: number }
  | { param: keyof VisualParams; below: number };

interface ParamEffectivenessRule {
  param: keyof VisualParams;
  requires: EffectivenessCondition[];
}

const EFFECTIVENESS_RULES: ParamEffectivenessRule[] = [
  { param: 'fillOpacity', requires: [{ param: 'fillSize', above: 0.02 }] },
  { param: 'strokeOpacity', requires: [{ param: 'strokeWeight', above: 0.002 }] },
  { param: 'strokeGlow', requires: [{ param: 'strokeWeight', above: 0.002 }] },
];

/** Params we optimize (skip rotation, hue - too subjective; skip emanationRate - timing) */
const OPTIMIZABLE_PARAMS: (keyof VisualParams)[] = [
  'spikiness', 'spikeFrequency', 'spikeSharpness', 'scale', 'fillSize', 'fillOpacity',
  'strokeWeight', 'strokeOpacity', 'strokeGlow', 'expansionFactor', 'fadeAmount',
  'blendOpacity', 'autoRotationSpeed', 'noiseAmount', 'blurAmount',
  'fishbowlShape', 'fishbowlDilation', 'radialPowerShape', 'radialPowerDilation',
  'kaleidoscopeSections', 'tunnelStrength',
];

export interface ResponsivityOptimizerOptions {
  /** Base step size as fraction of param range per frame (0.002 = 0.2%) */
  baseStepSize?: number;
  /** How often to evaluate fitness (seconds) */
  evaluationInterval?: number;
  /** Enable event boost after drop/onset (disabled by default — can cause flickering) */
  eventBoostEnabled?: boolean;
  /** Duration of event boost after drop/onset (seconds) */
  eventBoostDuration?: number;
  /** Rolling fitness window size for max/avg */
  fitnessHistorySize?: number;
  /** Duration to tune a newly added route before deciding to keep or ditch (seconds) */
  newRouteTuningDuration?: number;
  /** Min avg fitness improvement (vs before add) to keep a new route. 0 = must not drop. */
  newRouteMinFitnessImprovement?: number;
  /** Producer-style knob tuning: sweep/twist with adaptive width, zero-in on improvement */
  producerStyleTuning?: boolean;
  /** Min seconds between perturbation batches (patient waiting — let interpolation settle) */
  perturbInterval?: number;
  /** Fitness below this for 2+ evals = blow-up, trigger escape */
  blowUpThreshold?: number;
  /** Evals without improvement + max explorationWidth = dead end, trigger escape */
  deadEndEvalCount?: number;
  /** Seconds to pause perturbations after an escape */
  escapeCooldownSec?: number;
  /** Max run time before auto-commit (seconds). 0 = no limit. */
  commitMaxRunSec?: number;
  /** Trigger commit on song event (drop/onset/breakdown) */
  commitOnSongEvent?: boolean;
  /** Fitness below this for commitLowFitnessSec triggers commit */
  commitLowFitnessThreshold?: number;
  /** Boredom above this for commitHighBoredomSec triggers commit */
  commitHighBoredomThreshold?: number;
  /** Seconds below fitness threshold to trigger commit */
  commitLowFitnessSec?: number;
  /** Seconds above boredom threshold to trigger commit */
  commitHighBoredomSec?: number;
  /** Fitness improvement over baseline to commit full best (0.12 = commit all changes when +12%) */
  commitFullBestThreshold?: number;
  /** Min distance from recent commits to allow full best commit (diversity). 0 = disabled. */
  diversityCommitThreshold?: number;
  /** Params to optimize (default: OPTIMIZABLE_PARAMS) */
  params?: (keyof VisualParams)[];
  /** Min seconds between route add attempts (lower = more route exploration) */
  routeAddCooldownSec?: number;
  /** Base probability per frame to try adding a route when canTryAdd (0.008 ≈ 1 try per 2s at 60fps) */
  routeAddProbabilityBase?: number;
  /** When routes < this, boost add probability (encourage exploration when sparse) */
  routeAddFewRoutesThreshold?: number;
  /** When boredom > this, boost add probability (try new mappings when stuck) */
  routeAddBoredomThreshold?: number;
  /** Every N evals, force a route-add attempt (0 = disabled) */
  routeAddScheduleEvals?: number;
  /** Probability to try removing a route when can perturb and routes >= 2 */
  routeRemoveProbability?: number;
}

export interface ResponsivityOptimizerCallbacks {
  setParams: (params: Partial<VisualParams>, immediate?: boolean) => void;
  getParams: () => VisualParams;
  resetCorrespondence: () => void;
  evaluateFitness: () => number;
  /** Optional: when available, optimizer uses interest instead of fitness for best/commit */
  evaluateInterest?: () => number;
  /** Optional: for perturbing audio mapper slots */
  getAudioMappings?: () => AudioMappings;
  setAudioMappings?: (mappings: AudioMappings) => void;
  getActiveRoutes?: () => Array<{ param: keyof VisualParams; slotIndex: number; slot: ModulationSlot }>;
  getSlot?: (param: keyof VisualParams, slotIndex: number) => ModulationSlot | undefined;
  updateAudioSlot?: (param: keyof VisualParams, slotIndex: number, partial: Partial<ModulationSlot>) => void;
  /** Optional: for adding/removing routes. addAudioRoute returns new slot index. */
  addAudioRoute?: (param: keyof VisualParams, source: keyof AudioMetrics) => number | undefined;
  removeAudioRoute?: (param: keyof VisualParams, slotIndex: number) => void;
  getAvailableAudioSources?: () => Array<keyof AudioMetrics>;
  /** Optional: for escape — load preset by name (smooth=true for interpolation) */
  loadPresetByName?: (name: string, smooth: boolean) => boolean;
  /** Optional: preset names for random preset escape */
  getPresetNames?: () => string[];
  /** Optional: preset params for distance (diverse preset selection) */
  getPresetParams?: (name: string) => VisualParams | null;
  /** Optional: boredom 0-1 from correspondence — when high, allow more exploration */
  getBoredom?: () => number;
  /** Optional: visual metrics for smart param prioritization (bright/dark/flat) */
  getVisualMetrics?: () => VisualMetrics | null;
  /** Called when commit happens — apply committed params (becomes new baseline for next run) */
  onCommit?: (params: VisualParams, mappings: AudioMappings | null) => void;
  /** Optional: receive log entries for transparency (message, level) */
  onLog?: (message: string, level?: 'info' | 'event' | 'warn') => void;
}

export interface OptimizerLogEntry {
  message: string;
  level: 'info' | 'event' | 'warn';
  time: number;
}

export interface ResponsivityOptimizerAudioContext {
  metrics: AudioMetrics;
  /** Timestamp (sec) of last drop/onset/breakdown event */
  lastEventTime: number;
}

const DEFAULT_OPTIONS: Required<Omit<ResponsivityOptimizerOptions, 'params'>> & {
  params: (keyof VisualParams)[];
} = {
  baseStepSize: 0.002,
  evaluationInterval: 2.0,
  eventBoostEnabled: false,
  eventBoostDuration: 0.5,
  fitnessHistorySize: 15,
  newRouteTuningDuration: 8,
  newRouteMinFitnessImprovement: 0.02,
  producerStyleTuning: true,
  perturbInterval: 0.8,
  blowUpThreshold: 0.08,
  deadEndEvalCount: 15,
  escapeCooldownSec: 2.5,
  commitMaxRunSec: 20,
  commitOnSongEvent: true,
  commitLowFitnessThreshold: 0.15,
  commitHighBoredomThreshold: 0.7,
  commitLowFitnessSec: 8,
  commitHighBoredomSec: 6,
  commitFullBestThreshold: 0.12,
  diversityCommitThreshold: 0.08,
  params: OPTIMIZABLE_PARAMS,
  routeAddCooldownSec: 12,
  routeAddProbabilityBase: 0.008,
  routeAddFewRoutesThreshold: 2,
  routeAddBoredomThreshold: 0.5,
  routeAddScheduleEvals: 4,
  routeRemoveProbability: 0.06,
};

export interface OptimizerDelta {
  param: keyof VisualParams;
  baseline: number;
  current: number;
  delta: number;
  deltaPct: number;
}

export interface OptimizerSlotDelta {
  param: keyof VisualParams;
  slotIndex: number;
  source: string; // audio metric key for display
  field: 'amount' | 'curve';
  baseline: number;
  current: number;
  deltaPct: number;
}

/** Slot fields we perturb: amount (0-1), curve (0.1-5) */
const SLOT_AMOUNT_RANGE = { min: 0, max: 1 };
const SLOT_CURVE_RANGE = { min: 0.1, max: 5 };

/** Euclidean distance in normalized param space (0–1 per param). */
function paramDistance(a: VisualParams, b: VisualParams, params: (keyof VisualParams)[]): number {
  let sum = 0;
  for (const p of params) {
    const range = getOptimizerParamRange(p);
    const span = range.max - range.min;
    if (span <= 0) continue;
    const na = ((a[p] ?? range.min) - range.min) / span;
    const nb = ((b[p] ?? range.min) - range.min) / span;
    sum += (na - nb) ** 2;
  }
  return Math.sqrt(sum / Math.max(1, params.length));
}

export class ResponsivityOptimizer {
  private options: ResponsivityOptimizerOptions & { params: (keyof VisualParams)[] };
  private callbacks: ResponsivityOptimizerCallbacks;
  private running: boolean = false;
  private baselineParams: VisualParams | null = null;
  private baselineMappings: AudioMappings | null = null;
  private bestParams: VisualParams | null = null;
  private bestMappings: AudioMappings | null = null;
  private bestMaxFitness: number = -1;
  private bestAvgFitness: number = -1;
  private fitnessHistory: number[] = [];
  private lastEvaluationTime: number = 0;
  private evaluationCount: number = 0;
  /** When tuning a newly added route */
  private tuningRoute: { param: keyof VisualParams; slotIndex: number; addedAt: number } | null = null;
  private fitnessBeforeAdd: number = 0;
  private lastAddAttemptTime: number = -1e9;
  /** Evals since last route add attempt (for schedule-based add) */
  private evalsSinceLastAddAttempt: number = 0;
  /** Commit history for diversity-aware commit (last N commits) */
  private commitHistory: Array<{ params: VisualParams; mappings: AudioMappings | null; score: number; time: number }> = [];
  private static readonly COMMIT_HISTORY_SIZE = 5;
  /** Producer-style: adaptive exploration width (0.25–2), shrinks on improvement, grows when stuck */
  private explorationWidth: number = 1;
  private evalsWithoutImprovement: number = 0;
  /** Per-param sweep state: sustained direction for N frames */
  private paramSweepState: Map<string, { direction: number; framesLeft: number }> = new Map();
  /** Patient waiting: last time we perturbed (seconds) */
  private lastPerturbTime: number = -1e9;
  /** Dead-end detection: consecutive evals with fitness below blow-up threshold */
  private blowUpCount: number = 0;
  /** After escape: no perturbations until this time (seconds) */
  private escapeCooldownUntil: number = -1e9;
  /** When the run started (for max run commit) */
  private startTime: number = 0;
  /** Fitness at run start (for commit-full-best threshold) */
  private baselineFitness: number = 0;
  /** Last event time we committed for (avoid duplicate commit per event) */
  private lastCommitEventTime: number = -1e9;
  /** When we first went below fitness threshold */
  private lowFitnessSince: number = -1e9;
  /** When we first went above boredom threshold */
  private highBoredomSince: number = -1e9;

  private readonly logBuffer: OptimizerLogEntry[] = [];
  private static readonly LOG_MAX = 80;

  /** Meta: escapes since last full-best commit. When high, widen search. */
  private sessionEscapesSinceLastFullBest: number = 0;
  /** Meta: exploration boost when reverting a lot (1.0 = normal, 1.5 = wider) */
  private sessionExplorationBoost: number = 1.0;

  /** Temporary beliefs: learned effectiveness (0–1). Decay over time, reset on commit. */
  private paramBeliefs: Map<string, { score: number; updatedAt: number }> = new Map();
  /** For empirical tracking: when we perturb exactly one param */
  private lastSinglePerturbedParam: keyof VisualParams | null = null;
  private lastPerturbVisualBefore: VisualMetrics | null = null;

  constructor(
    callbacks: ResponsivityOptimizerCallbacks,
    options: ResponsivityOptimizerOptions = {}
  ) {
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  isRunning(): boolean {
    return this.running;
  }

  getTrialCount(): number {
    return this.evaluationCount;
  }

  getBestFitness(): number {
    return Math.max(this.bestMaxFitness, this.bestAvgFitness);
  }

  /** Params when Smart Jiggle started (pre-optimization baseline). */
  getBaselineParams(): VisualParams | null {
    return this.baselineParams !== null ? { ...this.baselineParams } : null;
  }

  getBaselineMappings(): AudioMappings | null {
    return this.baselineMappings !== null ? this.deepCopyMappings(this.baselineMappings) : null;
  }

  /**
   * Deltas from baseline for visual params that changed beyond threshold.
   */
  getOptimizerDeltas(thresholdPct: number = 1): OptimizerDelta[] {
    const baseline = this.baselineParams;
    const current = this.callbacks.getParams();
    if (baseline === null) return [];

    const params = this.options.params ?? OPTIMIZABLE_PARAMS;
    const deltas: OptimizerDelta[] = [];

    for (const param of params) {
      const range = getOptimizerParamRange(param);
      const b = baseline[param];
      const c = current[param];
      const span = range.max - range.min;
      const delta = c - b;
      const deltaPct = span > 0 ? (delta / span) * 100 : 0;

      if (Math.abs(deltaPct) >= thresholdPct) {
        deltas.push({ param, baseline: b, current: c, delta, deltaPct });
      }
    }

    return deltas.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  }

  /** Deltas from baseline to a given source (e.g. bestParams). */
  private getDeltasFromSource(
    source: VisualParams,
    thresholdPct: number = 1
  ): OptimizerDelta[] {
    const baseline = this.baselineParams;
    if (baseline === null) return [];

    const params = this.options.params ?? OPTIMIZABLE_PARAMS;
    const deltas: OptimizerDelta[] = [];

    for (const param of params) {
      const range = getOptimizerParamRange(param);
      const b = baseline[param];
      const c = source[param];
      const span = range.max - range.min;
      const delta = (c ?? 0) - (b ?? 0);
      const deltaPct = span > 0 ? (delta / span) * 100 : 0;

      if (Math.abs(deltaPct) >= thresholdPct) {
        deltas.push({ param, baseline: b ?? 0, current: c ?? 0, delta, deltaPct });
      }
    }

    return deltas.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  }

  /**
   * Deltas from baseline for audio slot fields (amount, curve).
   */
  getOptimizerSlotDeltas(thresholdPct: number = 2): OptimizerSlotDelta[] {
    const baseline = this.baselineMappings;
    const current = this.callbacks.getAudioMappings?.();
    if (baseline === null || current === undefined) return [];

    const deltas: OptimizerSlotDelta[] = [];
    const routes = this.callbacks.getActiveRoutes?.() ?? [];

    for (const { param, slotIndex, slot } of routes) {
      const baseMod = baseline[param];
      const baseSlot = baseMod?.slots[slotIndex];
      if (baseSlot === undefined) continue;

      for (const field of ['amount', 'curve'] as const) {
        const b = baseSlot[field];
        const c = slot[field];
        const range = field === 'amount' ? SLOT_AMOUNT_RANGE : SLOT_CURVE_RANGE;
        const span = range.max - range.min;
        const deltaPct = span > 0 ? ((c - b) / span) * 100 : 0;

        if (Math.abs(deltaPct) >= thresholdPct) {
          deltas.push({
            param,
            slotIndex,
            source: slot.source,
            field,
            baseline: b,
            current: c,
            deltaPct,
          });
        }
      }
    }

    return deltas.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  }

  /**
   * Start optimization. Runs until stop() is called.
   */
  start(): void {
    if (this.running) return;
    const params = this.callbacks.getParams();
    this.baselineParams = { ...params };
    this.bestParams = { ...params };
    this.baselineMappings = this.callbacks.getAudioMappings?.() ?? null;
    this.bestMappings = this.baselineMappings !== null ? this.deepCopyMappings(this.baselineMappings) : null;
    const f = this.getScore();
    this.fitnessHistory = [f];
    this.bestMaxFitness = f;
    this.bestAvgFitness = f;
    this.baselineFitness = f;
    this.evaluationCount = 0;
    this.lastEvaluationTime = performance.now() / 1000;
    this.tuningRoute = null;
    this.lastAddAttemptTime = -1e9;
    this.explorationWidth = 1;
    this.evalsWithoutImprovement = 0;
    this.paramSweepState.clear();
    this.lastPerturbTime = -1e9;
    this.blowUpCount = 0;
    this.escapeCooldownUntil = -1e9;
    this.startTime = performance.now() / 1000;
    this.lastCommitEventTime = -1e9;
    this.lowFitnessSince = -1e9;
    this.highBoredomSince = -1e9;
    this.running = true;
    this.logBuffer.splice(0, this.logBuffer.length);
    this.evalsSinceLastAddAttempt = 0;
    this.log('Started', 'event');
  }

  private deepCopyMappings(m: AudioMappings): AudioMappings {
    const out: AudioMappings = {};
    for (const [k, mod] of Object.entries(m)) {
      if (mod === undefined) continue;
      out[k as keyof VisualParams] = {
        enabled: mod.enabled,
        slots: mod.slots.map((s) => ({ ...s })),
      };
    }
    return out;
  }

  private log(message: string, level: 'info' | 'event' | 'warn' = 'info'): void {
    const entry: OptimizerLogEntry = { message, level, time: performance.now() / 1000 };
    this.logBuffer.push(entry);
    if (this.logBuffer.length > ResponsivityOptimizer.LOG_MAX) this.logBuffer.shift();
    this.callbacks.onLog?.(message, level);
  }

  /** Get recent log entries for UI display */
  getLogEntries(): readonly OptimizerLogEntry[] {
    return this.logBuffer;
  }

  /** Check if a rule's prerequisites are met (param is effective when satisfied). */
  private isRuleSatisfied(rule: ParamEffectivenessRule, current: VisualParams): boolean {
    for (const cond of rule.requires) {
      const val = (current[cond.param] ?? 0) as number;
      if ('above' in cond && val <= cond.above) return false;
      if ('below' in cond && val >= cond.below) return false;
    }
    return true;
  }

  /** Static rules: param ineffective when prerequisites not met. */
  private isParamEffectiveInContext(param: keyof VisualParams, current: VisualParams): boolean {
    const rule = EFFECTIVENESS_RULES.find((r) => r.param === param);
    if (rule === undefined) return true;
    return this.isRuleSatisfied(rule, current);
  }

  /** Optimization score: interest when available, else fitness. */
  private getScore(): number {
    return this.callbacks.evaluateInterest?.() ?? this.callbacks.evaluateFitness();
  }

  /** Belief score 0–1 for prioritization. Default 1 when no belief. */
  private getParamBeliefScore(param: keyof VisualParams): number {
    return this.paramBeliefs.get(param as string)?.score ?? 1;
  }

  /** Clear beliefs (on commit/restart). Invalidate dependent params when prerequisite changes. */
  private clearParamBeliefs(): void {
    this.paramBeliefs.clear();
    this.lastSinglePerturbedParam = null;
    this.lastPerturbVisualBefore = null;
  }

  /**
   * Order params by relevance to current visual state and audio regime.
   * Too bright/dark → prioritize scale, strokeWeight, fillSize, fillOpacity.
   * Too flat → prioritize strokeWeight, spikiness, edgeDensity-related.
   * When boredom high → prioritize change-inducing params.
   * Rhythmic regime (beatConfidence high) → prioritize beat-reactive params.
   * Ambient regime (emptiness high, rms low) → prioritize smooth params.
   */
  private prioritizeParamsForVisual(
    params: (keyof VisualParams)[],
    visual: VisualMetrics | null,
    audioContext?: ResponsivityOptimizerAudioContext
  ): (keyof VisualParams)[] {
    const boredom = this.callbacks.getBoredom?.() ?? 0;
    const changeParams: (keyof VisualParams)[] = [
      'expansionFactor', 'fadeAmount', 'autoRotationSpeed', 'jiggleAmount',
      'spikeFrequency', 'hueShiftAmount', 'spikiness', 'noiseAmount',
    ];
    const rhythmicParams: (keyof VisualParams)[] = [
      'expansionFactor', 'scale', 'fadeAmount', 'fillSize', 'strokeWeight',
    ];
    const ambientParams: (keyof VisualParams)[] = [
      'blendOpacity', 'fadeAmount', 'fillOpacity', 'strokeOpacity',
    ];
    const regime = audioContext !== undefined ? this.computeAudioRegime(audioContext.metrics) : null;

    if (visual === null) {
      return [...params].sort(() => Math.random() - 0.5);
    }

    const { luminanceVariance, fillRatio, edgeDensity, saturationMean } = visual;
    const scores = new Map<keyof VisualParams, number>();

    for (const p of params) {
      let score = 0.5;
      if (regime === 'rhythmic' && rhythmicParams.includes(p)) {
        score = 0.88;
      } else if (regime === 'ambient' && ambientParams.includes(p)) {
        score = 0.85;
      } else if (boredom > 0.6 && changeParams.includes(p)) {
        score = 0.85;
      } else if (luminanceVariance > 0.5 && fillRatio > 0.65) {
        if (['scale', 'strokeWeight', 'fillSize', 'fillOpacity', 'expansionFactor'].includes(p)) score = 0.9;
        if (['blendOpacity'].includes(p)) score = 0.75;
      } else if (luminanceVariance < 0.2 && fillRatio < 0.35) {
        if (['scale', 'strokeWeight', 'fillSize', 'fillOpacity', 'expansionFactor'].includes(p)) score = 0.9;
        if (['blendOpacity'].includes(p)) score = 0.75;
      } else if (luminanceVariance < 0.15 && edgeDensity < 0.2) {
        if (['strokeWeight', 'spikiness', 'strokeOpacity', 'strokeGlow', 'noiseAmount'].includes(p)) score = 0.85;
      } else if (fillRatio > 0.85) {
        if (['scale', 'expansionFactor', 'fillSize'].includes(p)) score = 0.85;
      } else if (saturationMean < 0.2) {
        if (['fillOpacity', 'blendOpacity', 'strokeOpacity'].includes(p)) score = 0.8;
      }
      const belief = this.getParamBeliefScore(p);
      scores.set(p, (score + Math.random() * 0.2) * belief);
    }

    return [...params].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
  }

  /**
   * Stop optimization. Commit at least 1 change (gradual drift) and apply.
   */
  stop(): void {
    if (!this.running) return;
    this.performCommit();
    this.running = false;
    this.log('Stopped', 'event');
  }

  /**
   * Restart a new run with current params as baseline (after commit).
   * Keeps Smart Jiggle running; only stop() turns it off.
   */
  private restartRun(nowSec: number): void {
    const params = this.callbacks.getParams();
    this.baselineParams = { ...params };
    this.bestParams = { ...params };
    this.baselineMappings = this.callbacks.getAudioMappings?.() ?? null;
    this.bestMappings = this.baselineMappings !== null ? this.deepCopyMappings(this.baselineMappings) : null;
    const f = this.getScore();
    this.fitnessHistory = [f];
    this.bestMaxFitness = f;
    this.bestAvgFitness = f;
    this.baselineFitness = f;
    this.evaluationCount = 0;
    this.lastEvaluationTime = nowSec;
    this.tuningRoute = null;
    this.lastAddAttemptTime = -1e9;
    this.explorationWidth = this.sessionExplorationBoost;
    this.evalsWithoutImprovement = 0;
    this.paramSweepState.clear();
    this.lastPerturbTime = -1e9;
    this.blowUpCount = 0;
    this.escapeCooldownUntil = -1e9;
    this.startTime = nowSec;
    this.lowFitnessSince = -1e9;
    this.highBoredomSince = -1e9;
    this.clearParamBeliefs();
    this.evalsSinceLastAddAttempt = 0;
    this.log('restart run (new baseline)', 'event');
  }

  /**
   * Commit: when fitness improved significantly, commit full best.
   * Otherwise preserve at least 1 change from baseline for gradual drift.
   * Uses bestParams (not current) so we commit the best we found, not a later perturbation.
   */
  private performCommit(): void {
    const baseline = this.baselineParams;
    const best = this.bestParams;
    if (baseline === null || best === null) return;

    const params = this.options.params ?? OPTIMIZABLE_PARAMS;
    const improvement = this.bestMaxFitness - this.baselineFitness;
    const improveThreshold = this.options.commitFullBestThreshold ?? 0.10;
    const diversityThreshold = this.options.diversityCommitThreshold ?? 0;

    let minDistance = 1;
    if (diversityThreshold > 0 && this.commitHistory.length > 0) {
      for (const rec of this.commitHistory) {
        const d = paramDistance(best, rec.params, params);
        minDistance = Math.min(minDistance, d);
      }
    }
    const isDiverse = minDistance >= diversityThreshold;

    const significantImprovement = improvement >= improveThreshold;
    const shouldCommitFullBest = significantImprovement || (diversityThreshold > 0 && isDiverse);

    let committedParams: VisualParams;

    if (shouldCommitFullBest) {
      committedParams = { ...best };
      this.sessionEscapesSinceLastFullBest = 0;
      this.sessionExplorationBoost = 1.0;
      const reason = significantImprovement ? `F +${improvement.toFixed(2)}` : `diverse (d=${minDistance.toFixed(2)})`;
      this.log(`commit full best (${reason})`, 'event');
    } else {
      const deltas = this.getDeltasFromSource(best, 1);
      committedParams = { ...baseline };

      if (deltas.length > 0) {
        const minPreserve = 1;
        const toPreserve = Math.max(minPreserve, Math.min(deltas.length, 3));
        for (let i = 0; i < toPreserve; i++) {
          const d = deltas[i];
          if (d !== undefined) committedParams[d.param] = d.current;
        }
      } else {
        for (const param of params) {
          if (Math.abs((best[param] ?? 0) - (baseline[param] ?? 0)) > 1e-6) {
            committedParams[param] = best[param] ?? baseline[param];
            break;
          }
        }
      }
    }

    if (this.callbacks.onCommit !== undefined) {
      this.callbacks.onCommit(committedParams, this.bestMappings);
    } else {
      this.callbacks.setParams(committedParams, false);
      if (this.bestMappings !== null && this.callbacks.setAudioMappings !== undefined) {
        this.callbacks.setAudioMappings(this.bestMappings);
      }
    }

    this.commitHistory.push({
      params: { ...committedParams },
      mappings: this.bestMappings !== null ? this.deepCopyMappings(this.bestMappings) : null,
      score: this.bestMaxFitness,
      time: performance.now() / 1000,
    });
    if (this.commitHistory.length > ResponsivityOptimizer.COMMIT_HISTORY_SIZE) {
      this.commitHistory.shift();
    }
  }

  /**
   * Pick a preset for escape: prefer diverse (distant from current) when getPresetParams available.
   * Otherwise random.
   */
  private pickDiversePreset(current: VisualParams, names: string[]): string {
    const getParams = this.callbacks.getPresetParams;
    const optParams = this.options.params ?? OPTIMIZABLE_PARAMS;
    if (getParams === undefined || names.length === 0) {
      return names[Math.floor(Math.random() * names.length)]!;
    }
    const withDistance = names
      .map((name) => {
        const presetParams = getParams(name);
        if (presetParams === null) return { name, distance: 0 };
        return { name, distance: paramDistance(current, presetParams, optParams) };
      })
      .filter((x) => x.distance > 0)
      .sort((a, b) => b.distance - a.distance);
    const topK = Math.min(3, withDistance.length);
    if (topK === 0) return names[Math.floor(Math.random() * names.length)]!;
    const pickFrom = withDistance.slice(0, topK);
    return pickFrom[Math.floor(Math.random() * pickFrom.length)]!.name;
  }

  /**
   * Compute chaos factor (0–1) from audio metrics. Higher = more dynamic/chaotic.
   */
  private computeChaos(metrics: AudioMetrics): number {
    const rmsRate = Math.max(0, Math.min(1, metrics.rmsRate ?? 0));
    const bassRate = Math.max(0, Math.min(1, metrics.bassRate ?? 0));
    return (rmsRate + bassRate) / 2;
  }

  /**
   * Audio regime from structure signals. Affects param prioritization.
   */
  private computeAudioRegime(metrics: AudioMetrics): 'rhythmic' | 'ambient' | null {
    const beatConf = metrics.beatConfidence ?? 0;
    const emptiness = metrics.emptiness ?? 0;
    const rms = metrics.rms ?? 0;
    if (beatConf > 0.5) return 'rhythmic';
    if (emptiness > 0.6 && rms < 0.3) return 'ambient';
    return null;
  }

  /**
   * Compute event boost (0–1). Non-zero for a short window after drop/onset/breakdown.
   */
  private computeEventBoost(nowSec: number, lastEventTime: number): number {
    const duration = this.options.eventBoostDuration ?? 0.5;
    const elapsed = nowSec - lastEventTime;
    if (elapsed < 0 || elapsed > duration) return 0;
    return 1 - elapsed / duration;
  }

  /**
   * Call each frame from the app tick. Drives accumulating exploration.
   */
  tick(nowSec: number, audioContext?: ResponsivityOptimizerAudioContext): void {
    if (!this.running) return;

    const params = this.options.params ?? OPTIMIZABLE_PARAMS;
    const baseStep = this.options.baseStepSize ?? 0.002;
    const evalInterval = this.options.evaluationInterval ?? 2.0;
    const historySize = this.options.fitnessHistorySize ?? 15;
    const perturbInterval = this.options.perturbInterval ?? 0.8;
    const blowUpThreshold = this.options.blowUpThreshold ?? 0.08;
    const deadEndEvalCount = this.options.deadEndEvalCount ?? 15;
    const escapeCooldownSec = this.options.escapeCooldownSec ?? 2.5;

    const inEscapeCooldown = nowSec < this.escapeCooldownUntil;
    const boredom = this.callbacks.getBoredom?.() ?? 0;
    const boredBoost = boredom > 0.5 ? (1 - boredom * 0.4) : 1;
    const effectivePerturbInterval = perturbInterval * boredBoost;
    const canPerturb = !inEscapeCooldown && (nowSec - this.lastPerturbTime) >= effectivePerturbInterval;

    let chaos = 0.3;
    let eventBoost = 0;
    if (audioContext !== undefined) {
      chaos = this.computeChaos(audioContext.metrics);
      if (this.options.eventBoostEnabled) {
        eventBoost = this.computeEventBoost(nowSec, audioContext.lastEventTime);
      }
    }

    const stepScale = (0.5 + chaos) * (1 + eventBoost);
    const stepSize = baseStep * stepScale;

    const perturbCount = Math.min(
      params.length + 10,
      Math.max(1, 1 + Math.floor(chaos * 2) + (eventBoost > 0 ? 1 : 0))
    );

    const routes = this.callbacks.getActiveRoutes?.() ?? [];
    const hasAudioSlots = routes.length > 0 && this.callbacks.updateAudioSlot !== undefined;
    const tuning = this.tuningRoute !== null;
    const tuningDuration = this.options.newRouteTuningDuration ?? 8;
    const minImprovement = this.options.newRouteMinFitnessImprovement ?? 0.02;

    const doVisual = params.length > 0;
    const doAudio = hasAudioSlots;

    // Route exploration: add/remove as first-class search actions
    const addCooldownSec = this.options.routeAddCooldownSec ?? 12;
    const addProbBase = this.options.routeAddProbabilityBase ?? 0.008;
    const fewRoutesThreshold = this.options.routeAddFewRoutesThreshold ?? 2;
    const boredomThreshold = this.options.routeAddBoredomThreshold ?? 0.5;
    const scheduleEvals = this.options.routeAddScheduleEvals ?? 4;
    const removeProb = this.options.routeRemoveProbability ?? 0.06;

    const effectiveCooldown = routes.length === 0 ? 2 : addCooldownSec;
    const canTryAdd = canPerturb && !tuning &&
      this.callbacks.addAudioRoute !== undefined &&
      this.callbacks.getAvailableAudioSources !== undefined &&
      (nowSec - this.lastAddAttemptTime) >= effectiveCooldown;

    let addProb = addProbBase;
    if (routes.length < fewRoutesThreshold) addProb *= 4;
    if (boredom > boredomThreshold) addProb *= 2;
    const scheduleTrigger = scheduleEvals > 0 && this.evalsSinceLastAddAttempt >= scheduleEvals;
    const mustAdd = routes.length === 0 && this.callbacks.getAvailableAudioSources !== undefined;
    const tryAddRoute = canTryAdd && (mustAdd || scheduleTrigger || Math.random() < addProb);

    const roll = Math.random();
    const perturbVisual = canPerturb && doVisual && (!tuning || roll < 0.1);
    const perturbAudio = canPerturb && doAudio;
    const tryRemoveRoute = canPerturb && !tuning && this.callbacks.removeAudioRoute !== undefined &&
      routes.length >= 2 && Math.random() < removeProb;

    const boredomBoost = boredom > 0.5 ? 1 + (boredom - 0.5) : 1;
    const visualUpdates: Partial<VisualParams> = {};

    if (perturbVisual) {
      const visual = this.callbacks.getVisualMetrics?.() ?? null;
      const current = this.callbacks.getParams();
      const ordered = this.prioritizeParamsForVisual(params, visual, audioContext);
      const effective = ordered.filter((p) => this.isParamEffectiveInContext(p, current));
      const toPerturb = effective.slice(0, Math.min(perturbCount, params.length));
      const producerStyle = this.options.producerStyleTuning ?? true;
      const width = (producerStyle ? this.explorationWidth : 1) * boredomBoost;

      for (const param of toPerturb) {
        const range = getOptimizerParamRange(param);
        const currentVal = current[param];
        const span = range.max - range.min;
        const step = span * stepSize * width;

        let delta: number;
        const sweepKey = param as string;
        const sweep = this.paramSweepState.get(sweepKey);

        if (sweep !== undefined && sweep.framesLeft > 0) {
          delta = sweep.direction * step;
          sweep.framesLeft -= 1;
          if (sweep.framesLeft <= 0) this.paramSweepState.delete(sweepKey);
        } else if (producerStyle && Math.random() < 0.3) {
          const direction = Math.random() < 0.5 ? -1 : 1;
          const frames = 5 + Math.floor(Math.random() * 15);
          this.paramSweepState.set(sweepKey, { direction, framesLeft: frames });
          delta = direction * step;
        } else {
          delta = (Math.random() - 0.5) * 2 * step;
        }

        const newVal = clampParamForOptimizer(param, currentVal + delta);
        visualUpdates[param] = newVal;
      }
    }

    if (Object.keys(visualUpdates).length > 0) {
      const keys = Object.keys(visualUpdates) as (keyof VisualParams)[];
      if (keys.length === 1) {
        this.lastSinglePerturbedParam = keys[0]!;
        this.lastPerturbVisualBefore = this.callbacks.getVisualMetrics?.() ?? null;
      } else {
        this.lastSinglePerturbedParam = null;
        this.lastPerturbVisualBefore = null;
      }
      const parts = Object.entries(visualUpdates).map(([p, v]) => {
        const cur = this.callbacks.getParams()[p as keyof VisualParams];
        const d = cur !== undefined ? ((v as number) - cur) : 0;
        const sign = d >= 0 ? '+' : '';
        const range = getOptimizerParamRange(p as keyof VisualParams);
        const pct = range.max - range.min > 0 ? (d / (range.max - range.min)) * 100 : 0;
        return `${p} ${sign}${pct.toFixed(1)}%`;
      });
      this.callbacks.setParams(visualUpdates, false);
      this.lastPerturbTime = nowSec;
      this.log(`perturb ${parts.join(', ')}`, 'info');
    }

    if (perturbAudio) {
      const tuningRoute = this.tuningRoute;
      const slot = tuningRoute !== null && this.callbacks.getSlot !== undefined
        ? this.callbacks.getSlot(tuningRoute.param, tuningRoute.slotIndex)
        : undefined;
      const focusOnTuning = tuningRoute !== null && slot !== undefined;

      const producerWidth = ((this.options.producerStyleTuning ?? true) ? this.explorationWidth : 1) * boredomBoost;
      if (focusOnTuning && tuningRoute !== null && slot !== undefined) {
        const { param, slotIndex } = tuningRoute;
        const field = Math.random() < 0.5 ? 'amount' : 'curve';
        const range = field === 'amount' ? SLOT_AMOUNT_RANGE : SLOT_CURVE_RANGE;
        const span = range.max - range.min;
        const step = span * stepSize * 4 * producerWidth;
        const currentVal = field === 'amount' ? slot.amount : slot.curve;
        const delta = (Math.random() - 0.5) * 2 * step;
        const newVal = Math.max(range.min, Math.min(range.max, currentVal + delta));
        this.callbacks.updateAudioSlot!(param, slotIndex, field === 'amount' ? { amount: newVal } : { curve: newVal });
        this.log(`tune ${slot.source}→${param} ${field} ${newVal.toFixed(2)}`, 'info');
      } else {
        const slotCount = Math.min(routes.length, Math.max(1, 1 + Math.floor(chaos)));
        const shuffled = [...routes].sort(() => Math.random() - 0.5);
        for (let i = 0; i < slotCount; i++) {
          const { param, slotIndex, slot } = shuffled[i]!;
          const field = Math.random() < 0.5 ? 'amount' : 'curve';
          const range = field === 'amount' ? SLOT_AMOUNT_RANGE : SLOT_CURVE_RANGE;
          const span = range.max - range.min;
          const step = span * stepSize * 3 * producerWidth;
          const currentVal = field === 'amount' ? slot.amount : slot.curve;
          const delta = (Math.random() - 0.5) * 2 * step;
          const newVal = Math.max(range.min, Math.min(range.max, currentVal + delta));
          this.callbacks.updateAudioSlot!(param, slotIndex, field === 'amount' ? { amount: newVal } : { curve: newVal });
        }
        const first = shuffled[0];
        if (first !== undefined) {
          this.log(`tune ${first.slot.source}→${first.param}`, 'info');
        }
      }
      this.lastPerturbTime = nowSec;
    }

    if (tryAddRoute) {
      this.lastAddAttemptTime = nowSec;
      this.evalsSinceLastAddAttempt = 0;
      const optParams = this.options.params ?? OPTIMIZABLE_PARAMS;
      const sources = this.callbacks.getAvailableAudioSources!();
      const existing = new Set(routes.map((r) => `${r.param}_${r.slot.source}`));
      const candidates: Array<{ param: keyof VisualParams; source: keyof AudioMetrics }> = [];
      for (const param of optParams) {
        for (const source of sources) {
          if (!existing.has(`${param}_${source}`)) {
            candidates.push({ param, source });
          }
        }
      }
      let filtered = candidates;
      const beatConf = audioContext?.metrics.beatConfidence ?? 0;
      if (beatConf > 0.5 && candidates.length > 0) {
        const beatOnsetCandidates = candidates.filter((c) => c.source === 'beatOnset');
        if (beatOnsetCandidates.length > 0 && Math.random() < 0.5) {
          filtered = beatOnsetCandidates;
        }
      }
      if (filtered.length > 0) {
        const { param, source } = filtered[Math.floor(Math.random() * filtered.length)]!;
        const slotIndex = this.callbacks.addAudioRoute!(param, source);
        if (slotIndex !== undefined) {
          this.fitnessBeforeAdd = this.fitnessHistory.length > 0
            ? this.fitnessHistory.reduce((a, b) => a + b, 0) / this.fitnessHistory.length
            : this.callbacks.evaluateFitness();
          this.tuningRoute = { param, slotIndex, addedAt: nowSec };
          this.callbacks.resetCorrespondence();
          this.lastPerturbTime = nowSec;
          this.log(`add route ${source}→${param}`, 'event');
        }
      }
    }

    if (tryRemoveRoute) {
      const idx = Math.floor(Math.random() * routes.length);
      const { param, slotIndex, slot } = routes[idx]!;
      this.callbacks.removeAudioRoute!(param, slotIndex);
      this.lastPerturbTime = nowSec;
      this.log(`remove route ${slot.source}→${param}`, 'event');
    }

    // Periodic fitness evaluation — no revert, just accumulate
    const elapsed = nowSec - this.lastEvaluationTime;
    if (elapsed >= evalInterval) {
      const fitness = this.getScore();
      this.evaluationCount += 1;
      this.evalsSinceLastAddAttempt += 1;
      this.lastEvaluationTime = nowSec;

      this.fitnessHistory.push(fitness);
      if (this.fitnessHistory.length > historySize) this.fitnessHistory.shift();

      const maxF = Math.max(...this.fitnessHistory);
      const avgF = this.fitnessHistory.reduce((a, b) => a + b, 0) / this.fitnessHistory.length;
      this.log(`eval F=${fitness.toFixed(2)} avg=${avgF.toFixed(2)} best=${this.bestMaxFitness.toFixed(2)}`, 'info');

      // Empirical effectiveness: did single-param perturb change expected visual metrics?
      const singleParam = this.lastSinglePerturbedParam;
      const visualBefore = this.lastPerturbVisualBefore;
      const visualAfter = this.callbacks.getVisualMetrics?.() ?? null;
      if (singleParam !== null && visualBefore !== null && visualAfter !== null) {
        const metricKeys = PARAM_TO_VISUAL_METRICS[singleParam] as VisualMetricKey[] | undefined;
        if (metricKeys !== undefined && metricKeys.length > 0) {
          let change = 0;
          for (const k of metricKeys) {
            const vb = (visualBefore[k] as number) ?? 0;
            const va = (visualAfter[k] as number) ?? 0;
            change += Math.abs(va - vb);
          }
          change /= metricKeys.length;
          const ineffectiveThreshold = 0.03;
          if (change < ineffectiveThreshold) {
            const key = singleParam as string;
            const prev = this.paramBeliefs.get(key);
            const newScore = Math.max(0.2, (prev?.score ?? 1) * 0.7);
            this.paramBeliefs.set(key, { score: newScore, updatedAt: nowSec });
            this.log(`belief ${singleParam} ineffective (Δ=${change.toFixed(3)})`, 'info');
          }
        }
        this.lastSinglePerturbedParam = null;
        this.lastPerturbVisualBefore = null;
      }
      // Decay beliefs toward 1 (recovery over time)
      for (const [key, b] of this.paramBeliefs) {
        const recovered = Math.min(1, b.score + 0.02);
        this.paramBeliefs.set(key, { score: recovered, updatedAt: nowSec });
      }

      // Dead-end detection
      if (fitness < blowUpThreshold) {
        this.blowUpCount += 1;
      } else {
        this.blowUpCount = 0;
      }
      // Escape: blow-up (2+ evals below threshold) or dead-end (no improvement, max width)
      const blowUp = this.blowUpCount >= 2;
      const deadEnd = this.evalsWithoutImprovement >= deadEndEvalCount &&
        this.explorationWidth >= 1.9 &&
        avgF < (this.bestAvgFitness * 0.9 || 0.15);
      const shouldEscape = (blowUp || deadEnd) && this.bestParams !== null;

      if (shouldEscape) {
        this.sessionEscapesSinceLastFullBest += 1;
        if (this.sessionEscapesSinceLastFullBest >= 2) {
          this.sessionExplorationBoost = Math.min(1.5, this.sessionExplorationBoost + 0.15);
          this.log(`meta: widen search (boost=${this.sessionExplorationBoost.toFixed(1)})`, 'info');
        }
        const best = this.bestParams!;
        const roll = Math.random();
        if (roll < 0.7) {
          this.callbacks.setParams(best, false);
          if (this.bestMappings !== null && this.callbacks.setAudioMappings !== undefined) {
            this.callbacks.setAudioMappings(this.bestMappings);
          }
          this.log(`escape: revert to best (F=${this.bestMaxFitness.toFixed(2)})`, 'warn');
        } else if (roll < 0.95 && this.callbacks.loadPresetByName !== undefined && this.callbacks.getPresetNames !== undefined) {
          const names = this.callbacks.getPresetNames();
          if (names.length > 0) {
            const name = this.pickDiversePreset(best, names);
            if (this.callbacks.loadPresetByName(name, true)) {
              this.bestParams = { ...this.callbacks.getParams() };
              const m = this.callbacks.getAudioMappings?.();
              this.bestMappings = m !== undefined ? this.deepCopyMappings(m) : null;
              this.bestMaxFitness = this.callbacks.evaluateFitness();
              this.bestAvgFitness = this.bestMaxFitness;
              this.log(`escape: load preset "${name}"`, 'warn');
            } else {
              this.callbacks.setParams(best, false);
            }
          } else {
            this.callbacks.setParams(best, false);
          }
        } else {
          this.callbacks.setParams(best, false);
        }
        this.escapeCooldownUntil = nowSec + escapeCooldownSec;
        this.blowUpCount = 0;
        this.evalsWithoutImprovement = 0;
        this.explorationWidth = 1;
        this.paramSweepState.clear();
        this.fitnessHistory = [this.getScore()];
        this.clearParamBeliefs();
        this.callbacks.resetCorrespondence();
      }

      // End tuning phase: keep or ditch the new route
      const tr = this.tuningRoute;
      if (tr !== null && (nowSec - tr.addedAt) >= tuningDuration) {
        const route = routes.find((r) => r.param === tr.param && r.slotIndex === tr.slotIndex);
        const src = route?.slot.source ?? '?';
        if (avgF < this.fitnessBeforeAdd + minImprovement && this.callbacks.removeAudioRoute !== undefined) {
          this.callbacks.removeAudioRoute(tr.param, tr.slotIndex);
          this.log(`tuning: ditch ${src}→${tr.param} (avg F ${avgF.toFixed(2)} < ${(this.fitnessBeforeAdd + minImprovement).toFixed(2)})`, 'info');
        } else {
          this.log(`tuning: keep ${src}→${tr.param}`, 'event');
        }
        this.tuningRoute = null;
      }

      // Visual params: optimize for max (peak responsiveness)
      if (maxF > this.bestMaxFitness) {
        this.bestMaxFitness = maxF;
        this.bestParams = { ...this.callbacks.getParams() };
        this.log(`new best F=${maxF.toFixed(2)}`, 'event');
        if (this.options.producerStyleTuning) {
          this.evalsWithoutImprovement = 0;
          this.explorationWidth = Math.max(0.25, this.explorationWidth * 0.85);
        }
      } else if (this.options.producerStyleTuning) {
        this.evalsWithoutImprovement += 1;
        if (this.evalsWithoutImprovement >= 3) {
          const maxWidth = 2 * this.sessionExplorationBoost;
          this.explorationWidth = Math.min(maxWidth, this.explorationWidth * 1.15);
        }
      }

      // Audio mapping: optimize for avg (stability)
      if (avgF > this.bestAvgFitness) {
        this.bestAvgFitness = avgF;
        const mappings = this.callbacks.getAudioMappings?.();
        this.bestMappings = mappings !== undefined ? this.deepCopyMappings(mappings) : null;
      }

      // Commit event checks
      const maxRun = this.options.commitMaxRunSec ?? 20;
      const runTime = nowSec - this.startTime;
      const fitnessThresh = this.options.commitLowFitnessThreshold ?? 0.15;
      const boredomThresh = this.options.commitHighBoredomThreshold ?? 0.7;
      const fitnessSec = this.options.commitLowFitnessSec ?? 8;
      const boredomSec = this.options.commitHighBoredomSec ?? 6;

      if (avgF < fitnessThresh) {
        if (this.lowFitnessSince < 0) this.lowFitnessSince = nowSec;
      } else {
        this.lowFitnessSince = -1e9;
      }
      if (boredom > boredomThresh) {
        if (this.highBoredomSince < 0) this.highBoredomSince = nowSec;
      } else {
        this.highBoredomSince = -1e9;
      }

      const songEvent = this.options.commitOnSongEvent && audioContext !== undefined &&
        (nowSec - audioContext.lastEventTime) < 0.5 &&
        audioContext.lastEventTime !== this.lastCommitEventTime;
      const maxRunHit = maxRun > 0 && runTime >= maxRun;
      const lowFitnessHit = fitnessSec > 0 && this.lowFitnessSince >= 0 && (nowSec - this.lowFitnessSince) >= fitnessSec;
      const highBoredomHit = boredomSec > 0 && this.highBoredomSince >= 0 && (nowSec - this.highBoredomSince) >= boredomSec;

      if (songEvent || maxRunHit || lowFitnessHit || highBoredomHit) {
        if (songEvent) this.lastCommitEventTime = audioContext!.lastEventTime;
        this.performCommit();
        this.restartRun(nowSec);
      }
    }
  }
}
