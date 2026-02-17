import type { Express } from "express";

const API_DOCS = {
  title: "Wisdom & Chance TCG - Mobile API",
  version: "1.0.0",
  baseUrl: "/api",
  authentication: {
    type: "Bearer Token (JWT)",
    description: "Include the JWT token in the Authorization header: 'Bearer <token>'",
    endpoints: {
      login: {
        method: "POST",
        path: "/api/mobile/auth/login",
        description: "Authenticate and get JWT token",
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
    },
    commanders: {
      list: { method: "GET", path: "/api/commanders", description: "List all commanders" },
    },
  },
  protectedEndpoints: {
    note: "These endpoints require authentication via session cookie (web) or Bearer token (mobile)",
    userDecks: {
      list: { method: "GET", path: "/api/user-decks", description: "List user's saved decks" },
      get: { method: "GET", path: "/api/user-decks/:id", description: "Get specific saved deck" },
      create: {
        method: "POST",
        path: "/api/user-decks",
        description: "Save a new deck",
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
    games: {
      list: { method: "GET", path: "/api/games", description: "List all games" },
      create: {
        method: "POST",
        path: "/api/games",
        description: "Create a new game",
        body: { gameType: "'practice' | 'multiplayer'", aiDifficulty: "'easy' | 'medium' | 'hard' (for practice)" },
      },
      update: { method: "PATCH", path: "/api/games/:id", description: "Update game state" },
    },
    friends: {
      list: { method: "GET", path: "/api/friends", description: "List friends with online status" },
      requests: { method: "GET", path: "/api/friend-requests", description: "List pending friend requests" },
      sendRequest: {
        method: "POST",
        path: "/api/friend-requests",
        description: "Send friend request",
        body: { email: "string" },
      },
      acceptRequest: { method: "POST", path: "/api/friend-requests/:id/accept", description: "Accept friend request" },
      declineRequest: { method: "POST", path: "/api/friend-requests/:id/decline", description: "Decline friend request" },
      removeFriend: { method: "DELETE", path: "/api/friends/:friendId", description: "Remove friend" },
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
      join: { method: "POST", path: "/api/rooms/:id/join", description: "Join room as player" },
      leave: { method: "POST", path: "/api/rooms/:id/leave", description: "Leave room" },
      ready: {
        method: "POST",
        path: "/api/rooms/:id/ready",
        description: "Set ready status with deck",
        body: { ready: "boolean (defaults to true)", deckId: "string" },
      },
      start: { method: "POST", path: "/api/rooms/:id/start", description: "Start game (host only)" },
    },
  },
  websocket: {
    url: "/ws",
    description: "WebSocket endpoint for real-time game communication",
    authentication: "Session-based (web) - send cookies on connection. For mobile, connect with token query param: /ws?token=<jwt>",
    events: {
      client: {
        join_room: "Join a room for real-time updates",
        leave_room: "Leave room updates",
        join_game: "Join game for real-time state sync",
        leave_game: "Leave game updates",
        room_message: "Send chat message in room",
        game_message: "Send chat message in game",
        game_action: "Broadcast game state changes",
      },
      server: {
        room_update: "Room state changed",
        player_ready_update: "Player ready status changed",
        game_start: "Game started",
        game_action: "Game state update from other player",
        room_message: "Chat message in room",
        game_message: "Chat message in game",
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
};

export function registerApiDocsRoutes(app: Express) {
  app.get("/api/docs", (_req, res) => {
    res.json(API_DOCS);
  });
}