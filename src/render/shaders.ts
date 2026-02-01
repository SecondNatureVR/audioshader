/**
 * Shader loading utilities
 */

export interface ShaderSources {
  starVertex: string;
  starFragment: string;
  dilationVertex: string;
  dilationFragment: string;
}

/**
 * Load a shader file from the given path
 */
export async function loadShader(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${path} (${response.status})`);
  }
  return response.text();
}

/**
 * Load all required shaders
 */
export async function loadAllShaders(): Promise<ShaderSources> {
  const [starVertex, starFragment, dilationVertex, dilationFragment] = await Promise.all([
    loadShader('shaders/star.vert'),
    loadShader('shaders/star.frag'),
    loadShader('shaders/dilation.vert'),
    loadShader('shaders/dilation.frag'),
  ]);

  return {
    starVertex,
    starFragment,
    dilationVertex,
    dilationFragment,
  };
}
