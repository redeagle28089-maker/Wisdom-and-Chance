# Wisdom & Chance TCG

## Overview
A tactical trading card game simulator built with React, Express, and TypeScript. Master elemental powers, build strategic decks, and battle against AI opponents or other players online.

**Purpose:** Card game simulator with deck building, practice battles, and real-time multiplayer.

**Current State:** Fully functional TCG with Google authentication, multiplayer rooms, friend system, and real-time gameplay.

## Recent Changes
- **January 2026:** Combat System Fixes & Combat Log
  - Fixed AI combat calculation bug (AI was calculating 0 power for all cards)
  - Card instance IDs (format: cardId::N) now properly resolved to base card IDs
  - AI now draws and deploys cards simultaneously with player in practice mode
  - Combat log button prominently placed with "View Combat Log" text and amber styling
  - Combat log persisted in game.gameState.lastCombatLog (survives re-renders)
  - Combat log dialog shows: card name, base power, trait bonuses, buff/debuff modifiers, final power

- **January 2026:** New Pages & Card Database Enhancement
  - Card tiles now display unique fantasy names above UNIT label
  - Analytics Dashboard with stats, element performance, charts
  - Live Matches Browser for spectating ongoing games
  - Lore Archives with World History, Elements, and Commander backstories
  - Sidebar updated with Analytics, Live Matches, and Lore sections

- **January 2026:** User Deck Persistence
  - Save decks to your account (persists in PostgreSQL database)
  - "My Decks" button shows all saved decks with load/delete options
  - Edit existing decks with "Update Deck" functionality
  - Create new decks from saved decks dialog
  - Deck validation before save (40 cards, proper power distribution)

- **January 2026:** AI Deck Suggestion System
  - AI-powered deck builder using Gemini 2.5 Flash model
  - Select commander and playstyle (Aggressive/Defensive/Balanced)
  - AI generates complete 40-card deck recommendations
  - One-click apply to populate deck with AI suggestions
  - Validates deck constraints (4 cards per power rank, max 3 copies)

- **January 2026:** Admin Card Art Generator
  - AI-powered card art generation using Gemini 2.5 Flash Image model
  - Admin-only access restricted to redeagle28089@gmail.com
  - Generate custom artwork for unit cards and commanders
  - Element-specific art prompts (Fire, Water, Earth, Air, Nature)
  - Save generated art directly to cards/commanders
  - Cards now support custom imageUrl with fallback to default element art

- **January 2026:** Engagement & Progression Systems
  - Achievement system with 22 unlockable achievements across 5 categories
  - Daily challenges with rotating quests and XP rewards
  - Global leaderboard with ELO rating tiers (Bronze/Silver/Gold/Platinum/Diamond/Master)
  - Quick emotes in game chat (GG, Nice!, Thanks, Thinking, Hurry!, Sorry)
  - Deck sharing with import/export codes

- **January 2026:** WebSocket Security Hardening
  - Session-based WebSocket authentication (validates cookies on connection)
  - Authorization checks for room joining (host, guest, or spectator)
  - Authorization checks for game joining (player1 or player2 only)
  - Removed insecure client-side userId auth mechanism

- **January 2026:** Full Multiplayer System
  - Game lobby to browse and create rooms
  - Real-time WebSocket communication (/ws endpoint)
  - Room waiting area with deck selection and ready system
  - In-game chat for player communication
  - Spectator mode for watching matches
  - Friend system with requests, online status tracking

- **January 2026:** Google Authentication Integration
  - Replit Auth with Google/GitHub/email login via OIDC
  - PostgreSQL database for user accounts and sessions
  - Protected pages: Practice, Deck Builder, Profile require login
  - User data persists across sessions
  - Profile shows authenticated user info and stats

- **January 2026:** Complete TCG implementation
  - 5 elements: Fire, Water, Earth, Air, Nature
  - 200 seeded cards (40 per element, powers 1-10)
  - 5 commanders with unique abilities
  - Full deck building with 40-card validation
  - Practice mode with AI opponent (Easy/Medium/Hard difficulty)
  - Turn-based battle system with 5 phases
  - Game history and replay viewing
  - Tutorial page for new players
  - Player profile with stats tracking

## Game Rules

### Deck Construction
- 40 unit cards total
- Exactly 4 cards of each power rank (1-10)
- Maximum 3 copies of any single card
- 1 commander card (not in deck)

### Turn Phases
1. **Draw Phase**: Draw 2 cards
2. **Deployment**: Play 2 cards face-down
3. **Combat Phase**: Reveal all cards
4. **Calculation**: Compare power, deal damage
5. **End Phase**: Check win conditions

### Victory Conditions
- Reduce opponent HP to 0
- Opponent cannot draw cards

## Project Architecture

### Tech Stack
- **Frontend:** React 18, Tailwind CSS, Shadcn UI, Wouter, TanStack Query
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL (via DATABASE_URL)
- **Authentication:** Replit Auth (OIDC with Google/GitHub/email)
- **Storage:** In-memory (MemStorage class) for game data

### Directory Structure
```
├── client/
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── ui/         # Shadcn primitives
│   │   │   ├── game-sidebar.tsx
│   │   │   └── theme-*.tsx
│   │   ├── hooks/
│   │   │   ├── use-auth.ts     # Authentication hook
│   │   │   └── use-websocket.ts # WebSocket hook for real-time
│   │   ├── pages/
│   │   │   ├── home.tsx
│   │   │   ├── rules.tsx
│   │   │   ├── tutorial.tsx
│   │   │   ├── card-database.tsx
│   │   │   ├── deck-builder.tsx  # Protected
│   │   │   ├── practice.tsx      # Protected
│   │   │   ├── profile.tsx       # Protected
│   │   │   ├── friends.tsx       # Protected - Friend management
│   │   │   ├── lobby.tsx         # Protected - Game room browser
│   │   │   ├── room.tsx          # Protected - Pre-game waiting room
│   │   │   ├── game-board.tsx    # Protected - Game play
│   │   │   └── admin-card-art.tsx # Admin - Card art generator
│   │   └── App.tsx
├── server/
│   ├── replit_integrations/
│   │   └── auth/           # Replit Auth integration
│   │       ├── index.ts
│   │       ├── replitAuth.ts
│   │       └── storage.ts
│   ├── routes.ts           # Core API endpoints
│   ├── multiplayerRoutes.ts # Friends, rooms, matchmaking API
│   ├── websocket.ts        # WebSocket server for real-time
│   ├── storage.ts          # In-memory data + seed
│   └── index.ts            # Express server
├── shared/
│   ├── schema.ts           # TypeScript types + Zod schemas
│   └── models/
│       └── auth.ts         # Auth types
└── design_guidelines.md    # TCG design system
```

### API Endpoints

#### Authentication (Replit Auth)
- `GET /api/login` - Start login flow (redirects to OIDC provider)
- `GET /api/logout` - Logout and destroy session
- `GET /api/auth/user` - Get current authenticated user

#### Game Data
- `GET /api/cards` - List all cards
- `GET /api/cards/:id` - Get single card
- `GET /api/commanders` - List all commanders
- `GET /api/decks` - List all decks (in-memory)
- `POST /api/decks` - Create deck (in-memory)
- `POST /api/deck-suggestions` - AI deck suggestion (requires auth, uses Gemini)
- `GET /api/games` - List all games
- `POST /api/games` - Create game (requires auth)
- `PATCH /api/games/:id` - Update game state

#### User Decks (requires auth, persisted in database)
- `GET /api/user-decks` - List user's saved decks
- `GET /api/user-decks/:id` - Get specific saved deck
- `POST /api/user-decks` - Save new deck to account
- `PATCH /api/user-decks/:id` - Update existing saved deck
- `DELETE /api/user-decks/:id` - Delete saved deck

#### Friend System (requires auth)
- `GET /api/friends` - List friends with online status
- `GET /api/friend-requests` - List pending requests (incoming + outgoing)
- `POST /api/friend-requests` - Send friend request by email
- `POST /api/friend-requests/:id/accept` - Accept request
- `POST /api/friend-requests/:id/decline` - Decline request
- `DELETE /api/friends/:friendId` - Remove friend

#### Room System (requires auth)
- `GET /api/rooms` - List public waiting rooms
- `GET /api/rooms/:id` - Get room details with players/spectators
- `POST /api/rooms` - Create room
- `POST /api/rooms/:id/join` - Join as player (with optional password)
- `POST /api/rooms/:id/leave` - Leave room
- `POST /api/rooms/:id/ready` - Set ready status with deck selection
- `POST /api/rooms/:id/spectate` - Join as spectator
- `DELETE /api/rooms/:id/spectate` - Stop spectating
- `GET /api/rooms/:id/messages` - Get room chat history
- `POST /api/rooms/:id/messages` - Send chat message

#### WebSocket Events (/ws)
- Authentication: Session-based (validates cookies on connection, no client-side auth needed)
- `join_room/leave_room` - Join/leave room for updates (requires host, guest, or spectator membership)
- `join_game/leave_game` - Join/leave game for real-time sync (requires player1 or player2)
- `room_message/game_message` - Chat in room or game
- `game_action` - Broadcast game state changes
- `player_ready` - Notify ready status change
- `game_start` - Notify game start

#### Admin Routes (requires admin email: redeagle28089@gmail.com)
- `GET /api/admin/check` - Check if current user is admin
- `POST /api/admin/generate-card-art` - Generate AI artwork with Gemini
- `PATCH /api/admin/cards/:id` - Update card image URL
- `PATCH /api/admin/commanders/:id` - Update commander image URL

### Data Models

#### User (from auth)
- id: string (UUID)
- email: string
- firstName: string | null
- lastName: string | null
- profileImageUrl: string | null
- createdAt: Date
- updatedAt: Date

#### Game Data
- **Card**: id, name, element, power (1-10), trait, buff/debuff modifiers
- **Commander**: id, name, element, title, abilities
- **Deck**: id, name, playerId, commanderId, cardIds[]
- **Game**: id, players, HP, phase, turn, gameState, status, aiDifficulty

## Running the App
`npm run dev` starts Express backend + Vite frontend on port 5000.

## Features

### Implemented
- Google/GitHub/email authentication via Replit Auth
- User accounts with persistent progress
- Home page with hero section and feature highlights
- Rules page with complete game mechanics
- Tutorial page with 5-step learning guide
- Card Database with element filtering (public)
- Deck Builder with validation (40 cards, power distribution, max 3 copies)
- Commander selection for decks
- Practice mode with AI opponent
- AI difficulty selection (Easy, Medium, Hard)
- Game history viewing
- Player profile with stats (wins, losses, win rate)
- Turn-based gameplay with 5 phases
- Dark fantasy themed UI with element colors
- **Multiplayer Features:**
  - Game lobby with room browser and creation
  - Public and private (password-protected) rooms
  - Pre-game waiting room with deck selection
  - Ready system for both players
  - Real-time game synchronization via WebSocket
  - In-game chat during matches
  - Spectator mode for watching games
  - Friend system with requests and online status
  - Room chat for pre-game communication

### Page Access
- **Public:** Home, Rules, Tutorial, Card Database
- **Protected (requires login):** Deck Builder, Practice, Profile, Game Board, Lobby, Friends, Room

### Known Limitations (Development Environment)
- Game state updates use optimistic client PATCHes; production should add server-side move validation
