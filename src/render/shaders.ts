/**
 * Shader loading utilities
 */

export interface ShaderSources {
  starVertex: string;
  starFragment: string;
  dilationVertex: string;
  dilationFragment: string;
  copyFragment: string;
  centerBlendFragment: string;
  postprocessVertex: string;
  postprocessFragment: string;
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
 * Resolve shader path with base URL (required for correct resolution when served from subpath e.g. GitHub Pages)
 */
function shaderPath(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${path}`;
}

/**
 * Load all required shaders
 */
export async function loadAllShaders(): Promise<ShaderSources> {
  const [starVertex, starFragment, dilationVertex, dilationFragment, copyFragment, centerBlendFragment, postprocessVertex, postprocessFragment] =
    await Promise.all([
      loadShader(shaderPath('shaders/star.vert')),
      loadShader(shaderPath('shaders/star.frag')),
      loadShader(shaderPath('shaders/dilation.vert')),
      loadShader(shaderPath('shaders/dilation.frag')),
      loadShader(shaderPath('shaders/copy.frag')),
      loadShader(shaderPath('shaders/centerBlend.frag')),
      loadShader(shaderPath('shaders/postprocess.vert')),
      loadShader(shaderPath('shaders/postprocess.frag')),
    ]);

  return {
    starVertex,
    starFragment,
    dilationVertex,
    dilationFragment,
    copyFragment,
    centerBlendFragment,
    postprocessVertex,
    postprocessFragment,
  };
}
