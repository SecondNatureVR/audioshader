# AudioShader

Audio-reactive WebGL visualizer with real-time parameter control and preset management.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

## Features

- **WebGL Rendering**: Persistent visual trails using framebuffer ping-pong
- **Audio Analysis**: Real-time FFT with stereo processing and derived metrics
- **Parameter Interpolation**: Spring physics and easing for smooth transitions
- **Preset System**: Save, load, and share visual configurations
- **Recording**: PNG snapshots and GIF/WebM video capture
- **Curve Mapping**: Exponential response curves for fine control

## Development

```bash
npm run dev         # Start Vite dev server with HMR
npm run build       # Production build to dist/
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint with TypeScript rules
npm run test        # Vitest unit tests
npm run check       # All checks (typecheck + lint + test)
```

## Project Structure

```
src/
├── render/          # WebGL renderer, parameters, interpolation
├── audio/           # Audio analysis and visual mapping
├── presets/         # Preset save/load/export
├── mapping/         # Slider-to-value curve mapping
├── capture/         # PNG/GIF/WebM recording
├── config/          # Resolution management
└── types/           # TypeScript type definitions
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## Tech Stack

- **TypeScript** with strict mode
- **Vite** for development and bundling
- **Vitest** for unit testing
- **ESLint** with TypeScript rules
- **Web Audio API** for audio analysis
- **WebGL 1.0** for rendering

## Browser Support

Modern browsers with WebGL and Web Audio API support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT
