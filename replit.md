# Wisdom & Chance TCG

## Overview
A tactical trading card game simulator built with React, Express, and TypeScript. Master elemental powers, build strategic decks, and battle against AI opponents.

**Purpose:** Card game simulator with deck building and practice battles.

**Current State:** Fully functional TCG with Google authentication and all core features implemented.

## Recent Changes
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
│   │   │   └── use-auth.ts # Authentication hook
│   │   ├── pages/
│   │   │   ├── home.tsx
│   │   │   ├── rules.tsx
│   │   │   ├── tutorial.tsx
│   │   │   ├── card-database.tsx
│   │   │   ├── deck-builder.tsx  # Protected
│   │   │   ├── practice.tsx      # Protected
│   │   │   ├── profile.tsx       # Protected
│   │   │   └── game-board.tsx    # Protected
│   │   └── App.tsx
├── server/
│   ├── replit_integrations/
│   │   └── auth/           # Replit Auth integration
│   │       ├── index.ts
│   │       ├── replitAuth.ts
│   │       └── storage.ts
│   ├── routes.ts           # API endpoints
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
- `GET /api/decks` - List all decks
- `POST /api/decks` - Create deck (requires auth)
- `GET /api/games` - List all games
- `POST /api/games` - Create game (requires auth)
- `PATCH /api/games/:id` - Update game state

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

### Page Access
- **Public:** Home, Rules, Tutorial, Card Database
- **Protected (requires login):** Deck Builder, Practice, Profile, Game Board
