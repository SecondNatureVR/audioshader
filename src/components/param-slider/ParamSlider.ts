import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { parseNumericValue, calculateExpandedRange } from '../../ui/valueUtils';
import { VALUE_FORMATTERS, type ValueFormatter } from '../editable-value/EditableValue';
import { getParamLabel } from '../../config/paramLabels';
import type { ParamChangeEventDetail, CurveEditRequestEventDetail } from '../types';

/**
 * Parameter slider component with editable value display and curve button
 *
 * Encapsulates the common pattern of:
 * - Range slider input
 * - Editable value display
 * - Curve edit button (optional)
 *
 * @fires param-change - When slider or value input changes
 * @fires curve-edit-request - When curve button is clicked
 *
 * @example
 * <param-slider
 *   param-name="spikiness"
 *   label="Spikiness"
 *   .value=${0.5}
 *   min="0"
 *   max="100"
 *   format="decimal2"
 *   show-curve-btn
 * ></param-slider>
 */
@customElement('param-slider')
export class ParamSlider extends LitElement {
  /** Parameter name (used in events) */
  @property({ type: String, attribute: 'param-name' })
  paramName = '';

  /** Display label */
  @property({ type: String })
  label = '';

  /** Current parameter value (actual value, not slider position) */
  @property({ type: Number })
  value = 0;

  /** Slider minimum position */
  @property({ type: Number })
  min = 0;

  /** Slider maximum position */
  @property({ type: Number })
  max = 100;

  /** Slider step */
  @property({ type: Number })
  step = 1;

  /** Show curve edit button */
  @property({ type: Boolean, attribute: 'show-curve-btn' })
  showCurveBtn = true;

  /** Value display format */
  @property({ type: String })
  format: keyof typeof VALUE_FORMATTERS | 'custom' = 'decimal2';

  /** Custom formatter function (used when format='custom') */
  @property({ attribute: false })
  formatter?: ValueFormatter;

  /** Slider position (internal, synced via external controller) */
  @state()
  private sliderValue = 50;

  @state()
  private isEditing = false;

  @query('input[type="range"]')
  private sliderEl!: HTMLInputElement;

  @query('.value-display')
  private valueDisplayEl!: HTMLElement;

  static styles = css`
    :host {
      display: block;
      margin-bottom: 10px;
    }

    label {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
      font-size: 10px;
      color: #bbb;
      font-weight: 500;
    }

    .curve-btn {
      display: none;
      width: 18px;
      height: 18px;
      margin-left: 6px;
      cursor: pointer;
      background: #333;
      border: 1px solid #555;
      border-radius: 3px;
      color: #aaa;
      font-size: 14px;
      line-height: 16px;
      text-align: center;
      font-weight: bold;
    }

    :host(:hover) .curve-btn {
      display: inline-block;
    }

    .curve-btn:hover {
      background: #444;
      border-color: #0af;
      color: #0af;
    }

    .control-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    input[type="range"] {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      background: #333;
      border-radius: 3px;
      outline: none;
      margin: 0;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      background: #0af;
      border-radius: 50%;
      cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
      width: 14px;
      height: 14px;
      background: #0af;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }

    .value-display {
      min-width: 45px;
      font-size: 10px;
      color: #888;
      font-family: monospace;
      text-align: right;
      padding: 2px 4px;
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: text;
      user-select: text;
      background: rgba(255, 255, 255, 0.05);
    }

    .value-display:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #555;
    }

    .value-display:focus {
      outline: none;
      background: rgba(255, 255, 255, 0.15);
      border-color: #0af;
      color: #fff;
    }
  `;

  protected updated(changedProperties: PropertyValues): void {
    // When external value changes and we're not editing, update display
    // Only update if component is connected to DOM
    if (changedProperties.has('value') && !this.isEditing && this.isConnected) {
      if (this.valueDisplayEl) {
        this.valueDisplayEl.textContent = this.formatValue(this.value);
      }
    }
  }

  /**
   * Get display label - uses explicit label or derives from paramName
   */
  private get displayLabel(): string {
    return this.label || getParamLabel(this.paramName);
  }

  render() {
    return html`
      <label>
        ${this.displayLabel}
        ${this.showCurveBtn ? html`
          <span class="curve-btn" @click=${this.handleCurveClick} title="Edit curve">~</span>
        ` : ''}
      </label>
      <div class="control-row">
        <input
          type="range"
          .min=${String(this.min)}
          .max=${String(this.max)}
          .step=${String(this.step)}
          .value=${String(this.sliderValue)}
          @input=${this.handleSliderInput}
        />
        <span
          class="value-display"
          contenteditable="true"
          @blur=${this.handleValueBlur}
          @keydown=${this.handleValueKeydown}
          @focus=${this.handleValueFocus}
        >${this.formatValue(this.value)}</span>
      </div>
    `;
  }

  private formatValue(value: number): string {
    if (this.format === 'custom' && this.formatter) {
      return this.formatter(value);
    }
    const formatter = VALUE_FORMATTERS[this.format];
    return formatter ? formatter(value) : value.toFixed(2);
  }

  private handleSliderInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    this.sliderValue = parseFloat(target.value);

    this.dispatchEvent(new CustomEvent<ParamChangeEventDetail>('param-change', {
      bubbles: true,
      composed: true,
      detail: {
        paramName: this.paramName,
        value: this.sliderValue,
        sliderValue: this.sliderValue,
        source: 'slider',
      },
    }));
  }

  private handleValueFocus(): void {
    this.isEditing = true;
  }

  private handleValueBlur(e: FocusEvent): void {
    this.isEditing = false;
    const target = e.target as HTMLElement;
    const text = target.textContent?.trim() ?? '';
    const numValue = parseNumericValue(text);

    if (numValue !== null) {
      // Check if range needs expansion (will be handled by parent)
      const expanded = calculateExpandedRange(numValue, this.min, this.max);
      if (expanded !== null) {
        this.min = expanded.min;
        this.max = expanded.max;
      }

      this.dispatchEvent(new CustomEvent<ParamChangeEventDetail>('param-change', {
        bubbles: true,
        composed: true,
        detail: {
          paramName: this.paramName,
          value: numValue,
          sliderValue: this.sliderValue,
          source: 'input',
        },
      }));
    }

    // Reset display to formatted current value
    target.textContent = this.formatValue(this.value);
  }

  private handleValueKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }

  private handleCurveClick(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent<CurveEditRequestEventDetail>('curve-edit-request', {
      bubbles: true,
      composed: true,
      detail: { paramName: this.paramName },
    }));
  }

  /**
   * Set slider position directly (called by UIController after curve mapping)
   */
  setSliderPosition(position: number): void {
    // Only update if component is connected to DOM
    if (!this.isConnected) {
      return;
    }
    
    this.sliderValue = position;
    if (this.sliderEl) {
      this.sliderEl.value = String(position);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'param-slider': ParamSlider;
  }
}
