# Repository Cleanup & Refactor Plan

## Status: IN PROGRESS

### Completed
- [x] Phase 1: Repository cleanup (archived old code to `_archive/`)
- [x] Extract CSS to `styles/main.css`
- [x] Extract shaders to `shaders/` directory
- [x] Update lucas.html to load external shaders
- [x] Set up TypeScript build system with Vite
- [x] Configure strict TypeScript with tsconfig.json
- [x] Set up ESLint with TypeScript rules
- [x] Set up Vitest for unit testing
- [x] Set up Playwright for E2E testing
- [x] Create core TypeScript types (`src/types/index.ts`)
- [x] Create Renderer class (`src/render/Renderer.ts`)
- [x] Create shader loading utilities (`src/render/shaders.ts`)
- [x] Create resolution config (`src/config/resolutions.ts`)

### In Progress
- [ ] Extract remaining JavaScript modules from lucas.html:
  - [ ] Audio analyzer types and integration
  - [ ] Parameter interpolation system
  - [ ] UI control panel
  - [ ] Preset manager
  - [ ] Audio mapping system
  - [ ] Curve editor

### Remaining
- [ ] Create new modular index.html entry point
- [ ] Write unit tests for core modules
- [ ] Write E2E smoke tests
- [ ] Update documentation

---

## Current Architecture

```
audioshader/
├── index.html                  # Entry point (to be created)
├── lucas.html                  # Legacy monolithic file (still working)
├── package.json                # npm configuration
├── tsconfig.json               # TypeScript config (strict mode)
├── vite.config.ts              # Vite build config
├── vitest.config.ts            # Unit test config
├── playwright.config.ts        # E2E test config
├── eslint.config.js            # ESLint rules
│
├── src/
│   ├── main.ts                 # Application entry point
│   ├── types/
│   │   └── index.ts            # Core type definitions
│   ├── config/
│   │   └── resolutions.ts      # Resolution settings
│   ├── render/
│   │   ├── Renderer.ts         # WebGL renderer class
│   │   └── shaders.ts          # Shader loading utilities
│   ├── audio/                  # (to be created)
│   ├── ui/                     # (to be created)
│   └── presets/                # (to be created)
│
├── shaders/
│   ├── star.vert               # Star shape vertex shader
│   ├── star.frag               # Star shape fragment shader
│   ├── dilation.vert           # Dilation effect vertex shader
│   └── dilation.frag           # Dilation effect fragment shader
│
├── styles/
│   └── main.css                # Extracted CSS
│
├── audio/
│   └── analyzer.js             # Audio analysis (to be converted to TS)
│
├── tests/
│   ├── unit/
│   │   └── example.test.ts     # Sample unit test
│   └── e2e/
│       └── smoke.spec.ts       # Sample E2E test
│
├── vendor/
│   ├── gif.js                  # GIF recording library
│   └── gif.worker.js
│
├── docs/                       # Documentation
│   ├── PRD.md
│   ├── specs/
│   └── feature-plans/
│
└── _archive/                   # Old code preserved for reference
    ├── README.md
    ├── old-modular/
    ├── backups/
    ├── sandbox/
    ├── specs/
    └── prompts/
```

---

## npm Scripts

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
npm run typecheck     # Run TypeScript type checking
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint issues
npm run test          # Run unit tests (watch mode)
npm run test:run      # Run unit tests once
npm run test:coverage # Run tests with coverage
npm run test:e2e      # Run Playwright E2E tests
npm run check         # Run all checks (typecheck + lint + test)
```

---

## Key Decisions

1. **TypeScript with strict mode**: All new code is strictly typed
2. **Vite for build**: Fast development and optimized production builds
3. **External shaders**: Loaded via fetch instead of embedded in HTML
4. **Modular CSS**: Extracted to separate stylesheet
5. **Preserved legacy**: lucas.html still works as fallback
6. **Comprehensive testing**: Unit tests (Vitest) + E2E tests (Playwright)
