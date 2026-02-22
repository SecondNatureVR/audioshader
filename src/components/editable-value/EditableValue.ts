import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { parseNumericValue } from '../../ui/valueUtils';
import type { ValueChangeEventDetail } from '../types';

export type ValueFormatter = (value: number) => string;

/**
 * Default formatters for common value types
 */
export const VALUE_FORMATTERS: Record<string, ValueFormatter> = {
  decimal2: (v: number) => v.toFixed(2),
  decimal3: (v: number) => v.toFixed(3),
  decimal1: (v: number) => v.toFixed(1),
  integer: (v: number) => Math.round(v).toString(),
  degrees: (v: number) => `${v.toFixed(0)}°`,
  percentage: (v: number) => `${Math.round(v * 100)}%`,
  percentageInt: (v: number) => `${Math.round(v)}%`,
};

/**
 * Editable value display component
 *
 * A contenteditable span that displays a formatted value and allows direct input.
 * Emits 'value-change' event when the user enters a new value.
 *
 * @example
 * <editable-value
 *   .value=${0.5}
 *   format="decimal2"
 * ></editable-value>
 */
@customElement('editable-value')
export class EditableValue extends LitElement {
  /** Current value to display */
  @property({ type: Number })
  value = 0;

  /** Format type or custom formatter function */
  @property({ type: String })
  format: keyof typeof VALUE_FORMATTERS | 'custom' = 'decimal2';

  /** Custom formatter function (used when format='custom') */
  @property({ attribute: false })
  formatter?: ValueFormatter;

  /** Whether the value is editable */
  @property({ type: Boolean })
  editable = true;

  // Track editing state (used to prevent external updates during user input)
  private isEditing = false;

  @query('.value-display')
  private valueDisplayEl!: HTMLElement;

  static styles = css`
    :host {
      display: inline-block;
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
      display: inline-block;
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

    .value-display[contenteditable="false"] {
      cursor: default;
    }

    .value-display[contenteditable="false"]:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: transparent;
    }
  `;

  protected updated(changedProperties: PropertyValues): void {
    // When external value changes and we're not editing, update display
    if (changedProperties.has('value') && !this.isEditing && this.valueDisplayEl) {
      this.valueDisplayEl.textContent = this.formatValue(this.value);
    }
  }

  render() {
    return html`
      <span
        class="value-display"
        contenteditable=${this.editable ? 'true' : 'false'}
        @blur=${this.handleBlur}
        @keydown=${this.handleKeydown}
        @focus=${this.handleFocus}
      >${this.formatValue(this.value)}</span>
    `;
  }

  private formatValue(value: number): string {
    if (this.format === 'custom' && this.formatter) {
      return this.formatter(value);
    }
    const formatter = VALUE_FORMATTERS[this.format];
    return formatter ? formatter(value) : value.toFixed(2);
  }

  private handleFocus(): void {
    this.isEditing = true;
  }

  private handleBlur(e: FocusEvent): void {
    this.isEditing = false;
    const target = e.target as HTMLElement;
    const text = target.textContent?.trim() ?? '';
    const numValue = parseNumericValue(text);

    if (numValue !== null && numValue !== this.value) {
      this.dispatchEvent(new CustomEvent<ValueChangeEventDetail>('value-change', {
        bubbles: true,
        composed: true,
        detail: {
          value: numValue,
          source: 'input',
        },
      }));
    }

    // Reset display to formatted value
    target.textContent = this.formatValue(this.value);
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'editable-value': EditableValue;
  }
}
