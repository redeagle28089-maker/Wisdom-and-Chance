const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

const GAME_URL = 'https://wisdom-and-chance.replit.app';
const APP_DOMAIN = 'wisdom-and-chance.replit.app';

// Domains involved in the Replit OIDC login flow — all must stay inside the window
const ALLOWED_INTERNAL_DOMAINS = [
  APP_DOMAIN,
  'replit.com',
  'auth.replit.com',
  'accounts.google.com',
  'appleid.apple.com',
];

function isAllowedDomain(url) {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_INTERNAL_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith('.' + d)
    );
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'Wisdom & Chance TCG',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Show window once ready to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  // ── OAuth / navigation guard ──────────────────────────────────────────────
  // Allow navigation that stays within the game or the Replit login flow.
  // Redirect everything else (e.g. external links in-game) to the system browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedDomain(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
    // Allowed domains (game + Replit OAuth + Google/Apple) navigate inside the window
  });

  // New windows (target="_blank") — open in system browser, never spawn new Electron windows
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedDomain(url)) {
      // Load allowed URLs inside the current window instead
      win.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // After OAuth callback lands back on the game, make sure the title is correct
  win.webContents.on('page-title-updated', (event, title) => {
    if (!title || title === APP_DOMAIN) {
      win.setTitle('Wisdom & Chance TCG');
      event.preventDefault();
    }
  });

  win.loadURL(GAME_URL);

  // Open DevTools only in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  return win;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Clear any stale cache that might serve old assets
  session.defaultSession.clearCache();

  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS it is conventional to keep the app running until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: prevent new renderer processes from being created with elevated privileges
app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (e) => {
    e.preventDefault();
  });
});
