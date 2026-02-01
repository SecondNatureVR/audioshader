/**
 * Parameter interpolation system for smooth transitions
 * Supports both time-based easing and spring physics
 */

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

interface StandardInterpolationState {
  current: number;
  target: number;
  startValue: number;
  startTime: number;
  duration: number;
  easing: EasingType;
}

interface SpringInterpolationState {
  current: number;
  target: number;
  velocity: number;
  spring: number;
  damping: number;
}

export class ParameterInterpolator {
  private params: Map<string, StandardInterpolationState> = new Map();
  private springParams: Map<string, SpringInterpolationState> = new Map();
  private _enabled: boolean = true;
  private _defaultDuration: number = 0.5; // seconds
  private _defaultEasing: EasingType = 'easeInOut';
  private _springConstant: number = 0.1;
  private _springDamping: number = 0.8;
  private _useSpringForRotation: boolean = true;

  get enabled(): boolean {
    return this._enabled;
  }

  get defaultDuration(): number {
    return this._defaultDuration;
  }

  set defaultDuration(value: number) {
    this._defaultDuration = value;
  }

  get defaultEasing(): EasingType {
    return this._defaultEasing;
  }

  set defaultEasing(value: EasingType) {
    this._defaultEasing = value;
  }

  get springConstant(): number {
    return this._springConstant;
  }

  set springConstant(value: number) {
    this._springConstant = value;
  }

  get springDamping(): number {
    return this._springDamping;
  }

  set springDamping(value: number) {
    this._springDamping = value;
  }

  get useSpringForRotation(): boolean {
    return this._useSpringForRotation;
  }

  set useSpringForRotation(value: boolean) {
    this._useSpringForRotation = value;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      // Snap all params to targets
      this.params.forEach((state) => {
        state.current = state.target;
      });
      this.springParams.forEach((state) => {
        state.current = state.target;
        state.velocity = 0;
      });
    }
  }

  setDefaultDuration(duration: number): void {
    this._defaultDuration = duration;
  }

  setDefaultEasing(easing: EasingType): void {
    this._defaultEasing = easing;
  }

  setSpringSettings(constant: number, damping: number): void {
    this._springConstant = constant;
    this._springDamping = damping;
  }

  setTarget(
    paramName: string,
    targetValue: number,
    duration: number | null = null,
    easing: EasingType | null = null,
    useSpring: boolean = false
  ): void {
    if (!this._enabled) {
      // If disabled, set current directly
      if (useSpring || (this._useSpringForRotation && paramName === 'rotation')) {
        const existing = this.springParams.get(paramName);
        const state: SpringInterpolationState = existing ?? {
          current: targetValue,
          velocity: 0,
          spring: this._springConstant,
          damping: this._springDamping,
          target: targetValue,
        };
        state.target = targetValue;
        state.spring = this._springConstant;
        state.damping = this._springDamping;
        this.springParams.set(paramName, state);
      } else {
        const existing = this.params.get(paramName);
        const state: StandardInterpolationState = existing ?? {
          current: targetValue,
          target: targetValue,
          startValue: targetValue,
          startTime: Date.now(),
          duration: 0,
          easing: this._defaultEasing,
        };
        state.current = targetValue;
        state.target = targetValue;
        this.params.set(paramName, state);
      }
      return;
    }

    const currentValue = this.getCurrent(paramName) ?? targetValue;
    const finalDuration = duration ?? this._defaultDuration;
    const finalEasing = easing ?? this._defaultEasing;

    if (useSpring || (this._useSpringForRotation && paramName === 'rotation')) {
      const existing = this.springParams.get(paramName);
      const state: SpringInterpolationState = existing ?? {
        current: currentValue,
        velocity: 0,
        spring: this._springConstant,
        damping: this._springDamping,
        target: targetValue,
      };
      state.target = targetValue;
      state.spring = this._springConstant;
      state.damping = this._springDamping;
      this.springParams.set(paramName, state);
    } else {
      this.params.set(paramName, {
        current: currentValue,
        target: targetValue,
        startValue: currentValue,
        startTime: Date.now(),
        duration: finalDuration * 1000, // Convert to ms
        easing: finalEasing,
      });
    }
  }

  update(): void {
    if (!this._enabled) return;

    const now = Date.now();
    const deltaTime = 1 / 60; // Assume 60fps

    // Update standard interpolations
    this.params.forEach((state) => {
      const elapsed = now - state.startTime;
      const progress = Math.min(elapsed / state.duration, 1);

      if (progress >= 1) {
        state.current = state.target;
      } else {
        const t = this.applyEasing(progress, state.easing);
        state.current = this.lerp(state.startValue, state.target, t);
      }
    });

    // Update spring-based interpolations
    this.springParams.forEach((state) => {
      const distance = state.target - state.current;
      const force = distance * state.spring;
      state.velocity = (state.velocity + force) * state.damping;
      state.current += state.velocity * deltaTime;

      // Stop if very close and velocity is small
      if (Math.abs(distance) < 0.001 && Math.abs(state.velocity) < 0.001) {
        state.current = state.target;
        state.velocity = 0;
      }
    });
  }

  getCurrent(paramName: string): number | null {
    const springState = this.springParams.get(paramName);
    if (springState !== undefined) {
      return springState.current;
    }
    const state = this.params.get(paramName);
    if (state !== undefined) {
      return state.current;
    }
    return null;
  }

  getTarget(paramName: string): number | null {
    const springState = this.springParams.get(paramName);
    if (springState !== undefined) {
      return springState.target;
    }
    const state = this.params.get(paramName);
    if (state !== undefined) {
      return state.target;
    }
    return null;
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  private applyEasing(t: number, easing: EasingType): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'easeIn':
        return t * t;
      case 'easeOut':
        return 1 - (1 - t) * (1 - t);
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
  }

  /**
   * Handle rotation wrapping (359° -> 1° should go forward, not backward)
   */
  setTargetRotation(paramName: string, targetValue: number): void {
    const current = this.getCurrent(paramName) ?? targetValue;

    // Normalize angles to 0-360
    const currentNorm = ((current % 360) + 360) % 360;
    const targetNorm = ((targetValue % 360) + 360) % 360;

    // Find shortest path
    let diff = targetNorm - currentNorm;
    if (Math.abs(diff) > 180) {
      diff = diff > 0 ? diff - 360 : diff + 360;
    }

    this.setTarget(paramName, currentNorm + diff, null, null, this._useSpringForRotation);
  }

  /**
   * Snap a parameter instantly to a value (no interpolation)
   */
  snapTo(paramName: string, value: number): void {
    const springState = this.springParams.get(paramName);
    if (springState !== undefined) {
      springState.current = value;
      springState.target = value;
      springState.velocity = 0;
      return;
    }

    const state = this.params.get(paramName);
    if (state !== undefined) {
      state.current = value;
      state.target = value;
      state.startValue = value;
    } else {
      this.params.set(paramName, {
        current: value,
        target: value,
        startValue: value,
        startTime: Date.now(),
        duration: 0,
        easing: this._defaultEasing,
      });
    }
  }

  /**
   * Check if interpolation is in progress for a parameter
   */
  isInterpolating(paramName: string): boolean {
    const springState = this.springParams.get(paramName);
    if (springState !== undefined) {
      return Math.abs(springState.target - springState.current) > 0.001;
    }

    const state = this.params.get(paramName);
    if (state !== undefined) {
      return state.current !== state.target;
    }

    return false;
  }
}
