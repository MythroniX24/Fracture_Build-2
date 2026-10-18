/**
 * Manages Fullscreen API, Screen Orientation API (landscape lock),
 * and responsive viewport orientation detection with safe fallbacks.
 */

export interface DisplayState {
  isFullscreen: boolean;
  isPortraitMobile: boolean;
  orientationLocked: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

type DisplayListener = (state: DisplayState) => void;

class DisplayManager {
  private listeners = new Set<DisplayListener>();
  private orientationLocked = false;
  private initialized = false;

  private ensureInit(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const notifyAll = () => {
      const state = this.getState();
      for (const listener of this.listeners) {
        listener(state);
      }
    };

    window.addEventListener('resize', notifyAll);
    window.addEventListener('orientationchange', notifyAll);
    document.addEventListener('fullscreenchange', notifyAll);
    document.addEventListener('webkitfullscreenchange', notifyAll);
  }

  public getState(): DisplayState {
    if (typeof window === 'undefined') {
      return {
        isFullscreen: false,
        isPortraitMobile: false,
        orientationLocked: false,
        viewportWidth: 1440,
        viewportHeight: 900,
      };
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
    };
    const isFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
    // Portrait detection on mobile/tablet widths where height exceeds width
    const isPortraitMobile = h > w && w < 960;

    return {
      isFullscreen,
      isPortraitMobile,
      orientationLocked: this.orientationLocked,
      viewportWidth: w,
      viewportHeight: h,
    };
  }

  public subscribe(listener: DisplayListener): () => void {
    this.ensureInit();
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Requests fullscreen and attempts to lock screen orientation to landscape.
   * Must be invoked inside a direct user gesture handler (e.g., Play / Start Match button click).
   */
  public async enterCombatDisplayMode(): Promise<void> {
    if (typeof window === 'undefined') return;
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    if (isHeadless) return;

    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };

      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Browser or iframe policy may decline fullscreen; continue gracefully
    }

    await this.lockLandscape();
  }

  public async lockLandscape(): Promise<boolean> {
    if (typeof window === 'undefined' || !('screen' in window)) return false;
    try {
      const scr = window.screen as Screen & {
        orientation?: ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        };
      };
      if (scr.orientation && typeof scr.orientation.lock === 'function') {
        await scr.orientation.lock('landscape');
        this.orientationLocked = true;
        return true;
      }
    } catch {
      // Orientation lock not supported on desktop or restricted by browser
    }
    return false;
  }

  public unlockOrientation(): void {
    if (typeof window === 'undefined' || !('screen' in window)) return;
    try {
      const scr = window.screen as Screen & {
        orientation?: ScreenOrientation & {
          unlock?: () => void;
        };
      };
      if (scr.orientation && typeof scr.orientation.unlock === 'function') {
        scr.orientation.unlock();
      }
    } catch {
      // Ignore
    }
    this.orientationLocked = false;
  }

  public async toggleFullscreen(): Promise<void> {
    if (typeof document === 'undefined') return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    try {
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        this.unlockOrientation();
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
        await this.lockLandscape();
      }
    } catch {
      // Ignore fullscreen permission errors in restricted contexts
    }
  }

  public async exitCombatDisplayMode(): Promise<void> {
    this.unlockOrientation();
  }
}

export const displayManager = new DisplayManager();
