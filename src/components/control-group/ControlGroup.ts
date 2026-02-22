import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Control group wrapper component
 *
 * Provides consistent styling for control groups with label.
 * Uses slots for flexible content.
 *
 * @slot - Default slot for control content
 * @slot label - Optional custom label content
 *
 * @example
 * <control-group label="Spikiness">
 *   <input type="range" />
 * </control-group>
 */
@customElement('control-group')
export class ControlGroup extends LitElement {
  /** Label text */
  @property({ type: String })
  label = '';

  /** Layout direction */
  @property({ type: String })
  direction: 'row' | 'column' = 'column';

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

    .content {
      display: flex;
      gap: 8px;
    }

    :host([direction="row"]) .content {
      flex-direction: row;
      align-items: center;
    }

    :host([direction="column"]) .content {
      flex-direction: column;
    }
  `;

  render() {
    return html`
      <label>
        <slot name="label">${this.label}</slot>
      </label>
      <div class="content">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'control-group': ControlGroup;
  }
}
