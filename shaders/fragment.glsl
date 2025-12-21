// Fragment shader
// Responsibilities:
// - Receives audio metric uniforms (coherence, mud, harshness, compression, collision, etc.)
// - Implements visual semantics mapping:
//   - High coherence → sharp, stable structure
//   - High mud → blur / collapsed contours
//   - High harshness → fine noise / jagged edges
//   - High compression → flattened contrast, reduced motion
//   - High collision → sharp spikes / shockwave artifacts
// - Renders the visual coherence field diagnostic canvas
// - Uses u_time, u_resolution, u_audioAmp, u_bandEnergy for modulation

