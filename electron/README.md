# Wisdom & Chance TCG — Desktop Client

Electron-based desktop application wrapping the web frontend for distribution on
Steam, Windows, Mac, and Linux. This is the fourth client in the monorepo alongside
`/client` (web), `/server` (backend), and `/mobile` (iOS/Android).

## How It Works

The desktop app loads `https://wisdom-and-chance-2.replit.app` inside an Electron
`BrowserWindow`. All game logic, multiplayer, deck building, and authentication
are handled by the same server that powers the web and mobile clients — no
duplicate code. The only Electron-specific code is:

1. **Window setup** (`main.js`) — creates the window and sets app properties
2. **OAuth guard** (`main.js`) — intercepts navigation to keep login inside the window
3. **Build config** (`package.json`) — `electron-builder` targets for Win/Mac/Linux

## Development

```bash
# From the /electron directory
npm install
npm start
```

This opens a native desktop window pointing at the production server.
The game is fully playable immediately — no local server required.

## Production Builds

```bash
npm run build        # All platforms (requires matching OS for Mac)
npm run build:win    # Windows NSIS installer (.exe)
npm run build:mac    # Mac disk image (.dmg)  — must run on macOS
npm run build:linux  # Linux AppImage (.AppImage)
```

Output files are placed in `/electron/dist/`.

## Icons

Place icon files in `/electron/icons/`:
- `icon.png`  — 512×512 PNG (Linux + fallback)
- `icon.ico`  — Windows icon (256×256 multi-size ICO)
- `icon.icns` — Mac icon bundle

To generate `.ico` and `.icns` from the existing `icon-512.png`:
```bash
# Using ImageMagick (install with: brew install imagemagick)
convert client/public/icon-512.png -resize 256x256 electron/icons/icon.ico
# For .icns use Apple's iconutil or an online converter
```

## Steam Submission

See `STEAM.md` for the four-step manual process to publish on Steam after building.

## Architecture Notes

- The desktop app connects to the **production server** at `wisdom-and-chance-2.replit.app`
- WebSocket multiplayer works identically to the web client (same server endpoint)
- Authentication uses Replit OIDC — the OAuth flow is handled inside the Electron window
  via navigation event interception in `main.js`
- External links (e.g. links opened from within the game UI) are routed to the system browser
