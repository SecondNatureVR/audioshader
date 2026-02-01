/**
 * Canvas capture utilities for snapshots and GIF recording
 */

// GIF.js types (external library)
interface GIFOptions {
  workers: number;
  quality: number;
  workerScript: string;
  width: number;
  height: number;
}

interface GIFInstance {
  addFrame(data: ImageData, options: { delay: number }): void;
  on(event: 'finished', callback: (blob: Blob) => void): void;
  render(): void;
}

declare class GIF implements GIFInstance {
  constructor(options: GIFOptions);
  addFrame(data: ImageData, options: { delay: number }): void;
  on(event: 'finished', callback: (blob: Blob) => void): void;
  render(): void;
}

export interface CaptureConfig {
  maxWidth?: number;
  gifFps?: number;
  gifMaxDuration?: number;
  gifWorkerScript?: string;
  filenamePrefix?: string;
}

const DEFAULT_CONFIG: Required<CaptureConfig> = {
  maxWidth: 720,
  gifFps: 15,
  gifMaxDuration: 10000, // 10 seconds
  gifWorkerScript: 'vendor/gif.worker.js',
  filenamePrefix: 'audioshader',
};

/**
 * Generate timestamp string for filenames
 */
function generateTimestamp(): string {
  const ts = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}`;
}

/**
 * Trigger download of a blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Take a PNG snapshot of a canvas
 */
export function takeSnapshot(canvas: HTMLCanvasElement, filenamePrefix: string = 'snapshot'): void {
  const timestamp = generateTimestamp();
  const filename = `${filenamePrefix}-${timestamp}.png`;

  canvas.toBlob((blob) => {
    if (blob !== null) {
      downloadBlob(blob, filename);
    }
  }, 'image/png');
}

/**
 * GIF Recorder class for capturing animated GIFs from a canvas
 */
export class GifRecorder {
  private canvas: HTMLCanvasElement;
  private config: Required<CaptureConfig>;

  private captureCanvas: HTMLCanvasElement;
  private captureCtx: CanvasRenderingContext2D;
  private captureWidth: number = 0;
  private captureHeight: number = 0;

  private frames: ImageData[] = [];
  private startTime: number = 0;
  private captureTimer: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  private _isRecording: boolean = false;

  private onProgressCallback: ((remainingMs: number) => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, config: CaptureConfig = {}) {
    this.canvas = canvas;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.captureCanvas = document.createElement('canvas');
    const ctx = this.captureCanvas.getContext('2d');
    if (ctx === null) {
      throw new Error('Failed to create 2D context for GIF capture');
    }
    this.captureCtx = ctx;
  }

  /**
   * Check if currently recording
   */
  get isRecording(): boolean {
    return this._isRecording;
  }

  /**
   * Set progress callback (called with remaining milliseconds)
   */
  onProgress(callback: (remainingMs: number) => void): this {
    this.onProgressCallback = callback;
    return this;
  }

  /**
   * Set complete callback (called when recording stops)
   */
  onComplete(callback: () => void): this {
    this.onCompleteCallback = callback;
    return this;
  }

  /**
   * Start recording
   */
  start(): boolean {
    if (this._isRecording) {
      return false;
    }

    this._isRecording = true;
    this.frames = [];
    this.startTime = Date.now();

    // Calculate capture dimensions
    this.captureWidth = Math.min(this.config.maxWidth, this.canvas.width);
    this.captureHeight = Math.round(this.captureWidth * (this.canvas.height / this.canvas.width));
    this.captureCanvas.width = this.captureWidth;
    this.captureCanvas.height = this.captureHeight;

    // Capture first frame
    this.captureFrame();

    // Set up frame capture timer
    const frameInterval = 1000 / this.config.gifFps;
    this.captureTimer = setInterval(() => {
      this.captureFrame();

      if (Date.now() - this.startTime >= this.config.gifMaxDuration) {
        this.stop(true);
      }
    }, frameInterval);

    // Set up countdown timer for progress updates
    this.countdownTimer = setInterval(() => {
      if (!this._isRecording) return;

      const elapsed = Date.now() - this.startTime;
      const remaining = Math.max(0, this.config.gifMaxDuration - elapsed);

      if (this.onProgressCallback !== null) {
        this.onProgressCallback(remaining);
      }
    }, 100);

    return true;
  }

  /**
   * Stop recording and generate GIF
   */
  stop(_autoStop: boolean = false): void {
    if (!this._isRecording) {
      return;
    }

    this._isRecording = false;

    if (this.captureTimer !== null) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }

    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    if (this.onCompleteCallback !== null) {
      this.onCompleteCallback();
    }

    if (this.frames.length < 2) {
      this.frames = [];
      return;
    }

    this.generateGif();
  }

  /**
   * Toggle recording state
   */
  toggle(): boolean {
    if (this._isRecording) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  private captureFrame(): void {
    try {
      this.captureCtx.clearRect(0, 0, this.captureWidth, this.captureHeight);
      this.captureCtx.drawImage(this.canvas, 0, 0, this.captureWidth, this.captureHeight);
      const frame = this.captureCtx.getImageData(0, 0, this.captureWidth, this.captureHeight);
      this.frames.push(frame);
    } catch (err) {
      console.error('GIF capture frame failed', err);
    }
  }

  private generateGif(): void {
    let gif: GIFInstance;

    try {
      gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: this.config.gifWorkerScript,
        width: this.captureWidth,
        height: this.captureHeight,
      });
    } catch (err) {
      console.warn('GIF capture is not supported in this environment.', err);
      this.frames = [];
      return;
    }

    // Create ping-pong loop (forward + reverse for smooth looping)
    const combinedFrames =
      this.frames.length > 2
        ? this.frames.concat(this.frames.slice(1, -1).reverse())
        : this.frames;

    const frameDelay = 1000 / this.config.gifFps;

    for (const frame of combinedFrames) {
      gif.addFrame(frame, { delay: frameDelay });
    }

    gif.on('finished', (blob: Blob) => {
      const timestamp = generateTimestamp();
      const filename = `${this.config.filenamePrefix}-loop-${timestamp}.gif`;
      downloadBlob(blob, filename);
    });

    gif.render();
    this.frames = [];
  }
}

/**
 * ScreenRecorder class for capturing video using MediaRecorder API
 * This is an alternative to GIF that produces smaller, higher quality files
 */
export class ScreenRecorder {
  private canvas: HTMLCanvasElement;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private _isRecording: boolean = false;
  private filenamePrefix: string;

  constructor(canvas: HTMLCanvasElement, filenamePrefix: string = 'audioshader') {
    this.canvas = canvas;
    this.filenamePrefix = filenamePrefix;
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  /**
   * Check if MediaRecorder is supported
   */
  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  }

  /**
   * Start recording
   */
  start(fps: number = 30): boolean {
    if (this._isRecording || !ScreenRecorder.isSupported()) {
      return false;
    }

    try {
      const stream = this.canvas.captureStream(fps);
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event): void => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = (): void => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        const timestamp = generateTimestamp();
        const filename = `${this.filenamePrefix}-${timestamp}.webm`;
        downloadBlob(blob, filename);
        this.chunks = [];
      };

      this.mediaRecorder.start();
      this._isRecording = true;
      return true;
    } catch (err) {
      console.error('Failed to start screen recording', err);
      return false;
    }
  }

  /**
   * Stop recording
   */
  stop(): void {
    if (!this._isRecording || this.mediaRecorder === null) {
      return;
    }

    this.mediaRecorder.stop();
    this._isRecording = false;
    this.mediaRecorder = null;
  }

  /**
   * Toggle recording state
   */
  toggle(): boolean {
    if (this._isRecording) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }
}
