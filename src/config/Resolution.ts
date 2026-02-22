/**
 * Resolution configuration and management
 */

export interface ResolutionConfig {
  width: number | null;
  height: number | null;
  name: string;
}

/**
 * Predefined resolution presets
 */
export const RESOLUTIONS: Record<string, ResolutionConfig> = {
  '4k': { width: 3840, height: 2160, name: '4K UHD' },
  '1440p': { width: 2560, height: 1440, name: '1440p QHD' },
  'pc': { width: 1920, height: 1080, name: 'Full HD' },
  '720p': { width: 1280, height: 720, name: '720p HD' },
  'mobile': { width: 1080, height: 1920, name: 'Mobile Portrait' },
  'mobileLandscape': { width: 1920, height: 1080, name: 'Mobile Landscape' },
  'square': { width: 1080, height: 1080, name: 'Square (1:1)' },
  'window': { width: null, height: null, name: 'Window Size' },
};

export type ResolutionKey = keyof typeof RESOLUTIONS;

/**
 * Get resolution from URL parameter
 */
export function getResolutionFromUrl(): ResolutionKey {
  const urlParams = new URLSearchParams(window.location.search);
  const resolution = urlParams.get('resolution');

  if (resolution !== null && resolution in RESOLUTIONS) {
    return resolution;
  }

  return 'window';
}

/**
 * Update URL with resolution parameter
 */
export function setResolutionInUrl(resolutionKey: ResolutionKey): void {
  const url = new URL(window.location.href);

  if (resolutionKey === 'window') {
    url.searchParams.delete('resolution');
  } else {
    url.searchParams.set('resolution', resolutionKey);
  }

  window.history.replaceState({}, '', url.toString());
}

/**
 * Get canvas dimensions for a resolution
 */
export function getCanvasDimensions(resolutionKey: ResolutionKey): { width: number; height: number } {
  const config = RESOLUTIONS[resolutionKey];

  if (config === undefined || config.width === null || config.height === null) {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  return {
    width: config.width,
    height: config.height,
  };
}

/**
 * Get display string for a resolution
 */
export function getResolutionDisplayString(resolutionKey: ResolutionKey): string {
  const config = RESOLUTIONS[resolutionKey];

  if (config === undefined) {
    return 'Unknown Resolution';
  }

  if (config.width !== null && config.height !== null) {
    return `${config.name} (${config.width}×${config.height})`;
  }

  return config.name;
}

/**
 * ResolutionManager class for managing canvas resolution
 */
export class ResolutionManager {
  private canvas: HTMLCanvasElement;
  private currentResolution: ResolutionKey;
  private onChangeCallbacks: Array<(resolution: ResolutionKey, dimensions: { width: number; height: number }) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.currentResolution = getResolutionFromUrl();

    // Set initial dimensions
    this.applyResolution();

    // Listen for window resize (only matters for 'window' resolution)
    window.addEventListener('resize', this.handleWindowResize);
  }

  /**
   * Get current resolution key
   */
  getResolution(): ResolutionKey {
    return this.currentResolution;
  }

  /**
   * Get current dimensions
   */
  getDimensions(): { width: number; height: number } {
    return getCanvasDimensions(this.currentResolution);
  }

  /**
   * Set resolution
   */
  setResolution(resolutionKey: ResolutionKey): void {
    if (!(resolutionKey in RESOLUTIONS)) {
      console.warn(`Unknown resolution: ${resolutionKey}`);
      return;
    }

    this.currentResolution = resolutionKey;
    setResolutionInUrl(resolutionKey);
    this.applyResolution();
  }

  /**
   * Get all available resolution keys
   */
  getAvailableResolutions(): ResolutionKey[] {
    return Object.keys(RESOLUTIONS);
  }

  /**
   * Get config for a resolution
   */
  getResolutionConfig(key: ResolutionKey): ResolutionConfig | undefined {
    return RESOLUTIONS[key];
  }

  /**
   * Register callback for resolution changes
   */
  onChange(callback: (resolution: ResolutionKey, dimensions: { width: number; height: number }) => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      const index = this.onChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.onChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    window.removeEventListener('resize', this.handleWindowResize);
  }

  private applyResolution(): void {
    const dimensions = getCanvasDimensions(this.currentResolution);
    this.canvas.width = dimensions.width;
    this.canvas.height = dimensions.height;

    this.notifyChange();
  }

  private handleWindowResize = (): void => {
    if (this.currentResolution === 'window') {
      this.applyResolution();
    }
  };

  private notifyChange(): void {
    const dimensions = this.getDimensions();
    for (const callback of this.onChangeCallbacks) {
      callback(this.currentResolution, dimensions);
    }
  }
}

/**
 * Calculate aspect ratio
 */
export function getAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Calculate dimensions that fit within a container while maintaining aspect ratio
 */
export function fitWithinContainer(
  contentWidth: number,
  contentHeight: number,
  containerWidth: number,
  containerHeight: number
): { width: number; height: number; scale: number } {
  const contentAspect = contentWidth / contentHeight;
  const containerAspect = containerWidth / containerHeight;

  let scale: number;
  if (contentAspect > containerAspect) {
    // Content is wider - fit to container width
    scale = containerWidth / contentWidth;
  } else {
    // Content is taller - fit to container height
    scale = containerHeight / contentHeight;
  }

  return {
    width: Math.round(contentWidth * scale),
    height: Math.round(contentHeight * scale),
    scale,
  };
}
