/**
 * Audio analysis and feature extraction module
 * Responsibilities:
 * - Creates and manages AudioContext and AnalyserNode
 * - Handles getUserMedia audio stream connection
 * - Performs FFT analysis on audio data
 * - Computes audio metrics (coherence, mud, harshness, compression, phaseRisk, collision, etc.)
 * - Applies smoothing (EMA) to metrics to reduce jitter
 * - Exports normalized metric values (0-1) for shader uniforms
 */

