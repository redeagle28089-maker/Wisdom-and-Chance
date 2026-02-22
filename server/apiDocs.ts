import type { Express } from "express";

const API_DOCS = {
  title: "Wisdom & Chance TCG - Mobile API",
  version: "2.0.0",
  baseUrl: "https://wisdom-and-chance.replit.app/api",
  authentication: {
    type: "Bearer Token (JWT)",
    description: "Include the JWT token in the Authorization header: 'Bearer <token>'. All /api endpoints accept both session cookies (web) and Bearer tokens (mobile).",
    endpoints: {
      login: {
        method: "POST",
        path: "/api/mobile/auth/login",
        description: "Authenticate and get JWT token. Creates user account if email doesn't exist.",
        body: {
          email: "string (required)",
          firstName: "string (optional)",
          lastName: "string (optional)",
          profileImageUrl: "string (optional)",
          provider: "string (optional) - 'google' or 'apple'",
          providerToken: "string (optional) - provider auth token for server-side verification",
        },
        response: {
          token: "string - JWT token (valid for 7 days)",
          user: { id: "string", email: "string", firstName: "string|null", lastName: "string|null", profileImageUrl: "string|null" },
        },
      },
      refresh: {
        method: "POST",
        path: "/api/mobile/auth/refresh",
        description: "Refresh JWT token (requires valid token)",
        headers: { Authorization: "Bearer <token>" },
        response: { token: "string - new JWT token" },
      },
      me: {
        method: "GET",
        path: "/api/mobile/auth/me",
        description: "Get current user info (requires valid token)",
        headers: { Authorization: "Bearer <token>" },
        response: { id: "string", email: "string", firstName: "string|null", lastName: "string|null", profileImageUrl: "string|null" },
      },
    },
  },
  publicEndpoints: {
    cards: {
      list: { method: "GET", path: "/api/cards", description: "List all cards" },
      get: { method: "GET", path: "/api/cards/:id", description: "Get single card by ID" },
      byElement: { method: "GET", path: "/api/cards/element/:element", description: "Get cards by element (fire, water, earth, air, nature)" },
    },
    commanders: {
      list: { method: "GET", path: "/api/commanders", description: "List all commanders" },
      get: { method: "GET", path: "/api/commanders/:id", description: "Get single commander by ID" },
    },
    decks: {
      list: { method: "GET", path: "/api/decks?playerId=<id>", description: "List decks (optionally filter by player)" },
      get: { method: "GET", path: "/api/decks/:id", description: "Get single deck" },
    },
    players: {
      list: { method: "GET", path: "/api/players", description: "List all players" },
      get: { method: "GET", path: "/api/players/:id", description: "Get single player" },
    },
    achievements: {
      list: { method: "GET", path: "/api/achievements", description: "List all available achievements" },
    },
    leaderboard: {
      get: { method: "GET", path: "/api/leaderboard", description: "Get leaderboard with ELO ratings and tiers" },
    },
    userSearch: {
      search: { method: "GET", path: "/api/users/search?q=<query>", description: "Search users by email or name" },
    },
  },
  protectedEndpoints: {
    note: "These endpoints require authentication via session cookie (web) or Bearer token (mobile). Include 'Authorization: Bearer <token>' header.",
    userDecks: {
      list: { method: "GET", path: "/api/user-decks", description: "List current user's saved decks" },
      get: { method: "GET", path: "/api/user-decks/:id", description: "Get specific saved deck" },
      create: {
        method: "POST",
        path: "/api/user-decks",
        description: "Save a new deck (validated: 40 cards, 4 per power rank, max 3 copies)",
        body: { name: "string", commanderId: "string", cardIds: "string[] (exactly 40 card IDs)" },
      },
      update: {
        method: "PATCH",
        path: "/api/user-decks/:id",
        description: "Update existing deck",
        body: { name: "string (optional)", commanderId: "string (optional)", cardIds: "string[] (optional)" },
      },
      delete: { method: "DELETE", path: "/api/user-decks/:id", description: "Delete saved deck" },
    },
    deckSuggestions: {
      generate: {
        method: "POST",
        path: "/api/deck-suggestions",
        description: "Get AI-generated deck suggestion based on commander and playstyle",
        body: { commanderId: "string", playstyle: "'aggressive' | 'defensive' | 'balanced'" },
        response: { deckName: "string", strategy: "string", commanderId: "string", cards: "[{id: string, count: number}]" },
      },
    },
    friends: {
      list: { method: "GET", path: "/api/friends", description: "List friends with online status" },
      requests: { method: "GET", path: "/api/friend-requests", description: "List pending friend requests (sent and received)" },
      sendRequest: {
        method: "POST",
        path: "/api/friend-requests",
        description: "Send friend request by email",
        body: { email: "string" },
      },
      acceptRequest: { method: "POST", path: "/api/friend-requests/:id/accept", description: "Accept friend request" },
      declineRequest: { method: "POST", path: "/api/friend-requests/:id/decline", description: "Decline friend request" },
      removeFriend: { method: "DELETE", path: "/api/friends/:friendId", description: "Remove friend" },
    },
    friendMessages: {
      list: { method: "GET", path: "/api/friend-messages/:friendId", description: "Get messages with a friend (last 24h, max 100)" },
      send: {
        method: "POST",
        path: "/api/friend-messages/:friendId",
        description: "Send message to a friend (obscenity filtered)",
        body: { message: "string" },
      },
    },
    rooms: {
      list: { method: "GET", path: "/api/rooms", description: "List public rooms" },
      get: { method: "GET", path: "/api/rooms/:id", description: "Get room details" },
      create: {
        method: "POST",
        path: "/api/rooms",
        description: "Create a room",
        body: { name: "string", isPrivate: "boolean (optional)", password: "string (optional)" },
      },
      join: {
        method: "POST",
        path: "/api/rooms/:id/join",
        description: "Join room as player",
        body: { password: "string (optional, for private rooms)" },
      },
      leave: { method: "POST", path: "/api/rooms/:id/leave", description: "Leave room" },
      ready: {
        method: "POST",
        path: "/api/rooms/:id/ready",
        description: "Set ready status with deck selection",
        body: { ready: "boolean (defaults to true)", deckId: "string" },
      },
      start: { method: "POST", path: "/api/rooms/:id/start", description: "Start game (host only, both players must be ready)" },
      spectate: { method: "POST", path: "/api/rooms/:id/spectate", description: "Join room as spectator" },
      leaveSpectate: { method: "DELETE", path: "/api/rooms/:id/spectate", description: "Leave spectator mode" },
      messages: { method: "GET", path: "/api/rooms/:id/messages", description: "Get room chat messages (last 50)" },
      sendMessage: {
        method: "POST",
        path: "/api/rooms/:id/messages",
        description: "Send chat message in room (obscenity filtered)",
        body: { message: "string" },
      },
    },
    games: {
      list: { method: "GET", path: "/api/games?playerId=<id>", description: "List games (optionally filter by player)" },
      get: { method: "GET", path: "/api/games/:id", description: "Get game details" },
      create: {
        method: "POST",
        path: "/api/games",
        description: "Create a new game",
        body: { gameType: "'practice' | 'multiplayer'", aiDifficulty: "'easy' | 'medium' | 'hard' (for practice)" },
      },
      update: { method: "PATCH", path: "/api/games/:id", description: "Update game state" },
    },
    ratings: {
      myRating: { method: "GET", path: "/api/player-rating", description: "Get current user's ELO rating and tier" },
    },
    playerAchievements: {
      list: { method: "GET", path: "/api/player-achievements", description: "Get current user's unlocked achievements" },
    },
    dailyChallenges: {
      list: { method: "GET", path: "/api/daily-challenges", description: "Get today's daily challenges" },
      playerProgress: { method: "GET", path: "/api/player-challenges", description: "Get current user's challenge progress" },
      claimReward: { method: "POST", path: "/api/player-challenges/:id/claim", description: "Claim completed challenge reward" },
    },
    playerStats: {
      get: { method: "GET", path: "/api/player-stats", description: "Get current user's game statistics" },
    },
  },
  websocket: {
    url: "/ws",
    description: "WebSocket endpoint for real-time game communication",
    authentication: {
      web: "Session-based - cookies sent automatically on connection",
      mobile: "JWT-based - connect with token query param: /ws?token=<jwt>",
      example: "new WebSocket('wss://wisdom-and-chance.replit.app/ws?token=YOUR_JWT_TOKEN')",
    },
    events: {
      client: {
        join_room: { payload: "{ roomId: string }", description: "Join a room for real-time updates" },
        leave_room: { payload: "{ roomId: string }", description: "Leave room updates" },
        join_game: { payload: "{ gameId: string }", description: "Join game for real-time state sync" },
        leave_game: { payload: "{ gameId: string }", description: "Leave game updates" },
        room_message: { payload: "{ roomId: string, message: string }", description: "Send chat message in room" },
        game_message: { payload: "{ gameId: string, message: string }", description: "Send chat message in game" },
        game_action: { payload: "{ gameId: string, action: object }", description: "Broadcast game state changes" },
      },
      server: {
        auth_success: { payload: "{ userId: string, displayName: string }", description: "Authentication confirmed" },
        auth_error: { payload: "{ message: string }", description: "Authentication failed" },
        room_update: { payload: "Room state object", description: "Room state changed" },
        player_ready_update: { payload: "Ready status object", description: "Player ready status changed" },
        game_start: { payload: "Game state object", description: "Game started" },
        game_action: { payload: "Game action object", description: "Game state update from other player" },
        room_message: { payload: "{ userId, displayName, message, timestamp }", description: "Chat message in room" },
        game_message: { payload: "{ userId, displayName, message, timestamp }", description: "Chat message in game" },
        friend_message: { payload: "{ id, senderId, receiverId, message, createdAt }", description: "Real-time friend message" },
        presence_update: { payload: "{ userId, status: 'online'|'offline' }", description: "Friend online status change" },
        friend_request_accepted: { payload: "{ friendId }", description: "Friend request was accepted" },
      },
    },
  },
  gameRules: {
    deckConstruction: {
      totalCards: 40,
      cardsPerPowerRank: 4,
      maxCopiesPerCard: 3,
      commanderCount: 1,
    },
    turnPhases: ["draw", "deployment", "combat", "calculation", "end"],
    initialHP: 20,
    initialHandSize: 5,
    cardsDrawnPerTurn: 2,
    cardsDeployedPerTurn: 2,
    elements: ["fire", "water", "earth", "air", "nature"],
  },
  pwaInstall: {
    description: "The website can be installed as a native app on mobile devices via PWA",
    manifest: "/manifest.json",
    serviceWorker: "/sw.js",
    features: [
      "Offline caching of static assets",
      "Home screen installable",
      "Standalone display mode (no browser chrome)",
      "iOS Safari 'Add to Home Screen' guide included",
    ],
  },
};

export function registerApiDocsRoutes(app: Express) {
  app.get("/api/docs", (_req, res) => {
    res.json(API_DOCS);
  });
}
