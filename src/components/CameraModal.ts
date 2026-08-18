/**
 * Camera Modal Component
 * Enforces photo commitment (Section 3.1 & 3.3) with live camera & file fallback
 */

import { CameraService } from '../services/camera';

export interface CameraModalOptions {
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  onPhotoConfirmed: (dataUrl: string) => void;
  onCancelled?: () => void;
}

export class CameraModal {
  private static activeModalElement: HTMLElement | null = null;

  static open(options: CameraModalOptions): void {
    this.close();

    const title = options.title || '実体化トリガー: 写真撮影';
    const subtitle = options.subtitle || '集中をコミットするため、作業対象やデスクを撮影してください';
    const confirmLabel = options.confirmLabel || 'この写真で開始する';

    const modalEl = document.createElement('div');
    modalEl.className = 'modal-backdrop open';
    modalEl.id = 'camera-modal-backdrop';

    modalEl.innerHTML = `
      <div class="modal-content" style="max-height: 95vh; max-height: 95dvh;">
        <div class="modal-header">
          <div>
            <div class="modal-title">${title}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">${subtitle}</div>
          </div>
          <button class="modal-close-btn" id="camera-modal-close" aria-label="閉じる">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; align-items: center;">
          <!-- Camera / Preview Frame -->
          <div class="camera-container" id="camera-frame-box">
            <video class="camera-video" id="camera-live-video" autoplay playsinline muted></video>
            <img class="camera-preview-img" id="camera-captured-img" style="display: none;" alt="撮影写真プレビュー" />
            
            <div class="camera-reticle" id="camera-reticle">
              <div class="camera-reticle-center"></div>
            </div>
          </div>

          <!-- Live Capture Controls Stage -->
          <div id="camera-capture-controls" style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-top: 12px;">
            <div class="camera-controls-row" style="width: 100%;">
              <label for="camera-file-input" class="btn btn-secondary btn-sm" style="cursor: pointer;" id="camera-file-label">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>端末から選択</span>
                <input type="file" id="camera-file-input" accept="image/*" capture="environment" style="display: none;" />
              </label>

              <button class="shutter-btn" id="camera-shutter-btn" aria-label="シャッター">
                <div class="shutter-inner"></div>
              </button>

              <div style="width: 80px;"></div> <!-- Spacer for balance -->
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); text-align: center; margin-top: 6px;">
              ※ シャッターボタンを押して撮影を確定してください
            </div>
          </div>

          <!-- Preview & Confirm Stage (Hidden until photo taken) -->
          <div id="camera-preview-controls" style="width: 100%; display: none; flex-direction: column; gap: 10px; margin-top: 14px;">
            <button class="btn btn-primary btn-lg btn-full" id="camera-confirm-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>${confirmLabel}</span>
            </button>
            
            <button class="btn btn-secondary btn-full" id="camera-retake-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>もう一度撮り直す</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(modalEl);
    this.activeModalElement = modalEl;

    const videoEl = modalEl.querySelector('#camera-live-video') as HTMLVideoElement;
    const imgEl = modalEl.querySelector('#camera-captured-img') as HTMLImageElement;
    const reticleEl = modalEl.querySelector('#camera-reticle') as HTMLElement;
    const captureControls = modalEl.querySelector('#camera-capture-controls') as HTMLElement;
    const previewControls = modalEl.querySelector('#camera-preview-controls') as HTMLElement;
    const shutterBtn = modalEl.querySelector('#camera-shutter-btn') as HTMLButtonElement;
    const fileInput = modalEl.querySelector('#camera-file-input') as HTMLInputElement;
    const retakeBtn = modalEl.querySelector('#camera-retake-btn') as HTMLButtonElement;
    const confirmBtn = modalEl.querySelector('#camera-confirm-btn') as HTMLButtonElement;
    const closeBtn = modalEl.querySelector('#camera-modal-close') as HTMLButtonElement;

    let capturedDataUrl: string | null = null;

    // Start live camera
    CameraService.startCamera(videoEl);

    // Close button
    const handleClose = () => {
      CameraService.stopCamera();
      CameraModal.close();
      if (options.onCancelled) options.onCancelled();
    };
    closeBtn.addEventListener('click', handleClose);

    // Switch to preview mode
    const showPreview = (dataUrl: string) => {
      capturedDataUrl = dataUrl;
      videoEl.style.display = 'none';
      reticleEl.style.display = 'none';
      imgEl.src = dataUrl;
      imgEl.style.display = 'block';

      captureControls.style.display = 'none';
      previewControls.style.display = 'flex';
      CameraService.stopCamera();
    };

    // Switch back to capture mode
    const resetToLive = () => {
      capturedDataUrl = null;
      imgEl.style.display = 'none';
      videoEl.style.display = 'block';
      reticleEl.style.display = 'flex';

      captureControls.style.display = 'flex';
      previewControls.style.display = 'none';
      CameraService.startCamera(videoEl);
    };

    // Shutter button clicked
    shutterBtn.addEventListener('click', () => {
      try {
        const dataUrl = CameraService.captureFromVideo(videoEl);
        showPreview(dataUrl);
      } catch (err) {
        console.error('Capture error:', err);
      }
    });

    // File input fallback
    fileInput.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        try {
          const compressed = await CameraService.compressImageFile(files[0]);
          showPreview(compressed);
        } catch (err) {
          console.error('File compression error:', err);
        }
      }
    });

    // Retake button
    retakeBtn.addEventListener('click', () => {
      resetToLive();
    });

    // Confirm button
    confirmBtn.addEventListener('click', () => {
      if (capturedDataUrl) {
        CameraService.stopCamera();
        CameraModal.close();
        options.onPhotoConfirmed(capturedDataUrl);
      }
    });
  }

  static close(): void {
    CameraService.stopCamera();
    if (this.activeModalElement) {
      this.activeModalElement.remove();
      this.activeModalElement = null;
    }
  }
}
