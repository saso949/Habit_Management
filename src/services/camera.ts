/**
 * Camera Service with automatic Canvas 800x600 compression (Section 6)
 * Supports live getUserMedia stream and file input fallback (ideal for iOS Safari)
 */

export interface CaptureOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<CaptureOptions> = {
  maxWidth: 800,
  maxHeight: 600,
  quality: 0.8,
  format: 'image/jpeg',
};

export class CameraService {
  private static stream: MediaStream | null = null;

  /**
   * Start live camera stream with environment (back) camera priority
   */
  static async startCamera(videoElement: HTMLVideoElement): Promise<boolean> {
    this.stopCamera();

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.stream = stream;
        videoElement.srcObject = stream;
        await videoElement.play();
        return true;
      }
    } catch (err) {
      console.warn('getUserMedia failed or unavailable, using fallback:', err);
    }
    return false;
  }

  /**
   * Stop active camera stream
   */
  static stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Capture a frame from active video element and compress to 800x600
   */
  static captureFromVideo(
    videoElement: HTMLVideoElement,
    options: CaptureOptions = {}
  ): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const canvas = document.createElement('canvas');
    const vw = videoElement.videoWidth > 0 ? videoElement.videoWidth : 640;
    const vh = videoElement.videoHeight > 0 ? videoElement.videoHeight : 480;

    // Calculate aspect ratio fit within maxWidth x maxHeight
    const scale = Math.min(opts.maxWidth / vw, opts.maxHeight / vh, 1);
    const width = Math.round(vw * scale);
    const height = Math.round(vh * scale);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    if (videoElement.videoWidth > 0 && videoElement.readyState >= 2) {
      ctx.drawImage(videoElement, 0, 0, width, height);
    } else {
      // Fallback: draw placeholder committed card
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('実体化トリガー: 集中記録', width / 2, height / 2);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText(new Date().toLocaleString('ja-JP'), width / 2, height / 2 + 36);
    }

    return canvas.toDataURL(opts.format, opts.quality);
  }

  /**
   * Compress an image file using object URL (optimized for iOS Safari memory)
   */
  static async compressImageFile(
    file: File,
    options: CaptureOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        const imgWidth = img.naturalWidth || img.width || 640;
        const imgHeight = img.naturalHeight || img.height || 480;

        const scale = Math.min(opts.maxWidth / imgWidth, opts.maxHeight / imgHeight, 1);
        const width = Math.round(imgWidth * scale);
        const height = Math.round(imgHeight * scale);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context error'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(opts.format, opts.quality));
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image for compression'));
      };

      img.src = objectUrl;
    });
  }
}
