# AudioShader

Audio-reactive WebGL visualizer with real-time parameter control and preset management.

## Prerequisites

- **Node.js** 20.19+ or 22.12+ (required by Vite 7)
- **npm** (comes with Node.js)

## Quick Start

```bash
# Full initialization (install dependencies + Playwright browsers)
make init

# Start development server
make dev

# Open http://localhost:5173 in your browser
```

Or manually:

```bash
npm install
npx playwright install    # Required for E2E tests
npm run dev
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make init` | Install all dependencies including Playwright browsers |
| `make install-deps` | Install system dependencies for Playwright (Linux/WSL) |
| `make dev` | Start development server with hot reload |
| `make build` | Build for production |
| `make test` | Run all tests (unit + E2E) |
| `make test-unit` | Run unit tests only |
| `make test-e2e` | Run E2E tests only |
| `make check` | Full quality check (typecheck + lint + unit tests) |
| `make clean` | Remove build artifacts and node_modules |

## npm Scripts

```bash
npm run dev           # Start Vite dev server with HMR
npm run build         # Production build to dist/
npm run preview       # Preview production build
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint with TypeScript rules
npm run lint:fix      # ESLint with auto-fix
npm run test          # Vitest unit tests (watch mode)
npm run test:run      # Vitest unit tests (single run)
npm run test:coverage # Unit tests with coverage report
npm run test:e2e      # Playwright E2E tests
npm run test:e2e:ui   # Playwright E2E tests with UI
npm run check         # All checks (typecheck + lint + test:run)
```

## Features

- **WebGL Rendering**: Persistent visual trails using framebuffer ping-pong
- **Audio Analysis**: Real-time FFT with stereo processing and derived metrics
- **Parameter Interpolation**: Spring physics and easing for smooth transitions
- **Preset System**: Save, load, and share visual configurations
- **Recording**: PNG snapshots and GIF/WebM video capture
- **Curve Mapping**: Customizable response curves for fine control
- **Direct Value Input**: Click any parameter value to type exact numbers

## Project Structure

```
src/
├── App.ts               # Main application state, render loop
├── main.ts              # Entry point
├── types/               # TypeScript type definitions
├── render/              # WebGL renderer, parameters, interpolation
├── audio/               # Audio analysis and visual mapping
├── ui/                  # UI controller and utilities
├── presets/             # Preset save/load/export
├── mapping/             # Slider-to-value curve mapping
├── capture/             # PNG/GIF/WebM recording
└── config/              # Resolution management

tests/
├── unit/                # Vitest unit tests
└── e2e/                 # Playwright E2E tests

shaders/                 # GLSL shader files
styles/                  # CSS stylesheets
```

See [AGENTS.md](./AGENTS.md) for detailed architecture and development guidelines.

## Testing

### Unit Tests (Vitest)

```bash
npm run test:run         # Single run
npm run test             # Watch mode
npm run test:coverage    # With coverage report
```

### E2E Tests (Playwright)

```bash
# First time setup (or after Playwright update)
npx playwright install

# Run tests
npm run test:e2e         # Headless mode
npm run test:e2e:ui      # Interactive UI mode
```

#### Linux/WSL System Dependencies

Playwright requires system libraries for browser automation. On Ubuntu/Debian-based systems:

```bash
# Install system dependencies for Playwright browsers
npx playwright install-deps
```

Or manually install required libraries:

```bash
sudo apt-get update
sudo apt-get install -y \
  libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2
```

On WSL2, you may also need to install additional GTK dependencies or run tests in headed mode with an X server.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Pause/Resume |
| F | Freeze Dilation |
| R | Randomize |
| J | Toggle Jiggle |
| H | Toggle UI |
| M | Audio Mapping Panel |
| S | Snapshot (PNG) |
| G | Record GIF |
| ← → | Cycle Presets |
| ↑ ↓ | Accelerate/Decelerate |
| Esc | Clear Screen |

## Tech Stack

- **TypeScript** with strict mode
- **Vite** for development and bundling
- **Vitest** for unit testing
- **Playwright** for E2E testing
- **ESLint** with TypeScript rules
- **Web Audio API** for audio analysis
- **WebGL 1.0** for rendering

## Browser Support

Modern browsers with WebGL and Web Audio API support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

ISC
