# Wisdom & Chance TCG — Complete Clone Setup Instructions
## For Setting Up an Exact Copy on a New Replit Personal Account
### Prepared: March 16, 2026

---

## OVERVIEW

This document tells you (or your AI agent) exactly how to recreate the Wisdom & Chance web app on a new Replit workspace. The web app serves as both the website AND the backend server for the mobile app.

**What this app is:**
- Full-stack Trading Card Game (React frontend + Express.js backend)
- PostgreSQL database for all persistent data
- WebSocket server for real-time multiplayer
- JWT authentication for mobile app connectivity
- Google/GitHub/email login via Replit Auth (OIDC)
- AI-powered card art generation via Gemini
- PWA (Progressive Web App) for mobile browser

---

## STEP-BY-STEP SETUP INSTRUCTIONS

### STEP 1: Import the Code

**Option A — From GitHub (recommended):**
1. In your new Replit account, click "Create Repl"
2. Choose "Import from GitHub"
3. Paste: `https://github.com/redeagle28089-maker/Wisdom-and-Chance`
4. Set language to Node.js
5. Click Import

**Option B — From ZIP file:**
1. Download the ZIP from the current Replit workspace or GitHub
2. In your new Replit account, click "Create Repl"
3. Upload all files from the ZIP

---

### STEP 2: Install Dependencies

Run in the Shell:
```
npm install
```

This will install all packages listed in `package.json`. If any packages fail, the AI agent should check `package.json` and install them individually.

---

### STEP 3: Set Up PostgreSQL Database

1. In Replit, go to the "Database" tab in the left sidebar
2. Create a new PostgreSQL database — Replit will automatically set the `DATABASE_URL` environment variable
3. After the database is created, run in the Shell:
```
npm run db:push
```
This creates all the database tables from the Drizzle schema.

---

### STEP 4: Restore Database Data

**THIS IS CRITICAL — without this step, you lose all game data (users, cards, images, decks, ratings, etc.)**

There is a SQL backup file in the `backups/` directory. Use the most recent one.

Run in the Shell:
```
psql $DATABASE_URL < backups/full-backup-20260316-005942.sql
```

If that gives errors about existing tables, drop all tables first:
```
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql $DATABASE_URL < backups/full-backup-20260316-005942.sql
```

After restoring, verify the data loaded:
```
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM card_images;"
```

---

### STEP 5: Set Up Environment Secrets

In Replit, go to the "Secrets" tab (lock icon) and add these:

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `SESSION_SECRET` | Generate a random 64-character string | Used for session cookies and JWT signing. Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate one |
| `DATABASE_URL` | (auto-set by Replit) | Already set when you created the PostgreSQL database |

**Replit auto-provides these (do NOT set manually):**
- `REPL_ID` — Replit sets this automatically
- `PORT` — defaults to 5000
- `REPLIT_DOMAINS` — auto-set
- `REPLIT_DEPLOYMENT` — auto-set in production

---

### STEP 6: Set Up Replit Integrations

The app uses two Replit integrations that must be installed in the new workspace:

1. **Log In with Replit (Auth)** — `javascript_log_in_with_replit`
   - This provides Google/GitHub/email authentication
   - Install from Replit's Integrations panel
   - The code is already in `server/replit_integrations/auth/`

2. **Gemini AI Integration** — `javascript_gemini_ai_integrations`
   - This provides the AI for card art generation and deck suggestions
   - Install from Replit's Integrations panel
   - It auto-sets `AI_INTEGRATIONS_GEMINI_API_KEY` and `AI_INTEGRATIONS_GEMINI_BASE_URL`
   - The code is already in `server/replit_integrations/chat/`, `server/replit_integrations/image/`, `server/replit_integrations/batch/`

---

### STEP 7: Configure the Workflow

Create a workflow called "Start application" with this command:
```
npm run dev
```

This starts the Express server on port 5000, which serves both the API backend and the React frontend via Vite.

---

### STEP 8: Verify the App Works

1. Start the workflow
2. Check the console for:
   - `WebSocket server initialized on /ws`
   - `serving on port 5000`
   - `OIDC pre-warming complete`
3. Open the preview URL — you should see the Wisdom & Chance login page
4. Test login with Google/email
5. Check the card database page loads with all cards
6. Check admin access works (login with redeagle28089@gmail.com)

---

### STEP 9: Deploy / Publish

1. Click "Publish" or "Deploy" in Replit
2. The app will get a new public URL like `your-app-name.replit.app`
3. **IMPORTANT: Note this new URL — the mobile app needs to be updated to point to it**

---

### STEP 10: Connect to GitHub

Link to: `https://github.com/redeagle28089-maker/wisdom-and-chance-web`

Or create a new repo and push:
```
git remote add origin https://github.com/redeagle28089-maker/wisdom-and-chance-web.git
git branch -M main
git push -u origin main
```

---

## UPDATING THE MOBILE APP

After the web app is deployed with a new URL, the mobile app needs to point to it.

Tell the mobile app AI:
**"Update the server URL from `wisdom-and-chance.replit.app` to `[YOUR-NEW-URL].replit.app` everywhere in the codebase. This includes API calls, WebSocket connections, and image URLs."**

Key files in the mobile app that reference the server URL:
- API client/service files (base URL for all HTTP requests)
- WebSocket connection setup (wss:// URL)
- Image loading (card art URLs)

---

## COMPLETE FILE STRUCTURE REFERENCE

```
/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/            # All page components
│   │   │   ├── game-board.tsx    # Main game board (practice + multiplayer)
│   │   │   ├── deck-builder.tsx  # Deck building interface
│   │   │   ├── card-database.tsx # Card browser
│   │   │   ├── rules.tsx         # Game rules page
│   │   │   ├── achievements.tsx  # Achievements page
│   │   │   ├── daily-challenges.tsx
│   │   │   ├── leaderboard.tsx
│   │   │   ├── practice.tsx      # Practice mode setup
│   │   │   ├── multiplayer.tsx   # Multiplayer lobby
│   │   │   ├── admin.tsx         # Admin tools
│   │   │   └── ...
│   │   ├── components/       # Shared UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utility libraries
│   │   └── App.tsx           # Router and app shell
│   └── index.html
├── server/                    # Express.js backend
│   ├── index.ts              # Server entry point
│   ├── routes.ts             # All API endpoints
│   ├── storage.ts            # Card/commander data + storage interface
│   ├── gameEngine.ts         # Server-authoritative multiplayer game engine
│   ├── multiplayerRoutes.ts  # Multiplayer API routes
│   ├── websocket.ts          # WebSocket server
│   ├── mobileAuth.ts         # JWT auth for mobile
│   ├── unifiedAuth.ts        # Unified auth middleware (session + JWT)
│   ├── apiDocs.ts            # API documentation endpoint
│   ├── db.ts                 # Database connection
│   ├── vite.ts               # Vite dev server integration
│   └── replit_integrations/  # Replit integration code
│       ├── auth/             # Login with Replit (OIDC)
│       ├── chat/             # Gemini AI for deck suggestions
│       ├── image/            # Gemini AI for card art
│       └── batch/            # Batch AI utilities
├── shared/
│   └── schema.ts             # Database schema + type definitions (Zod + Drizzle)
├── backups/                   # Database backup files
├── public/                    # Static files (manifest.json, sw.js, icons)
├── replit.md                  # Project documentation (IMPORTANT — read this first)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
└── Wisdom_and_Chance_TCG_Feature_Roadmap.md  # Future feature plans
```

---

## DATABASE TABLES REFERENCE

| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, email, name, profile image) |
| `sessions` | Active login sessions |
| `user_decks` | Saved deck configurations |
| `friend_requests` | Pending friend requests |
| `friendships` | Confirmed friendships |
| `friend_messages` | Direct messages between friends (24hr expiry) |
| `game_rooms` | Multiplayer room state |
| `room_spectators` | Spectators in game rooms |
| `chat_messages` | In-game and room chat |
| `player_ratings` | ELO ratings and ranked stats |
| `player_stats` | XP, level, game counts, streaks |
| `achievements` | Achievement definitions |
| `player_achievements` | Player achievement progress |
| `daily_challenges` | Daily challenge definitions |
| `player_challenges` | Player challenge progress |
| `deck_codes` | Shareable deck codes |
| `card_images` | AI-generated card artwork (base64) |
| `card_image_mappings` | Which artwork is assigned to which card |
| `commander_image_mappings` | Which artwork is assigned to which commander |
| `user_presence` | Online/offline/in-game status |
| `matchmaking_queue` | Ranked matchmaking queue |

---

## ENVIRONMENT VARIABLES SUMMARY

| Variable | Source | Required | Purpose |
|----------|--------|----------|---------|
| `DATABASE_URL` | Replit PostgreSQL | Yes | Database connection string |
| `SESSION_SECRET` | Manual (Secrets tab) | Yes | Session cookies + JWT signing |
| `REPL_ID` | Auto (Replit) | Yes | OIDC client ID for auth |
| `REPLIT_DOMAINS` | Auto (Replit) | Yes | Domain for cookie/redirect config |
| `REPLIT_DEPLOYMENT` | Auto (Replit) | No | "1" when deployed, controls production mode |
| `PORT` | Auto/Default | No | Server port (defaults to 5000) |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Replit Integration | No | Gemini AI for card art (admin only) |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Replit Integration | No | Gemini AI base URL |

---

## ADMIN ACCESS

- **Admin email:** redeagle28089@gmail.com
- **Admin sync code:** 4838
- Admin check is hardcoded in `server/routes.ts` (search for `ADMIN_EMAIL`)
- Admin features: card art generation, card stat editing, image management, user management, database export, force-add friends

---

## KEY API ENDPOINTS FOR MOBILE

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/mobile/auth/login` | POST | None | Mobile login (email -> JWT) |
| `/api/mobile/auth/refresh` | POST | Bearer | Refresh JWT token |
| `/api/mobile/auth/me` | GET | Bearer | Get current user |
| `/api/cards` | GET | Any | List all cards |
| `/api/commanders` | GET | Any | List all commanders |
| `/api/cards/:id/image` | GET | Bearer | Download card artwork |
| `/api/commanders/:id/image` | GET | Bearer | Download commander artwork |
| `/api/user-decks` | GET | Bearer | List user's decks |
| `/api/rooms` | GET | Bearer | List game rooms |
| `/api/friends` | GET | Bearer | List friends |
| `/api/leaderboard` | GET | Any | Ranked leaderboard |
| `/api/admin/sync?code=4838` | GET | None | Full data sync for mobile |
| `/api/admin/database-export` | GET | Admin | Export all database tables |
| `/ws?token=<jwt>` | WebSocket | Bearer | Real-time multiplayer |

---

## TROUBLESHOOTING

**"Cannot find module" errors:**
- Run `npm install`

**Database connection errors:**
- Make sure PostgreSQL is provisioned in Replit
- Check that `DATABASE_URL` is set in Secrets

**Auth not working (login redirects fail):**
- Install the "Log In with Replit" integration
- Make sure `REPL_ID` is auto-set (it should be)
- Make sure `SESSION_SECRET` is set in Secrets

**Card images not showing:**
- Restore the database backup (images are stored as base64 in the `card_images` table)
- Run the app and check admin panel -> Image Database

**Gemini AI features not working:**
- Install the "Gemini AI" Replit integration
- This is only needed for admin card art generation — the app works fine without it

**WebSocket connection fails:**
- Make sure the app is deployed (WebSocket needs the public URL)
- Mobile connects via `wss://your-app.replit.app/ws?token=<jwt>`

---

*End of Clone Setup Instructions — Wisdom & Chance TCG v2.2.0*
