/**
 * Daily Progress Photo Gallery View (Section 3.5)
 * Visual timeline of physical anchor trigger and check-in photos
 */

import { getTasksForDate } from '../db/db';
import { AnalyticsService } from '../services/analytics';
import type { TaskPhoto } from '../db/types';
import { formatLocalTime, formatLocalDateTime, formatLocalDate } from '../utils/date';

interface GalleryItem {
  photo: TaskPhoto;
  taskTitle: string;
  taskTag: string;
}

export class GalleryView {
  private container: HTMLElement;
  private selectedDate: string;

  constructor(container: HTMLElement) {
    this.container = container;
    this.selectedDate = AnalyticsService.getLocalDateString();
  }

  async render(): Promise<void> {
    const tasks = await getTasksForDate(this.selectedDate);

    // Extract and sort all photos by timestamp
    const galleryItems: GalleryItem[] = [];
    for (const task of tasks) {
      if (task.photos && task.photos.length > 0) {
        for (const photo of task.photos) {
          galleryItems.push({
            photo,
            taskTitle: task.title,
            taskTag: task.tag,
          });
        }
      }
    }

    galleryItems.sort((a, b) => new Date(a.photo.timestamp).getTime() - new Date(b.photo.timestamp).getTime());

    this.container.innerHTML = `
      <!-- Gallery Header & Date Selector -->
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div>
            <h1 style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary);">📸 進捗フォトギャラリー</h1>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
              実体化トリガーと集中チェックインの視覚的記録
            </p>
          </div>
          <span class="section-badge" style="font-size: 0.82rem; padding: 4px 10px;">${galleryItems.length}枚</span>
        </div>

        <!-- Date Navigator -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <button class="btn-icon-only" id="gallery-prev-date-btn" aria-label="前日">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <input type="date" id="gallery-date-picker" value="${this.selectedDate}" style="background: transparent; border: none; font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem; text-align: center; width: auto; color: var(--text-primary);" />

          <button class="btn-icon-only" id="gallery-next-date-btn" aria-label="翌日">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <!-- Photo Grid / Timeline -->
      ${
        galleryItems.length === 0
          ? `
        <div class="empty-state" style="padding: 48px 16px;">
          <div class="empty-state-icon" style="font-size: 2.5rem;">📸</div>
          <div class="empty-state-title">この日の写真記録はありません</div>
          <div class="empty-state-desc">タスク開始時やチェックイン時に写真撮影を行うとここに記録されます</div>
        </div>
      `
          : `
        <div class="gallery-grid">
          ${galleryItems
            .map(
              (item, idx) => `
            <div class="gallery-card" data-index="${idx}">
              <img src="${item.photo.data_url}" class="gallery-card-img" alt="${item.taskTitle}" />
              <div class="gallery-card-body">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <span class="tag-badge" style="font-size: 0.65rem;">${item.taskTag}</span>
                  <span class="gallery-card-time">${formatLocalTime(item.photo.timestamp)}</span>
                </div>
                <div class="gallery-card-title">${item.taskTitle}</div>
                <div style="font-size: 0.7rem; color: ${item.photo.type === 'start' ? 'var(--accent-primary)' : 'var(--accent-cyan)'}; font-weight: 600;">
                  ${item.photo.type === 'start' ? '🟢 開始トリガー' : '🔵 進捗チェックイン'}
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
      }
    `;

    this.bindEvents(galleryItems);
  }

  private bindEvents(galleryItems: GalleryItem[]): void {
    const datePicker = this.container.querySelector('#gallery-date-picker') as HTMLInputElement;
    const prevBtn = this.container.querySelector('#gallery-prev-date-btn') as HTMLButtonElement;
    const nextBtn = this.container.querySelector('#gallery-next-date-btn') as HTMLButtonElement;

    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        this.selectedDate = (e.target as HTMLInputElement).value;
        this.render();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const [y, m, d] = this.selectedDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d - 1);
        this.selectedDate = formatLocalDate(dateObj);
        this.render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const [y, m, d] = this.selectedDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d + 1);
        this.selectedDate = formatLocalDate(dateObj);
        this.render();
      });
    }

    // Lightbox modal on image click
    this.container.querySelectorAll('.gallery-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).dataset.index);
        const item = galleryItems[idx];
        if (!item) return;

        this.openLightbox(item);
      });
    });
  }

  private openLightbox(item: GalleryItem): void {
    const modalEl = document.createElement('div');
    modalEl.className = 'modal-backdrop open';
    modalEl.id = 'lightbox-modal';

    modalEl.innerHTML = `
      <div class="modal-content" style="background: rgba(10, 12, 18, 0.95);">
        <div class="modal-header">
          <div>
            <div class="modal-title">${item.taskTitle}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${item.photo.type === 'start' ? '開始時トリガー写真' : '進捗チェックイン写真'} (${formatLocalDateTime(item.photo.timestamp)})</div>
          </div>
          <button class="modal-close-btn" id="lightbox-close" aria-label="閉じる">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="padding: 16px; display: flex; justify-content: center; align-items: center;">
          <img src="${item.photo.data_url}" style="width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-md); border: 1px solid var(--border-medium);" alt="拡大写真" />
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(modalEl);

    const closeBtn = modalEl.querySelector('#lightbox-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => modalEl.remove());
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) modalEl.remove();
    });
  }
}
