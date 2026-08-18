/**
 * Bottom Navigation Component
 */

export type TabId = 'dashboard' | 'gallery' | 'analytics' | 'settings';

export class Navbar {
  private container: HTMLElement;
  private activeTab: TabId = 'dashboard';
  private onTabChange: (tab: TabId) => void;

  constructor(container: HTMLElement, onTabChange: (tab: TabId) => void) {
    this.container = container;
    this.onTabChange = onTabChange;
  }

  setActiveTab(tab: TabId): void {
    this.activeTab = tab;
    this.render();
  }

  render(): void {
    this.container.innerHTML = `
      <button class="nav-item ${this.activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard" id="nav-btn-dashboard">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>タスク</span>
      </button>

      <button class="nav-item ${this.activeTab === 'gallery' ? 'active' : ''}" data-tab="gallery" id="nav-btn-gallery">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span>ギャラリー</span>
      </button>

      <button class="nav-item ${this.activeTab === 'analytics' ? 'active' : ''}" data-tab="analytics" id="nav-btn-analytics">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span>分析・記録</span>
      </button>

      <button class="nav-item ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings" id="nav-btn-settings">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span>設定</span>
      </button>
    `;

    this.container.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).dataset.tab as TabId;
        if (target && target !== this.activeTab) {
          this.setActiveTab(target);
          this.onTabChange(target);
        }
      });
    });
  }
}
