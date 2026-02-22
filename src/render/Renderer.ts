/**
 * WebGL Renderer for AudioShader
 * Handles shader compilation, framebuffer management, and rendering pipeline
 */

import { RESOLUTIONS, getCurrentResolution } from '../config/resolutions';
import { hexToRgb } from '../config/colorPalette';
import type { ResolutionKey, BlendMode, ColorPalette } from '../types';

export interface RenderUniforms {
  u_time: number;
  u_spikiness: number;
  u_spikeFrequency: number;
  u_spikeSharpness: number;
  u_hue: number;
  u_scale: number;
  u_rotation: number;
  u_autoRotationSpeed: number;
  u_blendOpacity: number;
  u_fillSize: number;
  u_fillOpacity: number;
  u_strokeWeight: number;
  u_strokeOpacity: number;
  u_strokeGlow: number;
}

export interface RenderOptions {
  uniforms: RenderUniforms;
  dilationFactor: number;
  shouldCaptureShape: boolean;
  fadeAmount: number;
  hueShiftAmount: number;
  emanationRate: number;
  noiseAmount: number;
  noiseRate: number;
  blurAmount: number;
  blurRate: number;
  rotation: number;
  blendMode: BlendMode;
  blendOpacity: number;
  autoRotationSpeed: number;
  totalRotation: number;
  fishbowlShape: number;
  fishbowlDilation: number;
  radialPowerShape: number;
  radialPowerDilation: number;
  kaleidoscopeSections: number;
  tunnelStrength: number;
  colorPalette: ColorPalette;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private dilationProgram: WebGLProgram | null = null;
  private copyProgram: WebGLProgram | null = null;
  private centerBlendProgram: WebGLProgram | null = null;
  private postprocessProgram: WebGLProgram | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private historyTexture: WebGLTexture | null = null;
  private historyFramebuffer: WebGLFramebuffer | null = null;
  private currentTexture: WebGLTexture | null = null;
  private currentFramebuffer: WebGLFramebuffer | null = null;
  private compositeTexture: WebGLTexture | null = null;
  private compositeFramebuffer: WebGLFramebuffer | null = null;
  private currentResolution: ResolutionKey;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.currentResolution = getCurrentResolution();

    const gl = canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const res = RESOLUTIONS[this.currentResolution];
    if (res.width !== null && res.height !== null) {
      this.canvas.width = res.width;
      this.canvas.height = res.height;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    if (this.historyTexture !== null && this.currentTexture !== null && this.compositeTexture !== null) {
      this.setupFramebuffers();
    }
  }

  setResolution(resolution: ResolutionKey): void {
    this.currentResolution = resolution;
    this.resize();
  }

  private setupFramebuffers(): void {
    const gl = this.gl;

    // Clean up existing textures and framebuffers
    if (this.historyTexture !== null) {
      gl.deleteTexture(this.historyTexture);
    }
    if (this.historyFramebuffer !== null) {
      gl.deleteFramebuffer(this.historyFramebuffer);
    }
    if (this.currentTexture !== null) {
      gl.deleteTexture(this.currentTexture);
    }
    if (this.currentFramebuffer !== null) {
      gl.deleteFramebuffer(this.currentFramebuffer);
    }

    // Create history texture and framebuffer
    this.historyTexture = gl.createTexture();
    if (this.historyTexture === null) {
      throw new Error('Failed to create history texture');
    }
    gl.bindTexture(gl.TEXTURE_2D, this.historyTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.canvas.width,
      this.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.historyFramebuffer = gl.createFramebuffer();
    if (this.historyFramebuffer === null) {
      throw new Error('Failed to create history framebuffer');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.historyFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.historyTexture,
      0
    );

    // Create current texture and framebuffer
    this.currentTexture = gl.createTexture();
    if (this.currentTexture === null) {
      throw new Error('Failed to create current texture');
    }
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.canvas.width,
      this.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.currentFramebuffer = gl.createFramebuffer();
    if (this.currentFramebuffer === null) {
      throw new Error('Failed to create current framebuffer');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.currentTexture,
      0
    );

    // Create composite texture and framebuffer (for texture + star before post-process)
    this.compositeTexture = gl.createTexture();
    if (this.compositeTexture === null) {
      throw new Error('Failed to create composite texture');
    }
    gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.canvas.width,
      this.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.compositeFramebuffer = gl.createFramebuffer();
    if (this.compositeFramebuffer === null) {
      throw new Error('Failed to create composite framebuffer');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.compositeTexture,
      0
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private compileShader(source: string, type: number): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (shader === null) {
      throw new Error('Failed to create shader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${info ?? 'unknown error'}`);
    }

    return shader;
  }

  async init(
    vertexSource: string,
    fragmentSource: string,
    dilationVertexSource: string,
    dilationFragmentSource: string,
    copyFragmentSource: string,
    centerBlendFragmentSource: string,
    postprocessVertexSource: string,
    postprocessFragmentSource: string
  ): Promise<void> {
    const gl = this.gl;

    // Compile shape shader program
    const vertexShader = this.compileShader(vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);

    this.program = gl.createProgram();
    if (this.program === null) {
      throw new Error('Failed to create shape program');
    }
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (gl.getProgramParameter(this.program, gl.LINK_STATUS) !== true) {
      const info = gl.getProgramInfoLog(this.program);
      throw new Error(`Program linking error: ${info ?? 'unknown error'}`);
    }

    // Compile dilation shader program
    const dilationVertexShader = this.compileShader(dilationVertexSource, gl.VERTEX_SHADER);
    const dilationFragmentShader = this.compileShader(dilationFragmentSource, gl.FRAGMENT_SHADER);

    this.dilationProgram = gl.createProgram();
    if (this.dilationProgram === null) {
      throw new Error('Failed to create dilation program');
    }
    gl.attachShader(this.dilationProgram, dilationVertexShader);
    gl.attachShader(this.dilationProgram, dilationFragmentShader);
    gl.linkProgram(this.dilationProgram);

    if (gl.getProgramParameter(this.dilationProgram, gl.LINK_STATUS) !== true) {
      const info = gl.getProgramInfoLog(this.dilationProgram);
      throw new Error(`Dilation program linking error: ${info ?? 'unknown error'}`);
    }

    // Compile copy shader program (reuses dilation vertex)
    const copyFragmentShader = this.compileShader(copyFragmentSource, gl.FRAGMENT_SHADER);

    this.copyProgram = gl.createProgram();
    if (this.copyProgram === null) {
      throw new Error('Failed to create copy program');
    }
    gl.attachShader(this.copyProgram, dilationVertexShader);
    gl.attachShader(this.copyProgram, copyFragmentShader);
    gl.linkProgram(this.copyProgram);

    if (gl.getProgramParameter(this.copyProgram, gl.LINK_STATUS) !== true) {
      const info = gl.getProgramInfoLog(this.copyProgram);
      throw new Error(`Copy program linking error: ${info ?? 'unknown error'}`);
    }

    // Compile center blend shader program (reuses dilation vertex)
    const centerBlendFragmentShader = this.compileShader(centerBlendFragmentSource, gl.FRAGMENT_SHADER);

    this.centerBlendProgram = gl.createProgram();
    if (this.centerBlendProgram === null) {
      throw new Error('Failed to create center blend program');
    }
    gl.attachShader(this.centerBlendProgram, dilationVertexShader);
    gl.attachShader(this.centerBlendProgram, centerBlendFragmentShader);
    gl.linkProgram(this.centerBlendProgram);

    if (gl.getProgramParameter(this.centerBlendProgram, gl.LINK_STATUS) !== true) {
      const info = gl.getProgramInfoLog(this.centerBlendProgram);
      throw new Error(`Center blend program linking error: ${info ?? 'unknown error'}`);
    }

    // Compile postprocess shader program
    const postprocessVertexShader = this.compileShader(postprocessVertexSource, gl.VERTEX_SHADER);
    const postprocessFragmentShader = this.compileShader(postprocessFragmentSource, gl.FRAGMENT_SHADER);

    this.postprocessProgram = gl.createProgram();
    if (this.postprocessProgram === null) {
      throw new Error('Failed to create postprocess program');
    }
    gl.attachShader(this.postprocessProgram, postprocessVertexShader);
    gl.attachShader(this.postprocessProgram, postprocessFragmentShader);
    gl.linkProgram(this.postprocessProgram);

    if (gl.getProgramParameter(this.postprocessProgram, gl.LINK_STATUS) !== true) {
      const info = gl.getProgramInfoLog(this.postprocessProgram);
      throw new Error(`Postprocess program linking error: ${info ?? 'unknown error'}`);
    }

    // Setup full-screen quad buffer
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    this.quadBuffer = gl.createBuffer();
    if (this.quadBuffer === null) {
      throw new Error('Failed to create quad buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Setup position attributes
    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const dilationPositionLocation = gl.getAttribLocation(this.dilationProgram, 'a_position');
    gl.enableVertexAttribArray(dilationPositionLocation);
    gl.vertexAttribPointer(dilationPositionLocation, 2, gl.FLOAT, false, 0, 0);

    // Setup framebuffers
    this.setupFramebuffers();

    // Clear history texture to black
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.historyFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(this.program);
  }

  private setUniform(
    name: string,
    value: number | [number, number] | [number, number, number],
    program: WebGLProgram | null = null
  ): void {
    const gl = this.gl;
    const targetProgram = program ?? this.program;
    if (targetProgram === null) return;

    const location = gl.getUniformLocation(targetProgram, name);
    if (location === null) return;

    if (typeof value === 'number') {
      gl.uniform1f(location, value);
    } else if (Array.isArray(value)) {
      if (value.length === 2) {
        gl.uniform2f(location, value[0], value[1]);
      } else if (value.length === 3) {
        gl.uniform3f(location, value[0], value[1], value[2]);
      }
    }
  }

  private setPaletteUniforms(palette: ColorPalette): void {
    const gl = this.gl;
    if (this.program === null) return;
    gl.useProgram(this.program);
    this.setUniform('u_hueMin', palette.hueMin);
    this.setUniform('u_hueMax', palette.hueMax);
    this.setUniform('u_saturation', palette.saturation);
    this.setUniform('u_value', palette.value);
    const colors = palette.dominantColors.filter((c) => c.length > 0);
    this.setUniform('u_dominantCount', colors.length);
    const rgb = (hex: string) => hexToRgb(hex);
    this.setUniform('u_color0', colors[0] ? rgb(colors[0]) : [1, 1, 1]);
    this.setUniform('u_color1', colors[1] ? rgb(colors[1]) : [1, 1, 1]);
    this.setUniform('u_color2', colors[2] ? rgb(colors[2]) : [1, 1, 1]);
    this.setUniform('u_color3', colors[3] ? rgb(colors[3]) : [1, 1, 1]);
    this.setUniform('u_color4', colors[4] ? rgb(colors[4]) : [1, 1, 1]);
  }

  private setBlendMode(mode: BlendMode, _opacity: number): void {
    const gl = this.gl;

    switch (mode) {
      case 'additive':
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.blendEquation(gl.FUNC_ADD);
        break;
      case 'alpha':
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);
        break;
      case 'multiply':
        gl.blendFunc(gl.DST_COLOR, gl.ZERO);
        gl.blendEquation(gl.FUNC_ADD);
        break;
      case 'screen':
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        gl.blendEquation(gl.FUNC_ADD);
        break;
      case 'overlay':
        gl.blendFunc(gl.DST_COLOR, gl.ONE);
        gl.blendEquation(gl.FUNC_ADD);
        break;
      default:
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.blendEquation(gl.FUNC_ADD);
    }
  }

  render(options: RenderOptions): void {
    const gl = this.gl;

    if (
      this.program === null ||
      this.dilationProgram === null ||
      this.copyProgram === null ||
      this.centerBlendProgram === null ||
      this.postprocessProgram === null ||
      this.quadBuffer === null ||
      this.compositeFramebuffer === null
    ) {
      throw new Error('Renderer not initialized');
    }

    const dilationPositionLocation = gl.getAttribLocation(this.dilationProgram, 'a_position');
    const shapePositionLocation = gl.getAttribLocation(this.program, 'a_position');

    const centerX = Math.floor(this.canvas.width / 2);
    const centerY = Math.floor(this.canvas.height / 2);

    // Step 1: Dilation pass - expand history texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.dilationProgram);

    gl.enableVertexAttribArray(dilationPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(dilationPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.historyTexture);
    const dilationHistoryLocation = gl.getUniformLocation(this.dilationProgram, 'u_history');
    gl.uniform1i(dilationHistoryLocation, 0);

    this.setUniform('u_expansionFactor', options.dilationFactor, this.dilationProgram);
    this.setUniform('u_fadeAmount', options.fadeAmount, this.dilationProgram);
    this.setUniform('u_hueShiftAmount', options.hueShiftAmount, this.dilationProgram);
    this.setUniform('u_fishbowlDilation', options.fishbowlDilation, this.dilationProgram);
    this.setUniform('u_radialPowerDilation', options.radialPowerDilation, this.dilationProgram);
    this.setUniform('u_noiseAmount', options.noiseAmount, this.dilationProgram);
    this.setUniform('u_noiseRate', options.noiseRate, this.dilationProgram);
    this.setUniform('u_blurAmount', options.blurAmount, this.dilationProgram);
    this.setUniform('u_blurRate', options.blurRate, this.dilationProgram);
    this.setUniform('u_time', options.uniforms.u_time, this.dilationProgram);
    this.setUniform('u_resolution', [this.canvas.width, this.canvas.height], this.dilationProgram);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Copy current to composite (needed so we can read from it for center blend without read-write conflict)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.copyProgram!);
    const copyPositionLocation = gl.getAttribLocation(this.copyProgram!, 'a_position');
    gl.enableVertexAttribArray(copyPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(copyPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture);
    const copyInputLocation = gl.getUniformLocation(this.copyProgram!, 'u_input');
    gl.uniform1i(copyInputLocation, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Clear center on current, then draw blended center (reads from composite copy)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(centerX - 1, centerY - 1, 2, 2);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw blended center (average of neighbors from composite) so it blends into image
    gl.useProgram(this.centerBlendProgram!);
    const centerBlendPositionLocation = gl.getAttribLocation(this.centerBlendProgram!, 'a_position');
    gl.enableVertexAttribArray(centerBlendPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(centerBlendPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
    const centerBlendInputLocation = gl.getUniformLocation(this.centerBlendProgram!, 'u_input');
    gl.uniform1i(centerBlendInputLocation, 0);
    this.setUniform('u_resolution', [this.canvas.width, this.canvas.height], this.centerBlendProgram!);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);

    // Step 2: Draw current shape (only if capturing)
    if (options.shouldCaptureShape) {
      gl.useProgram(this.program);
      gl.enableVertexAttribArray(shapePositionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.vertexAttribPointer(shapePositionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      this.setBlendMode(options.blendMode, options.blendOpacity);

      for (const [name, value] of Object.entries(options.uniforms)) {
        this.setUniform(name, value);
      }
      this.setUniform('u_resolution', [this.canvas.width, this.canvas.height]);
      this.setUniform('u_rotation', options.totalRotation);
      this.setUniform('u_autoRotationSpeed', 0.0);
      this.setUniform('u_blendOpacity', options.blendOpacity);
      this.setUniform('u_fishbowlShape', options.fishbowlShape);
      this.setUniform('u_radialPowerShape', options.radialPowerShape);
      this.setPaletteUniforms(options.colorPalette);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.BLEND);
    }

    // Step 3: Composite texture + star into composite framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.dilationProgram);
    gl.enableVertexAttribArray(dilationPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(dilationPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture);
    gl.uniform1i(dilationHistoryLocation, 0);
    this.setUniform('u_expansionFactor', 1.0, this.dilationProgram);
    this.setUniform('u_fishbowlDilation', 0, this.dilationProgram);
    this.setUniform('u_radialPowerDilation', 1.0, this.dilationProgram);
    this.setUniform('u_resolution', [this.canvas.width, this.canvas.height], this.dilationProgram);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Step 4: Draw current star on composite
    gl.useProgram(this.program);
    gl.enableVertexAttribArray(shapePositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(shapePositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    this.setBlendMode(options.blendMode, options.blendOpacity);

    for (const [name, value] of Object.entries(options.uniforms)) {
      this.setUniform(name, value);
    }
    this.setUniform('u_resolution', [this.canvas.width, this.canvas.height]);
    this.setUniform('u_rotation', options.rotation);
    this.setUniform('u_autoRotationSpeed', options.autoRotationSpeed);
    this.setUniform('u_blendOpacity', options.blendOpacity);
    this.setUniform('u_fishbowlShape', options.fishbowlShape);
    this.setUniform('u_radialPowerShape', options.radialPowerShape);
    this.setPaletteUniforms(options.colorPalette);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);

    // Step 5: Post-process composite to screen (kaleidoscope only; fishbowl is in shape + dilation)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.postprocessProgram);
    const postprocessPositionLocation = gl.getAttribLocation(this.postprocessProgram, 'a_position');
    gl.enableVertexAttribArray(postprocessPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(postprocessPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.compositeTexture);
    const postprocessInputLocation = gl.getUniformLocation(this.postprocessProgram, 'u_input');
    gl.uniform1i(postprocessInputLocation, 0);
    this.setUniform('u_resolution', [this.canvas.width, this.canvas.height], this.postprocessProgram);
    this.setUniform('u_kaleidoscopeSections', options.kaleidoscopeSections, this.postprocessProgram);
    this.setUniform('u_tunnelStrength', options.tunnelStrength, this.postprocessProgram);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Step 6: Copy current texture to history
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.historyFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.dilationProgram);
    gl.enableVertexAttribArray(dilationPositionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(dilationPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture);
    gl.uniform1i(dilationHistoryLocation, 0);
    this.setUniform('u_expansionFactor', 1.0, this.dilationProgram);
    this.setUniform('u_fishbowlDilation', 0, this.dilationProgram);
    this.setUniform('u_radialPowerDilation', 1.0, this.dilationProgram);
    this.setUniform('u_resolution', [this.canvas.width, this.canvas.height], this.dilationProgram);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getContext(): WebGLRenderingContext {
    return this.gl;
  }

  /**
   * Read pixels from the default framebuffer (canvas).
   * Call after render() when the final image is on screen.
   * Reads center region; WebGL origin is bottom-left.
   */
  readPixels(x: number, y: number, width: number, height: number): Uint8Array {
    const gl = this.gl;
    const buffer = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    return buffer;
  }

  /**
   * Read center region of the canvas for visual analysis.
   * Returns RGBA pixels, or null if canvas too small.
   */
  readPixelsCenter(sampleWidth: number = 64, sampleHeight: number = 64): Uint8Array | null {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w < sampleWidth || h < sampleHeight) return null;
    const x = Math.floor((w - sampleWidth) / 2);
    const y = Math.floor((h - sampleHeight) / 2);
    return this.readPixels(x, y, sampleWidth, sampleHeight);
  }

  /**
   * Clear the history buffer (reset visual trails)
   */
  clearHistory(): void {
    const gl = this.gl;

    // Clear history framebuffer
    if (this.historyFramebuffer !== null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.historyFramebuffer);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Clear current framebuffer
    if (this.currentFramebuffer !== null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFramebuffer);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
