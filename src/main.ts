/**
 * AudioShader - Audio-reactive visualizer
 * Main entry point
 */

import { App } from './App';
import { UIController } from './ui/UIController';

// Global app instance for debugging and console access
declare global {
  interface Window {
    app: App;
    ui: UIController;
  }
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
  if (canvas === null) {
    throw new Error('Canvas element not found');
  }

  // Create and initialize the app
  const app = new App({ canvas });
  await app.init();

  // Create and initialize the UI controller
  const ui = new UIController({ app });
  ui.init();

  // Expose for debugging
  window.app = app;
  window.ui = ui;

  // Start the render loop
  app.start();

  // Note: We don't register onParamsChange to call updateAllSliders here
  // as it would cause severe lag - every slider input would update ALL sliders.
  // Instead, sliders are updated:
  // - On preset load (UIController.loadPreset)
  // - When jiggle is stopped (UIController jiggle button handler)

  console.info('AudioShader initialized successfully');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error: unknown) => {
      console.error('Failed to initialize AudioShader:', error);
    });
  });
} else {
  init().catch((error: unknown) => {
    console.error('Failed to initialize AudioShader:', error);
  });
}
