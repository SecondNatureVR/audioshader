# Color Harmony & Transformations Plan

A design for color remapping via **color harmony presets** (complementary, analogous, triadic, etc.) with **rotation** and other transformations — no extract-from-image.

---

## 1. Harmony Types

Each harmony defines a set of hues from a single **base hue** (0–360°):

| Harmony | Hues | Example (base 0°) |
|---------|------|-------------------|
| **Complementary** | 2, 180° apart | 0°, 180° |
| **Analogous** | 3, ~30° apart | 0°, 30°, 60° |
| **Triadic** | 3, 120° apart | 0°, 120°, 240° |
| **Split-complementary** | 3 | 0°, 150°, 210° |
| **Square** | 4, 90° apart | 0°, 90°, 180°, 270° |
| **Tetradic** | 4, rectangle | 0°, 90°, 180°, 270° |

---

## 2. Transformations

| Transform | Effect |
|-----------|--------|
| **Rotate** | Add offset to all hues (e.g. +45° shifts entire palette) |
| **Invert** | Flip hues 180° (complement of each) |
| **Spread** | Widen or narrow hue range (e.g. analogous: 15° vs 45° apart) |
| **Saturation** | Global saturation (already in ColorPalette) |
| **Value** | Global brightness (already in ColorPalette) |

---

## 3. Data Model

```ts
interface ColorHarmony {
  baseHue: number;           // 0-360, primary color
  type: 'complementary' | 'analogous' | 'triadic' | 'splitComplementary' | 'square' | 'tetradic';
  rotation: number;           // 0-360, shift all hues
  spread?: number;            // 0-1, narrow (0) to wide (1) — for analogous
  invert?: boolean;           // flip hues 180°
  saturation: number;         // 0-1
  value: number;             // 0-1
}
```

**Integration with ColorPalette:** Harmony computes hues → convert to hex → populate `dominantColors`, or compute `hueMin`/`hueMax` for gamut mode. Harmony can either replace or augment the existing palette.

---

## 4. UI Sketch

- **Base hue** — Slider or small color wheel (0–360°)
- **Harmony type** — Dropdown or button group (Complementary, Analogous, Triadic, etc.)
- **Rotation** — Slider 0–360° (or circular dial)
- **Spread** — Slider 0–1 (optional, mainly for analogous)
- **Invert** — Toggle
- **Saturation / Value** — Existing sliders (or shared with harmony)

---

## 5. Shader Integration

**Option A: Harmony → dominant colors** — Compute 2–5 hex colors from harmony, pass as `u_color0`–`u_color4`. Reuses existing dominant-color path.

**Option B: Harmony → gamut** — Compute `hueMin` and `hueMax` from harmony (min/max of hue set). Reuses existing gamut path.

**Recommendation:** Option A — harmony generates `dominantColors`; when harmony is active, clear manual swatches or show them as read-only preview.

---

## 6. Example: Analogous + Rotate

- Base: 200° (blue)
- Type: Analogous → 200°, 230°, 260°
- Rotation: +30° → 230°, 260°, 290°
- Result: blue–cyan–teal palette shifted warmer

---

## 7. Optional: Harmony vs Manual Mode

- **Harmony mode** — Base hue + type + transforms drive palette; swatches are computed.
- **Manual mode** — User picks 5 dominant colors (current behavior).
- Toggle or tab to switch; when switching to manual, harmony values are preserved but not applied.

---

## 8. Implementation Phases

### Phase 1: Core harmony logic
- [ ] Add `ColorHarmony` type and `computeHarmonyHues()` utility
- [ ] Implement each harmony type (complementary, analogous, triadic, etc.)
- [ ] Apply rotation and invert
- [ ] Unit tests for hue computation

### Phase 2: Palette integration
- [ ] Harmony → `dominantColors` (HSV to hex)
- [ ] Wire into `ColorPalette` / `setColorPalette()`
- [ ] Preset support (save/load harmony in preset)

### Phase 3: UI
- [ ] Base hue control
- [ ] Harmony type selector
- [ ] Rotation slider
- [ ] Spread slider (optional)
- [ ] Invert toggle
- [ ] Harmony vs manual mode toggle (optional)

### Phase 4: Polish
- [ ] Quick preset swatches (Ocean, Sunset, Neon, etc.) that set harmony
- [ ] Eyedropper to set base hue from screen

---

## 9. References

- Color theory: complementary, analogous, triadic, split-complementary
- HSV/RGB conversion (existing `hsvToRgb`, `hexToRgb` in `colorPalette.ts`)
