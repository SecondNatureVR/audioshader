/**
 * Lit web components for AudioShader UI
 *
 * Import this module to register all custom elements.
 */

// Component exports
export { EditableValue, VALUE_FORMATTERS } from './editable-value/EditableValue';
export { ParamSlider } from './param-slider/ParamSlider';
export { ControlGroup } from './control-group/ControlGroup';

// Type exports
export type {
  ParamChangeEventDetail,
  CurveEditRequestEventDetail,
  ValueChangeEventDetail,
} from './types';
export type { ValueFormatter } from './editable-value/EditableValue';
