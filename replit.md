# Wisdom & Chance TCG

## Overview
A tactical trading card game simulator built with React, Express, and TypeScript. Master elemental powers, build strategic decks, and battle against AI opponents.

**Purpose:** Card game simulator with deck building and practice battles.

**Current State:** Core gameplay implemented with Home, Rules, Card Database, Deck Builder, Practice mode, and GameBoard.

## Recent Changes
- **January 2026:** Complete rebuild from project management app to TCG game
  - 5 elements: Fire, Water, Earth, Air, Nature
  - 200 seeded cards (40 per element, powers 1-10)
  - 5 commanders with unique abilities
  - Full deck building with 40-card validation
  - Practice mode with AI opponent
  - Turn-based battle system with 5 phases

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
- **Storage:** In-memory (MemStorage class)

### Directory Structure
```
├── client/
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── ui/         # Shadcn primitives
│   │   │   ├── game-sidebar.tsx
│   │   │   └── theme-*.tsx
│   │   ├── pages/
│   │   │   ├── home.tsx
│   │   │   ├── rules.tsx
│   │   │   ├── card-database.tsx
│   │   │   ├── deck-builder.tsx
│   │   │   ├── practice.tsx
│   │   │   └── game-board.tsx
│   │   └── App.tsx
├── server/
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # In-memory data + seed
│   └── index.ts            # Express server
├── shared/
│   └── schema.ts           # TypeScript types + Zod schemas
└── design_guidelines.md    # TCG design system
```

### API Endpoints
- `GET /api/cards` - List all cards
- `GET /api/cards/:id` - Get single card
- `GET /api/commanders` - List all commanders
- `GET /api/decks` - List all decks
- `POST /api/decks` - Create deck
- `GET /api/games` - List all games
- `POST /api/games` - Create game
- `PATCH /api/games/:id` - Update game state
- `GET /api/guest-player` - Get guest player

### Data Models
- **Card**: id, name, element, power (1-10), trait, buff/debuff modifiers
- **Commander**: id, name, element, title, abilities
- **Deck**: id, name, playerId, commanderId, cardIds[]
- **Game**: id, players, HP, phase, turn, gameState, status
- **Player**: id, username, displayName, wins, losses

## Running the App
`npm run dev` starts Express backend + Vite frontend on port 5000.
