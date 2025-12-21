# Coherence Canvas

Visual diagnostic instrument for music mixing and arrangement.

## Quick Start

1. Start a local server:
   ```bash
   python -m http.server 8000
   ```

2. Open `http://localhost:8000` in your browser

3. Click "Enable Audio" and grant microphone permissions

4. The canvas will render a real-time visual coherence field based on audio input

## Project Structure

- `index.html` - Entry point and page structure
- `main.js` - Application boot and render loop coordination
- `audio/analyzer.js` - Web Audio API analysis and metric extraction
- `gl/renderer.js` - WebGL context and shader management
- `shaders/vertex.glsl` - Vertex shader for full-screen quad
- `shaders/fragment.glsl` - Fragment shader implementing visual coherence field
- `ui/debug.js` - Debug overlay for live metric values

