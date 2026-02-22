/**
 * Event type definitions for Lit components
 */

export interface ParamChangeEventDetail {
  paramName: string;
  value: number;
  sliderValue: number;
  source: 'slider' | 'input';
}

export interface CurveEditRequestEventDetail {
  paramName: string;
}

export interface AudioToggleRequestEventDetail {
  paramName: string;
}

export interface ValueChangeEventDetail {
  value: number;
  source: 'input';
}

// Global type augmentation for custom events
declare global {
  interface DocumentEventMap {
    'param-change': CustomEvent<ParamChangeEventDetail>;
    'curve-edit-request': CustomEvent<CurveEditRequestEventDetail>;
    'audio-toggle-request': CustomEvent<AudioToggleRequestEventDetail>;
    'value-change': CustomEvent<ValueChangeEventDetail>;
  }
}
