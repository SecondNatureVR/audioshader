import { describe, it, expect } from 'vitest';
import {
  computeHarmonyHues,
  type ColorHarmony,
  type HarmonyType,
} from '../../src/config/colorHarmony';

function makeHarmony(
  overrides: Partial<ColorHarmony> & { type: HarmonyType }
): ColorHarmony {
  return {
    baseHue: 0,
    type: overrides.type,
    rotation: 0,
    saturation: 1,
    value: 1,
    ...overrides,
  };
}

describe('computeHarmonyHues', () => {
  it('complementary returns 2 hues 180° apart', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: 0 }));
    expect(hues).toHaveLength(2);
    expect(hues[0]).toBe(0);
    expect(hues[1]).toBe(180);
  });

  it('complementary with base 90 returns 90 and 270', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: 90 }));
    expect(hues[0]).toBe(90);
    expect(hues[1]).toBe(270);
  });

  it('analogous returns 3 hues ~30° apart', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'analogous', baseHue: 0 }));
    expect(hues).toHaveLength(3);
    expect(hues[0]).toBe(330);
    expect(hues[1]).toBe(0);
    expect(hues[2]).toBe(30);
  });

  it('analogous spread affects gap', () => {
    const narrow = computeHarmonyHues(makeHarmony({ type: 'analogous', baseHue: 0, spread: 0.5 }));
    const wide = computeHarmonyHues(makeHarmony({ type: 'analogous', baseHue: 0, spread: 1 }));
    expect(narrow[2]! - narrow[1]!).toBeLessThan(wide[2]! - wide[1]!);
  });

  it('triadic returns 3 hues 120° apart', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'triadic', baseHue: 0 }));
    expect(hues).toHaveLength(3);
    expect(hues[0]).toBe(0);
    expect(hues[1]).toBe(120);
    expect(hues[2]).toBe(240);
  });

  it('splitComplementary returns 3 hues', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'splitComplementary', baseHue: 0 }));
    expect(hues).toHaveLength(3);
    expect(hues[0]).toBe(0);
    expect(hues[1]).toBe(150);
    expect(hues[2]).toBe(210);
  });

  it('square returns 4 hues 90° apart', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'square', baseHue: 0 }));
    expect(hues).toHaveLength(4);
    expect(hues[0]).toBe(0);
    expect(hues[1]).toBe(90);
    expect(hues[2]).toBe(180);
    expect(hues[3]).toBe(270);
  });

  it('tetradic returns 4 hues', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'tetradic', baseHue: 0 }));
    expect(hues).toHaveLength(4);
    expect(hues[0]).toBe(0);
    expect(hues[1]).toBe(90);
    expect(hues[2]).toBe(180);
    expect(hues[3]).toBe(270);
  });

  it('rotation shifts all hues', () => {
    const base = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: 0, rotation: 0 }));
    const rotated = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: 0, rotation: 45 }));
    expect(rotated[0]).toBe(45);
    expect(rotated[1]).toBe(225);
  });

  it('invert flips hues 180°', () => {
    const normal = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: 0, invert: false }));
    const inverted = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: 0, invert: true }));
    expect(inverted[0]).toBe(180);
    expect(inverted[1]).toBe(0);
  });

  it('normalizes negative base hue', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: -90 }));
    expect(hues[0]).toBe(270);
    expect(hues[1]).toBe(90);
  });

  it('normalizes base hue > 360', () => {
    const hues = computeHarmonyHues(makeHarmony({ type: 'complementary', baseHue: 450 }));
    expect(hues[0]).toBe(90);
    expect(hues[1]).toBe(270);
  });
});
