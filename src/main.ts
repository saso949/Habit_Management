/**
 * App Entry Point & Router Bootstrap
 */

import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/focus-mode.css';

import { initDb, getAllTasks } from './db/db';
import { Navbar, type TabId } from './components/Navbar';
import { DashboardView } from './views/DashboardView';
import { GalleryView } from './views/GalleryView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { FocusTimerService } from './services/timer';
import { FocusScreen } from './components/FocusScreen';
import { SoundService } from './services/sound';
import { NotificationService } from './services/notification';

class App {
  private mainContent: HTMLElement;
  private bottomNav: HTMLElement;
  private navbar!: Navbar;
  private currentTab: TabId = 'dashboard';

  private dashboardView!: DashboardView;
  private galleryView!: GalleryView;
  private analyticsView!: AnalyticsView;
  private settingsView!: SettingsView;

  constructor() {
    this.mainContent = document.getElementById('main-content') as HTMLElement;
    this.bottomNav = document.getElementById('bottom-nav') as HTMLElement;
  }

  async init(): Promise<void> {
    // 1. Initialize IndexedDB
    await initDb();

    // 2. Instantiate Views
    this.dashboardView = new DashboardView(this.mainContent);
    this.galleryView = new GalleryView(this.mainContent);
    this.analyticsView = new AnalyticsView(this.mainContent);
    this.settingsView = new SettingsView(this.mainContent);

    // 3. Initialize Navbar
    this.navbar = new Navbar(this.bottomNav, (tab) => {
      this.switchTab(tab);
    });
    this.navbar.render();

    // 4. Initial View Render
    await this.renderCurrentView();

    // 5. Check if there is an active running session to resume
    const activeTask = await FocusTimerService.resumeIfActive();
    if (activeTask) {
      FocusScreen.mount(activeTask);
    }

    // 5.1 Schedule best-effort start notifications for all pending scheduled tasks
    const allTasks = await getAllTasks();
    const pendingScheduled = allTasks.filter((t) => t.type === 'scheduled' && t.status === 'pending');
    for (const task of pendingScheduled) {
      NotificationService.scheduleTaskStartNotification(task, () => {
        this.renderCurrentView();
      });
    }

    // 6. Global Audio Unlock on first interaction
    const unlockHandler = () => {
      SoundService.unlockAudio();
      window.removeEventListener('click', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
    };
    window.addEventListener('click', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });

    // 7. Event listeners for global refresh
    window.addEventListener('task-state-changed', () => {
      this.renderCurrentView();
    });

    // 8. Register Service Worker for PWA
    this.registerServiceWorker();
  }

  async switchTab(tab: TabId): Promise<void> {
    this.currentTab = tab;
    this.navbar.setActiveTab(tab);
    await this.renderCurrentView();
  }

  async renderCurrentView(): Promise<void> {
    switch (this.currentTab) {
      case 'dashboard':
        await this.dashboardView.render();
        break;
      case 'gallery':
        await this.galleryView.render();
        break;
      case 'analytics':
        await this.analyticsView.render();
        break;
      case 'settings':
        await this.settingsView.render();
        break;
    }
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('CommitHabit ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('ServiceWorker registration error (normal in dev):', err);
          });
      });
    }
  }
}

// Bootstrap on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch((err) => console.error('App bootstrap error:', err));
});
