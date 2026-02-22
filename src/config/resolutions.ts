/**
 * Resolution configurations for different output targets
 */

import type { ResolutionConfig, ResolutionKey } from '../types';

export const RESOLUTIONS: ResolutionConfig = {
  '4k': { width: 3840, height: 2160, name: '4K UHD' },
  'pc': { width: 1920, height: 1080, name: 'Full HD' },
  'mobile': { width: 1080, height: 1920, name: 'Mobile' },
  'window': { width: null, height: null, name: 'Window Size' },
};

/**
 * Get the current resolution setting from URL parameters
 */
export function getCurrentResolution(): ResolutionKey {
  const urlParams = new URLSearchParams(window.location.search);
  const resolution = urlParams.get('resolution') as ResolutionKey | null;

  if (resolution !== null && resolution in RESOLUTIONS) {
    return resolution;
  }

  return 'window';
}

/**
 * Get URL parameter by name
 */
export function getUrlParam(name: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}
