/**
 * Audio Radar Chart
 * Canvas-based radar/polygon visualization of audio metrics.
 * Renders a shape that changes distinctly between song sections,
 * providing an intuitive "fingerprint" of the current audio character.
 */

import type { AudioMetrics } from '../types';
import { AudioMapper } from '../audio/AudioMapper';

/** Metrics to display on the radar (in order around the circle) */
const RADAR_METRICS: Array<keyof AudioMetrics> = [
  'rms', 'bass', 'mid', 'high', 'presence', 'harshness',
  'mud', 'compression', 'collision', 'coherence', 'stereoWidth', 'phaseRisk',
  'lowImbalance', 'emptiness', 'panPosition',
];

export class AudioRadarChart {
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private center: number;
  private radius: number;
  private avgValues: number[] = new Array(RADAR_METRICS.length).fill(0);
  private avgAlpha = 0.05; // EMA factor for trailing average

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Could not get 2d context for radar chart');
    this.ctx = ctx;
    this.size = canvas.width;
    this.center = this.size / 2;
    this.radius = this.size * 0.38; // leave room for labels
  }

  /**
   * Update and render the radar chart with current metrics.
   * Call at ~15fps for responsive updates without burning cycles.
   */
  update(metrics: AudioMetrics | null): void {
    const ctx = this.ctx;
    const n = RADAR_METRICS.length;
    const angleStep = (Math.PI * 2) / n;

    // Clear
    ctx.clearRect(0, 0, this.size, this.size);

    // Draw background grid
    this.drawGrid(n, angleStep);

    // Draw axis labels
    this.drawLabels(n, angleStep);

    if (metrics === null) return;

    // Get current metric values (0-1 normalized)
    const values = RADAR_METRICS.map((m) => Math.max(0, Math.min(1, metrics[m] ?? 0)));

    // Update trailing average
    for (let i = 0; i < n; i++) {
      this.avgValues[i] = this.avgValues[i]! + this.avgAlpha * (values[i]! - this.avgValues[i]!);
    }

    // Draw trailing average polygon (faded)
    this.drawPolygon(this.avgValues, 'rgba(0, 170, 255, 0.1)', 'rgba(0, 170, 255, 0.25)', 1);

    // Draw current polygon (bright)
    this.drawPolygon(values, 'rgba(0, 255, 170, 0.15)', 'rgba(0, 255, 170, 0.8)', 1.5);
  }

  private drawGrid(n: number, angleStep: number): void {
    const ctx = this.ctx;
    const rings = 4;

    // Concentric rings
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (this.radius * r) / rings;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = this.center + Math.cos(angle) * ringRadius;
        const y = this.center + Math.sin(angle) * ringRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Axis lines
    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(this.center, this.center);
      ctx.lineTo(
        this.center + Math.cos(angle) * this.radius,
        this.center + Math.sin(angle) * this.radius,
      );
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  private drawLabels(n: number, angleStep: number): void {
    const ctx = this.ctx;
    ctx.font = '7px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelRadius = this.radius + 12;

    for (let i = 0; i < n; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = this.center + Math.cos(angle) * labelRadius;
      const y = this.center + Math.sin(angle) * labelRadius;

      // Abbreviated labels for compact display
      const label = AudioMapper.getMetricLabel(RADAR_METRICS[i]!);
      const shortLabel = label.length > 6 ? label.slice(0, 5) + '.' : label;
      ctx.fillText(shortLabel, x, y);
    }
  }

  private drawPolygon(
    values: number[],
    fillColor: string,
    strokeColor: string,
    lineWidth: number,
  ): void {
    const ctx = this.ctx;
    const n = values.length;
    const angleStep = (Math.PI * 2) / n;

    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const angle = idx * angleStep - Math.PI / 2;
      const r = this.radius * (values[idx] ?? 0);
      const x = this.center + Math.cos(angle) * r;
      const y = this.center + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}
