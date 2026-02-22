# Archive

This directory contains old, experimental, or superseded code that is preserved for reference but is **not part of the active codebase**.

## Contents

### `old-modular/`
The original attempt at a modular architecture before consolidating into `lucas.html`. Contains:
- `index.html` - Old entry point
- `main.js` - Old main script with render loop
- `gl/renderer.js` - Old WebGL renderer
- `ui/debug.js`, `ui/legend.js`, `ui/meters.js` - Old UI modules
- `shaders/*.glsl` - External shader files

**Why archived**: The project evolved to use `lucas.html` as a monolithic file. This old modular code uses a different shader (fragment-water.glsl) and architecture. The current refactor creates a new modular structure based on what's actually in lucas.html.

### `backups/`
Old versions of the main application:
- `lucas_backup.html` - An earlier snapshot of lucas.html
- `lucas_backup_files/` - Associated downloaded resources

**Why archived**: These are historical backups, not current code.

### `sandbox/`
An experimental fork with different features:
- `sandbox.html` - Alternative version of the visualizer
- `sandbox-presets.json`, `sandbox-presets-2.json` - Presets for sandbox

**Why archived**: This was a separate experiment. The main development continued in lucas.html.

### `specs/`
Specification documents for features that were not implemented in the current version:
- `WATER_RIPPLE_SPEC.md` - Water ripple effect (not in lucas.html)

**Why archived**: These describe features that don't exist in the current codebase.

### `prompts/`
AI prompts used during development:
- `cursor_prompt_v1.md`, `cursor_prompt_v2.md` - Prompts for Cursor AI

**Why archived**: Historical context, not code or current documentation.

---

## Restoring Archived Code

If you need to reference or restore any of this code:

```bash
# View a file
cat _archive/old-modular/main.js

# Restore a file to active codebase
cp _archive/old-modular/main.js ./main.js
```

## Deletion

This archive can be safely deleted if disk space is a concern. The active codebase does not depend on any of these files.
