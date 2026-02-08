# Direct Input Test Plan

## Parameters to Test

### ParamSlider Components (1 parameter)
- **spikiness**: Uses `<param-slider>` component
  - Direct input path: `ParamSlider.handleValueBlur` → `setupComponentListeners` → `setParam(immediate=true)`
  - Display: Component's `valueDisplayEl` updated immediately

### Legacy HTML Sliders (16 parameters)
All use `setupParamSlider` → `setupEditableValue`:
- **spikeFrequency**: min=2, max=20 (normalized to 0-100)
- **spikeSharpness**: min=0, max=100
- **hue**: min=0, max=360
- **scale**: min=0.05, max=1
- **fillSize**: min=0, max=100
- **fillOpacity**: min=0, max=100
- **blendOpacity**: min=0, max=100
- **expansionFactor**: min=0, max=200
- **fadeAmount**: min=0, max=100
- **noiseAmount**: min=0, max=100
- **noiseRate**: min=0, max=100
- **blurAmount**: min=0, max=100
- **blurRate**: min=0, max=100
- **rotation**: min=0, max=360
- **autoRotationSpeed**: min=0, max=200
- **hueShiftAmount**: min=0, max=100

## Test Cases for Each Parameter

### Test 1: Direct Input Within Range
1. Enter a value within the current curve mapping range
2. **Expected**: Display shows exact value entered
3. **Expected**: Parameter is set immediately (no interpolation)
4. **Expected**: Slider position updates to match value

### Test 2: Direct Input Outside Range (Expansion)
1. Enter a value that exceeds current max (e.g., enter 100 when max is 44)
2. **Expected**: Display shows exact value entered (100, not 110)
3. **Expected**: Curve mapping max expands to exactly 100 (no 10% headroom)
4. **Expected**: Slider position recalculated to match new range
5. **Expected**: Sliding to max position now maps to 100

### Test 3: Direct Input Below Range (Expansion)
1. Enter a value below current min
2. **Expected**: Display shows exact value entered
3. **Expected**: Curve mapping min expands to exactly match value
4. **Expected**: Slider position recalculated

### Test 4: Slider Movement After Range Expansion
1. Expand range via direct input
2. Move slider all the way to the right
3. **Expected**: Value equals the new max (not old max)
4. **Expected**: Display shows the new max value

### Test 5: Curve Editor Changes
1. Open curve editor for a parameter
2. Change max value
3. **Expected**: Slider position updates to match new range
4. **Expected**: Current value display remains correct

## Implementation Status

### ✅ Fixed
- **Legacy HTML sliders**: `setupEditableValue` uses `immediate: true` and displays exact value
- **ParamSlider components**: `setupComponentListeners` uses `immediate: true` for direct input
- **Range expansion**: Uses exact value (no 10% headroom)
- **Slider normalization**: HTML sliders with different min/max are normalized to 0-100

### 🔍 To Verify
- All parameters handle direct input consistently
- Display always shows exact entered value
- Range expansion works for all parameters
- Slider position matches curve mapping after expansion
