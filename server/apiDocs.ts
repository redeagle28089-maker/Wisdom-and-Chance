import type { Express } from "express";

const API_DOCS = {
  title: "Wisdom & Chance TCG - Mobile API Reference",
  version: "2.3.0",
  baseUrl: "https://wisdom-and-chance.replit.app",
  apiPrefix: "/api",
  authentication: {
    overview: "All /api endpoints accept both session cookies (web) and JWT Bearer tokens (mobile). Include 'Authorization: Bearer <token>' header for mobile access.",
    tokenExpiry: "7 days",
    refreshStrategy: "Call /api/mobile/auth/refresh before token expires to get a new token.",
    endpoints: {
      login: {
        method: "POST",
        path: "/api/mobile/auth/login",
        description: "Authenticate and get JWT token. Creates user account if email doesn't exist.",
        requiresAuth: false,
        body: {
          email: { type: "string", required: true, description: "User's email address" },
          firstName: { type: "string", required: false, description: "User's first name" },
          lastName: { type: "string", required: false, description: "User's last name" },
          profileImageUrl: { type: "string", required: false, description: "URL to profile image" },
          provider: { type: "string", required: false, description: "'google' or 'apple'" },
          providerToken: { type: "string", required: false, description: "Provider auth token for server-side verification" },
        },
        response: {
          "200": {
            token: "string (JWT, valid for 7 days)",
            user: {
              id: "string (UUID)",
              email: "string",
              firstName: "string | null",
              lastName: "string | null",
              profileImageUrl: "string | null",
            },
          },
          "400": { error: "Email is required" },
          "503": { error: "Mobile auth is not configured" },
        },
      },
      refresh: {
        method: "POST",
        path: "/api/mobile/auth/refresh",
        description: "Refresh JWT token. Returns a new token with fresh 7-day expiry.",
        requiresAuth: true,
        response: {
          "200": { token: "string (new JWT token)" },
          "401": { error: "Invalid or expired token" },
        },
      },
      me: {
        method: "GET",
        path: "/api/mobile/auth/me",
        description: "Get current authenticated user info.",
        requiresAuth: true,
        response: {
          "200": {
            id: "string (UUID)",
            email: "string",
            firstName: "string | null",
            lastName: "string | null",
            profileImageUrl: "string | null",
          },
          "401": { error: "Invalid or expired token" },
          "404": { error: "User not found" },
        },
      },
    },
  },
  healthCheck: {
    method: "GET",
    path: "/api/health",
    description: "Check server and database connectivity. No auth required.",
    requiresAuth: false,
    response: {
      "200": {
        status: "ok",
        timestamp: "string (ISO 8601)",
        version: "string",
        database: "connected | error",
        services: {
          auth: "available",
          websocket: "available",
          multiplayer: "available",
        },
      },
      "503": {
        status: "error",
        timestamp: "string (ISO 8601)",
        version: "string",
        database: "error",
      },
    },
  },
  publicEndpoints: {
    _note: "These endpoints do NOT require authentication.",
    cards: {
      list: {
        method: "GET",
        path: "/api/cards",
        description: "List all cards in the game.",
        response: {
          "200": "Array of Card objects: [{ id: string, name: string, element: string, power: number (1-10), trait: string | null, traitValue: number | null, buffModifier: number, buffColor: string | null, debuffModifier: number, debuffColor: string | null, description: string | null, imageUrl: string | null, isCommander: boolean }]",
        },
      },
      get: {
        method: "GET",
        path: "/api/cards/:id",
        description: "Get a single card by ID.",
        params: { id: "string - Card UUID" },
        response: {
          "200": "Card object",
          "404": { message: "Card not found" },
        },
      },
      byElement: {
        method: "GET",
        path: "/api/cards/element/:element",
        description: "Get all cards of a specific element.",
        params: { element: "string - one of: fire, water, earth, air, nature" },
        response: { "200": "Array of Card objects" },
      },
    },
    commanders: {
      list: {
        method: "GET",
        path: "/api/commanders",
        description: "List all commander cards.",
        response: {
          "200": "Array of Commander objects: [{ id: string, name: string, element: string, ability: string, abilityDescription: string, imageUrl: string | null }]",
        },
      },
      get: {
        method: "GET",
        path: "/api/commanders/:id",
        description: "Get a single commander by ID.",
        params: { id: "string - Commander UUID" },
        response: {
          "200": "Commander object",
          "404": { message: "Commander not found" },
        },
      },
    },
    achievements: {
      list: {
        method: "GET",
        path: "/api/achievements",
        description: "List all available achievements.",
        response: {
          "200": "Array of Achievement objects: [{ id: string, name: string, description: string, category: string, icon: string | null, xpReward: number }]",
        },
      },
    },
    leaderboard: {
      get: {
        method: "GET",
        path: "/api/leaderboard",
        description: "Get top 100 players ranked by ELO rating.",
        response: {
          "200": "Array of leaderboard entries: [{ id: string, rank: number, userId: string, displayName: string, profileImageUrl: string | null, rating: number, wins: number, losses: number, winRate: number, streak: number, tier: string }]",
        },
        tierValues: "Bronze (<800), Silver (<1000), Gold (<1200), Platinum (<1400), Diamond (<1600), Master (1600+)",
      },
    },
    dailyChallenges: {
      list: {
        method: "GET",
        path: "/api/daily-challenges",
        description: "Get today's daily challenges.",
        response: {
          "200": "Array of DailyChallenge objects: [{ id: string, title: string, description: string, type: string, targetValue: number, xpReward: number, activeDate: string }]",
        },
      },
    },
    rooms: {
      list: {
        method: "GET",
        path: "/api/rooms",
        description: "List public rooms in 'waiting' status.",
        response: {
          "200": "Array of Room objects with host info: [{ id: string, name: string, hostId: string, guestId: string | null, isPrivate: boolean, status: string, createdAt: string, host: { id: string, firstName: string | null, lastName: string | null, profileImageUrl: string | null } }]",
        },
      },
      get: {
        method: "GET",
        path: "/api/rooms/:id",
        description: "Get full room details including host, guest, and spectators.",
        params: { id: "string - Room UUID" },
        response: {
          "200": "Room object with host, guest, spectators arrays",
          "404": { message: "Room not found" },
        },
      },
      messages: {
        method: "GET",
        path: "/api/rooms/:id/messages",
        description: "Get room chat messages (last 100, chronological).",
        params: { id: "string - Room UUID" },
        response: {
          "200": "Array of messages: [{ id: string, message: string, createdAt: string, sender: { id: string, firstName: string | null, lastName: string | null, profileImageUrl: string | null } }]",
        },
      },
    },
  },
  protectedEndpoints: {
    _note: "These endpoints require authentication via session cookie (web) or Bearer token (mobile). Include 'Authorization: Bearer <token>' header.",
    _commonErrors: {
      "401": { message: "Unauthorized" },
      "500": { error: "Internal server error description" },
    },
    userProfile: {
      update: {
        method: "PATCH",
        path: "/api/user/profile",
        description: "Update current user's profile information.",
        body: {
          firstName: { type: "string", required: false, description: "Updated first name (1-100 chars)" },
          lastName: { type: "string", required: false, description: "Updated last name (1-100 chars)" },
          profileImageUrl: { type: "string | null", required: false, description: "Profile image URL or null to remove" },
        },
        response: {
          "200": { id: "string", email: "string", firstName: "string | null", lastName: "string | null", profileImageUrl: "string | null", createdAt: "string", updatedAt: "string" },
          "400": { error: "Validation errors or 'No fields to update'" },
        },
      },
    },
    userDecks: {
      list: {
        method: "GET",
        path: "/api/user-decks",
        description: "List current user's saved decks.",
        response: {
          "200": "Array of UserDeck objects: [{ id: string, userId: string, name: string, commanderId: string, cardIds: string[] (40 card IDs), createdAt: string, updatedAt: string }]",
        },
      },
      get: {
        method: "GET",
        path: "/api/user-decks/:id",
        description: "Get a specific saved deck. Must belong to current user.",
        params: { id: "string - Deck UUID" },
        response: {
          "200": "UserDeck object",
          "403": { error: "Not authorized to view this deck" },
          "404": { error: "Deck not found" },
        },
      },
      create: {
        method: "POST",
        path: "/api/user-decks",
        description: "Save a new deck. Validates: exactly 40 cards, 4 per power rank (1-10), max 3 copies of any card, valid commander.",
        body: {
          name: { type: "string", required: true, description: "Deck name (1-50 chars)" },
          commanderId: { type: "string", required: true, description: "Commander card UUID" },
          cardIds: { type: "string[]", required: true, description: "Exactly 40 card UUIDs" },
        },
        response: {
          "201": "Created UserDeck object",
          "400": { error: "Validation error details" },
        },
        validationRules: {
          totalCards: 40,
          cardsPerPowerRank: 4,
          maxCopiesPerCard: 3,
          powerRanks: "1-10 (4 cards each = 40 total)",
        },
      },
      update: {
        method: "PATCH",
        path: "/api/user-decks/:id",
        description: "Update an existing deck. All fields optional. Same validation rules as create.",
        params: { id: "string - Deck UUID" },
        body: {
          name: { type: "string", required: false },
          commanderId: { type: "string", required: false },
          cardIds: { type: "string[]", required: false, description: "Must be exactly 40 if provided" },
        },
        response: {
          "200": "Updated UserDeck object",
          "403": { error: "Not authorized to edit this deck" },
          "404": { error: "Deck not found" },
        },
      },
      delete: {
        method: "DELETE",
        path: "/api/user-decks/:id",
        description: "Delete a saved deck. Must belong to current user.",
        params: { id: "string - Deck UUID" },
        response: {
          "204": "No content (success)",
          "403": { error: "Not authorized to delete this deck" },
          "404": { error: "Deck not found" },
        },
      },
    },
    deckSuggestions: {
      generate: {
        method: "POST",
        path: "/api/deck-suggestions",
        description: "Get AI-generated deck suggestion using Gemini. Returns a validated 40-card deck.",
        body: {
          commanderId: { type: "string", required: true, description: "Commander UUID to build around" },
          playstyle: { type: "string", required: true, description: "One of: 'aggressive', 'defensive', 'balanced'" },
        },
        response: {
          "200": {
            deckName: "string",
            strategy: "string",
            commanderId: "string",
            cards: "[{ id: string, count: number (1-3) }]",
          },
        },
      },
    },
    friends: {
      list: {
        method: "GET",
        path: "/api/friends",
        description: "List friends with online status.",
        response: {
          "200": "Array: [{ id: string, friendId: string, createdAt: string, friend: { id: string, email: string, firstName: string | null, lastName: string | null, profileImageUrl: string | null }, isOnline: boolean }]",
        },
      },
      requests: {
        method: "GET",
        path: "/api/friend-requests",
        description: "List pending friend requests (incoming and outgoing).",
        response: {
          "200": "{ incoming: [{ id, senderId, status, createdAt, sender: {...} }], outgoing: [{ id, receiverId, status, createdAt, receiver: {...} }] }",
        },
      },
      sendRequest: {
        method: "POST",
        path: "/api/friend-requests",
        description: "Send friend request by email.",
        body: { email: { type: "string", required: true, description: "Target user's email" } },
        response: {
          "201": "FriendRequest object",
          "400": { message: "Already friends / Request pending / Cannot send to yourself" },
          "404": { message: "User not found" },
        },
      },
      acceptRequest: {
        method: "POST",
        path: "/api/friend-requests/:id/accept",
        description: "Accept a pending friend request.",
        params: { id: "string - FriendRequest UUID" },
        response: {
          "200": { message: "Friend request accepted" },
          "404": { message: "Friend request not found" },
        },
      },
      declineRequest: {
        method: "POST",
        path: "/api/friend-requests/:id/decline",
        description: "Decline a pending friend request.",
        params: { id: "string - FriendRequest UUID" },
        response: {
          "200": { message: "Friend request declined" },
        },
      },
      removeFriend: {
        method: "DELETE",
        path: "/api/friends/:friendId",
        description: "Remove a friend (both directions).",
        params: { friendId: "string - Friend's user UUID" },
        response: {
          "200": { message: "Friend removed" },
        },
      },
    },
    friendMessages: {
      list: {
        method: "GET",
        path: "/api/friend-messages/:friendId",
        description: "Get messages with a friend (last 24 hours, max 100). Must be friends.",
        params: { friendId: "string - Friend's user UUID" },
        response: {
          "200": "Array: [{ id: string, senderId: string, receiverId: string, message: string, createdAt: string }]",
          "403": { message: "You can only view messages with friends" },
        },
      },
      send: {
        method: "POST",
        path: "/api/friend-messages/:friendId",
        description: "Send a message to a friend. Obscenity filtered.",
        params: { friendId: "string - Friend's user UUID" },
        body: { message: { type: "string", required: true } },
        response: {
          "201": "Message object: { id, senderId, receiverId, message, createdAt }",
          "403": { message: "You can only message friends" },
        },
      },
    },
    rooms: {
      create: {
        method: "POST",
        path: "/api/rooms",
        description: "Create a game room.",
        body: {
          name: { type: "string", required: true, description: "Room name" },
          isPrivate: { type: "boolean", required: false, description: "Default: false" },
          password: { type: "string", required: false, description: "Required for private rooms" },
          gameMode: { type: "string", required: false, description: "Default: 'standard'" },
        },
        response: { "201": "Room object" },
      },
      join: {
        method: "POST",
        path: "/api/rooms/:id/join",
        description: "Join room as a player (second slot).",
        params: { id: "string - Room UUID" },
        body: { password: { type: "string", required: false, description: "Required for private rooms" } },
        response: {
          "200": "Updated Room object",
          "400": { message: "Room is full / Room is not accepting players" },
          "403": { message: "Incorrect password" },
          "404": { message: "Room not found" },
        },
      },
      leave: {
        method: "POST",
        path: "/api/rooms/:id/leave",
        description: "Leave room. If host leaves and guest exists, guest becomes host.",
        params: { id: "string - Room UUID" },
        response: { "200": { message: "Left room" } },
      },
      ready: {
        method: "POST",
        path: "/api/rooms/:id/ready",
        description: "Set ready status with deck selection.",
        params: { id: "string - Room UUID" },
        body: {
          ready: { type: "boolean", required: false, description: "Defaults to true" },
          deckId: { type: "string", required: true, description: "Selected UserDeck UUID" },
        },
        response: { "200": { message: "Marked ready / Marked not ready" } },
      },
      start: {
        method: "POST",
        path: "/api/rooms/:id/start",
        description: "Start the game. Host only. Both players must be ready with decks selected.",
        params: { id: "string - Room UUID" },
        response: {
          "201": "Full Game state object with initial hands, decks, commanders",
          "400": { message: "Both players must be ready / Must select decks" },
          "403": { message: "Only the host can start the game" },
        },
      },
      spectate: {
        method: "POST",
        path: "/api/rooms/:id/spectate",
        description: "Join room as spectator.",
        params: { id: "string - Room UUID" },
        response: { "201": "Spectator object" },
      },
      leaveSpectate: {
        method: "DELETE",
        path: "/api/rooms/:id/spectate",
        description: "Leave spectator mode.",
        params: { id: "string - Room UUID" },
        response: { "200": { message: "Stopped spectating" } },
      },
      sendMessage: {
        method: "POST",
        path: "/api/rooms/:id/messages",
        description: "Send chat message in room. Obscenity filtered.",
        params: { id: "string - Room UUID" },
        body: { message: { type: "string", required: true } },
        response: { "201": "ChatMessage object" },
      },
    },
    playerStats: {
      get: {
        method: "GET",
        path: "/api/player-stats",
        description: "Get current user's game statistics. Auto-creates if not exists.",
        response: {
          "200": "{ id: string, userId: string, totalXp: number, level: number, gamesPlayed: number, gamesWon: number, gamesLost: number, totalDamageDealt: number, totalCardsPlayed: number, favoriteElement: string | null, favoriteCommander: string | null, longestWinStreak: number, currentWinStreak: number, updatedAt: string }",
        },
      },
    },
    playerRating: {
      get: {
        method: "GET",
        path: "/api/player-rating",
        description: "Get current user's ELO rating. Auto-creates at 1000 if not exists.",
        response: {
          "200": "{ id: string, userId: string, rating: number, wins: number, losses: number, streak: number }",
        },
      },
    },
    playerAchievements: {
      list: {
        method: "GET",
        path: "/api/player-achievements",
        description: "Get current user's unlocked achievements.",
        response: {
          "200": "Array of PlayerAchievement objects",
        },
      },
    },
    playerChallenges: {
      list: {
        method: "GET",
        path: "/api/player-challenges",
        description: "Get current user's challenge progress.",
        response: { "200": "Array of PlayerChallenge objects" },
      },
      claimReward: {
        method: "POST",
        path: "/api/player-challenges/:id/claim",
        description: "Claim completed challenge reward.",
        params: { id: "string - Challenge UUID" },
        response: {
          "200": "Updated PlayerChallenge object with claimedAt timestamp",
          "400": { message: "Cannot claim this challenge" },
        },
      },
    },
    userSearch: {
      search: {
        method: "GET",
        path: "/api/users/search?q=<query>",
        description: "Search users by email, first name, or last name. Max 10 results.",
        query: { q: "string - Search query (required, min 1 char)" },
        response: {
          "200": "Array: [{ id, email, firstName, lastName, profileImageUrl }]",
          "400": { message: "Search query is required" },
        },
      },
    },
  },
  websocket: {
    url: "/ws",
    description: "WebSocket endpoint for real-time game communication, chat, and presence updates.",
    authentication: {
      web: "Session-based - cookies sent automatically on connection",
      mobile: "JWT-based - connect with token query param: /ws?token=<jwt>",
      example: "new WebSocket('wss://wisdom-and-chance.replit.app/ws?token=YOUR_JWT_TOKEN')",
    },
    connectionFlow: [
      "1. Connect to WebSocket URL (with token for mobile)",
      "2. Receive 'auth_success' or 'auth_error' message",
      "3. Join rooms/games using 'join_room' or 'join_game' events",
      "4. Listen for server events like 'room_update', 'game_action', etc.",
    ],
    messageFormat: "JSON: { type: string, payload: object }",
    events: {
      clientToServer: {
        join_room: { payload: "{ roomId: string }", description: "Subscribe to room updates" },
        leave_room: { payload: "{ roomId: string }", description: "Unsubscribe from room updates" },
        join_game: { payload: "{ gameId: string }", description: "Subscribe to game state updates" },
        leave_game: { payload: "{ gameId: string }", description: "Unsubscribe from game updates" },
        room_message: { payload: "{ roomId: string, message: string }", description: "Send chat message in room" },
        game_message: { payload: "{ gameId: string, message: string }", description: "Send chat message in game" },
        game_action: { payload: "{ gameId: string, action: object }", description: "Broadcast game state changes (card play, attack, etc.)" },
      },
      serverToClient: {
        auth_success: { payload: "{ userId: string, displayName: string }", description: "Authentication confirmed - you can now send events" },
        auth_error: { payload: "{ message: string }", description: "Authentication failed - connection will be closed" },
        room_update: { payload: "Room state object", description: "Room state changed (player joined/left, settings changed)" },
        player_joined: { payload: "{ roomId: string, userId: string }", description: "A player joined the room" },
        player_left: { payload: "{ roomId: string, userId: string }", description: "A player left the room" },
        player_ready_update: { payload: "{ roomId: string, userId: string, ready: boolean, deckId: string }", description: "Player ready status changed" },
        game_start: { payload: "{ roomId: string, gameId: string }", description: "Game started - navigate to game screen" },
        game_action: { payload: "Game action object", description: "Game state update from other player" },
        chat_message: { payload: "{ roomId: string, senderId: string, message: string, createdAt: string }", description: "Chat message in room" },
        game_message: { payload: "{ userId: string, displayName: string, message: string, timestamp: string }", description: "Chat message in game" },
        friend_message: { payload: "{ id: string, senderId: string, receiverId: string, message: string, createdAt: string }", description: "Real-time friend direct message" },
        friend_request: { payload: "{ requestId: string, senderId: string }", description: "Someone sent you a friend request" },
        friend_request_accepted: { payload: "{ requestId: string, friendId: string }", description: "Your friend request was accepted" },
        presence_update: { payload: "{ userId: string, status: 'online' | 'offline' }", description: "Friend online status change" },
        spectator_joined: { payload: "{ roomId: string, userId: string }", description: "A spectator joined" },
        spectator_left: { payload: "{ roomId: string, userId: string }", description: "A spectator left" },
      },
    },
  },
  gameRules: {
    deckConstruction: {
      totalCards: 40,
      cardsPerPowerRank: 4,
      maxCopiesPerCard: 3,
      commanderCount: 1,
      powerRanks: "1-10 (4 cards at each level = 40 cards)",
    },
    turnPhases: ["draw", "deployment", "combat", "calculation", "end"],
    phaseDescriptions: {
      draw: "Draw 2 cards from deck (5 cards drawn on first turn as starting hand)",
      deployment: "Play up to 2 cards from hand onto battlefield",
      combat: "Reveal deployed cards, activate combat-phase commander abilities",
      calculation: "Resolve combat via 8-step flow: Deploy & Reveal → Calculate Power → Quick Strike → Guardian → Healing → Determine Winner → Apply Net Damage → Care Package",
      end: "Clean up phase, pass turn to opponent",
    },
    initialHP: 40,
    maxHP: 40,
    initialHandSize: 5,
    cardsDrawnPerTurn: 2,
    cardsDeployedPerTurn: 2,
    elements: ["fire", "water", "earth", "air", "nature"],
    victoryConditions: [
      "Reduce opponent HP to 0",
      "Opponent has no cards in deck and no cards in hand",
    ],
    combatResolution: {
      overview: "Combat resolves in a fixed 8-step order each round. All steps execute automatically after both players end their turn.",
      steps: [
        { step: 1, name: "Deploy & Reveal", description: "Both players' face-down cards are revealed on the battlefield." },
        { step: 2, name: "Calculate Power", description: "Each card's final power is calculated: base power + buff modifiers - debuff modifiers (minimum 0). Totals for each side are summed." },
        { step: 3, name: "Quick Strike", description: "Cards with Quick Strike deal their trait value as direct HP damage to the opponent. This damage bypasses power comparison entirely. Commander first_strike abilities also apply here." },
        { step: 4, name: "Guardian Block", description: "Guardian trait and commander shield abilities reduce total incoming damage (combat damage + Quick Strike). Blocked amount is capped at actual incoming damage — cannot over-block." },
        { step: 5, name: "Healing", description: "Restoration trait and commander heal abilities restore HP BEFORE damage is applied. Healing is capped at max HP (40) — cannot exceed starting health." },
        { step: 6, name: "Determine Winner", description: "The side with higher total power wins. Equal power = draw. Winner gains +1 Victory Point, loser gains +1 Withdrawal Point. Draws give both +1 VP and +1 WP." },
        { step: 7, name: "Apply Net Damage", description: "Loser takes net damage = (power difference + winner's Quick Strike - loser's Guardian). Winner takes back-damage = (loser's Quick Strike - winner's Guardian). Both values are after Guardian blocking and minimum 0." },
        { step: 8, name: "Care Package", description: "Cards with Care Package trait let their owner draw additional cards from their deck." },
      ],
      keyRules: [
        "Healing applies BEFORE damage — a player heals first (capped at 40 HP), then takes net damage.",
        "Guardian blocks ALL incoming damage (combat + Quick Strike combined), not just combat damage.",
        "Quick Strike damage resolves even on draws — both players can take QS damage in a tied round.",
        "The winner of a round is determined by power totals only, not by net damage dealt.",
        "The 'damage' field in the combat log equals the loser's net damage after Guardian, not the raw power difference.",
      ],
    },
    combatLogFields: {
      description: "Fields returned in each combat log entry (stored in gameState.lastCombatLog and gameState.combatHistory[])",
      fields: {
        player1Cards: "Array of card breakdowns (cardId, cardName, basePower, buffBonus, debuffPenalty, finalPower, traitName, traitValue)",
        player2Cards: "Array of card breakdowns (same structure as player1Cards)",
        player1Total: "number — sum of all player1 card finalPower values",
        player2Total: "number — sum of all player2 card finalPower values",
        damage: "number — loser's net damage after Guardian blocking (NOT raw power difference)",
        winner: "'player1' | 'player2' | 'tie' — determined by power totals",
        turn: "number — the turn number this combat occurred on",
        abilityEffects: "Array of { playerSide, abilityName, effectDescription, phase } — commander abilities used this turn",
        player1QuickStrikeDamage: "number — total Quick Strike damage dealt BY player1 (to player2's HP)",
        player2QuickStrikeDamage: "number — total Quick Strike damage dealt BY player2 (to player1's HP)",
        player1GuardianBlocked: "number — total damage blocked by player1's Guardian/shield (capped at incoming)",
        player2GuardianBlocked: "number — total damage blocked by player2's Guardian/shield (capped at incoming)",
        player1Healing: "number — total HP restored to player1 (applied before damage, capped at max HP)",
        player2Healing: "number — total HP restored to player2 (applied before damage, capped at max HP)",
        player1CardsDrawn: "number — extra cards drawn by player1 from Care Package trait",
        player2CardsDrawn: "number — extra cards drawn by player2 from Care Package trait",
        player1NetDmg: "number — actual HP lost by player1 this round (after Guardian blocking)",
        player2NetDmg: "number — actual HP lost by player2 this round (after Guardian blocking)",
      },
    },
  },
  dataModels: {
    Card: {
      id: "string (UUID)",
      name: "string",
      element: "string (fire | water | earth | air | nature)",
      power: "number (1-10)",
      trait: "string | null",
      traitValue: "number | null",
      buffModifier: "number (default 0)",
      buffColor: "string | null",
      debuffModifier: "number (default 0)",
      debuffColor: "string | null",
      description: "string | null",
      imageUrl: "string | null (data URL or HTTP URL)",
      isCommander: "boolean",
    },
    Commander: {
      id: "string (UUID)",
      name: "string",
      element: "string",
      ability: "string",
      abilityDescription: "string",
      imageUrl: "string | null",
    },
    User: {
      id: "string (UUID)",
      email: "string",
      firstName: "string | null",
      lastName: "string | null",
      profileImageUrl: "string | null",
      createdAt: "string (ISO 8601)",
      updatedAt: "string (ISO 8601)",
    },
    UserDeck: {
      id: "string (UUID)",
      userId: "string (UUID)",
      name: "string",
      commanderId: "string (UUID)",
      cardIds: "string[] (40 card UUIDs)",
      createdAt: "string (ISO 8601)",
      updatedAt: "string (ISO 8601)",
    },
    PlayerStats: {
      id: "string (UUID)",
      userId: "string (UUID)",
      totalXp: "number",
      level: "number",
      gamesPlayed: "number",
      gamesWon: "number",
      gamesLost: "number",
      totalDamageDealt: "number",
      totalCardsPlayed: "number",
      favoriteElement: "string | null",
      favoriteCommander: "string | null",
      longestWinStreak: "number",
      currentWinStreak: "number",
      updatedAt: "string (ISO 8601)",
    },
    PlayerRating: {
      id: "string (UUID)",
      userId: "string (UUID)",
      rating: "number (default 1000, ELO)",
      wins: "number",
      losses: "number",
      streak: "number",
    },
  },
  configEndpoint: {
    overview: "GET /api/config should be the FIRST call on app launch. It returns feature flags, season info, maintenance status, and API version for client compatibility checking. No authentication required.",
    endpoint: {
      method: "GET",
      path: "/api/config",
      requiresAuth: false,
      description: "Returns server configuration, feature flags, and current season info. Both web and mobile clients should call this on launch and cache for 5 minutes.",
      response: {
        apiVersion: "string (semver, e.g. '2.2.0') — check against minClientVersion",
        features: {
          description: "Object of feature flag keys to boolean values. Only show UI for features that are true.",
          example: {
            economy_enabled: false,
            collection_enabled: false,
            shop_enabled: false,
            pack_opening_enabled: false,
            crafting_enabled: false,
            ranked_seasons: false,
            battle_pass: false,
            weekly_challenges: false,
            emotes: false,
            spectator_mode: true,
            practice_mode: true,
            multiplayer: true,
            friends_system: true,
            daily_challenges: true,
            achievements: true,
            leaderboard: true,
          },
        },
        season: "object | null — { id, name, start, end, daysRemaining } when a ranked season is active",
        maintenance: "{ active: boolean, message?: string } — if active is true, show maintenance screen and block gameplay",
        minClientVersion: "string (semver) — mobile should compare against their app version and prompt update if too old",
        serverTime: "string (ISO 8601) — use for clock sync on daily/weekly challenge timers",
      },
    },
    adminEndpoints: {
      getFlags: {
        method: "GET",
        path: "/api/admin/feature-flags",
        requiresAuth: true,
        adminOnly: true,
        description: "List all feature flags with descriptions",
      },
      updateFlag: {
        method: "PATCH",
        path: "/api/admin/feature-flags/:key",
        requiresAuth: true,
        adminOnly: true,
        body: { enabled: "boolean" },
        description: "Toggle a feature flag on or off",
      },
      updateConfig: {
        method: "PUT",
        path: "/api/admin/server-config/:key",
        requiresAuth: true,
        adminOnly: true,
        body: { value: "any (JSON object)" },
        description: "Update server config. Allowed keys: maintenance, current_season, min_client_version",
        examples: {
          maintenance: { value: { active: true, message: "Server maintenance in progress" } },
          current_season: { value: { id: "season-1", name: "Season 1: Dawn", start: "2026-04-01", end: "2026-04-30" } },
          min_client_version: { value: { version: "1.2.0" } },
        },
      },
    },
  },
  economy: {
    overview: "Card economy system with currencies (gold, gems, dust), card collection, pack opening, crafting, and disenchanting. Gated by the 'economy_enabled' feature flag.",
    raritySystem: {
      description: "Card rarity is derived from power level. Rarity determines pack pull rates, craft costs, and disenchant values.",
      mapping: {
        "Common (power 1-3)": { craftCost: 40, disenchantValue: 5, packWeight: "60%" },
        "Rare (power 4-6)": { craftCost: 100, disenchantValue: 20, packWeight: "25%" },
        "Epic (power 7-8)": { craftCost: 400, disenchantValue: 100, packWeight: "10%" },
        "Legendary (power 9-10)": { craftCost: 1600, disenchantValue: 400, packWeight: "5%" },
      },
    },
    starterRewards: {
      gold: 500,
      gems: 0,
      dust: 0,
      starterCollection: "2 copies of every power 1-5 (Common + Rare) card across all elements",
    },
    goldRewards: {
      matchWin: 30,
      matchLoss: 10,
      matchDraw: 15,
      forfeitWin: 15,
      dailyChallenge: 25,
      achievement: 50,
    },
    packInfo: {
      costGold: 100,
      cardsPerPack: 5,
      rarityWeights: { Common: 60, Rare: 25, Epic: 10, Legendary: 5 },
    },
    endpoints: {
      getCurrencies: {
        method: "GET",
        path: "/api/currencies",
        requiresAuth: true,
        description: "Get player's currency balances. Auto-creates starter balances on first call.",
        response: {
          gold: { type: "number", description: "Gold balance (earn from matches)" },
          gems: { type: "number", description: "Gem balance (premium currency)" },
          dust: { type: "number", description: "Dust balance (from disenchanting, used for crafting)" },
        },
      },
      getCollection: {
        method: "GET",
        path: "/api/collection",
        requiresAuth: true,
        description: "Get all cards the player owns with quantities.",
        response: {
          type: "array",
          items: {
            cardId: { type: "string", description: "Card ID" },
            quantity: { type: "number", description: "Number of copies owned" },
          },
        },
      },
      openPack: {
        method: "POST",
        path: "/api/packs/open",
        requiresAuth: true,
        description: "Purchase and open a card pack using gold. Returns 5 cards with rarity-weighted random selection.",
        body: {
          packType: { type: "string", required: false, default: "standard", description: "Pack type (currently only 'standard')" },
        },
        response: {
          cards: { type: "array", description: "Array of { cardId, rarity, isNew }" },
          costGold: { type: "number" },
          remainingGold: { type: "number" },
        },
        errors: {
          400: "Not enough gold",
        },
      },
      craftCard: {
        method: "POST",
        path: "/api/cards/craft",
        requiresAuth: true,
        description: "Craft a specific card using dust. Cost depends on card rarity.",
        body: {
          cardId: { type: "string", required: true, description: "ID of the card to craft" },
        },
        response: {
          cardId: { type: "string" },
          rarity: { type: "string" },
          dustCost: { type: "number" },
          remainingDust: { type: "number" },
        },
        errors: {
          400: "Not enough dust",
          404: "Card not found",
        },
      },
      disenchantCard: {
        method: "POST",
        path: "/api/cards/disenchant",
        requiresAuth: true,
        description: "Disenchant owned card copies for dust. Dust gained depends on card rarity.",
        body: {
          cardId: { type: "string", required: true, description: "ID of the card to disenchant" },
          quantity: { type: "number", required: false, default: 1, description: "Number of copies to disenchant" },
        },
        response: {
          cardId: { type: "string" },
          quantity: { type: "number" },
          rarity: { type: "string" },
          dustGained: { type: "number" },
          remainingDust: { type: "number" },
        },
        errors: {
          400: "Not enough copies / invalid quantity",
          404: "Card not found",
        },
      },
      claimStarter: {
        method: "POST",
        path: "/api/collection/starter",
        requiresAuth: true,
        description: "Claim starter collection and currencies. Idempotent — safe to call multiple times. Also auto-granted on registration.",
        response: {
          collection: { type: "array", description: "Full collection after claiming" },
          currencies: { type: "object", description: "Currency balances after claiming" },
        },
      },
      claimChallenge: {
        method: "POST",
        path: "/api/player-challenges/:id/claim",
        requiresAuth: true,
        description: "Claim reward for a completed daily challenge. Gold is automatically granted when economy is enabled. Uses claimedAt field for idempotency.",
        response: {
          type: "PlayerChallenge object with claimedAt set",
        },
        errors: {
          400: "Challenge not completed or already claimed",
        },
      },
      claimAchievement: {
        method: "POST",
        path: "/api/achievements/:id/claim",
        requiresAuth: true,
        description: "Claim gold reward for an unlocked achievement.",
        response: {
          claimed: { type: "boolean" },
          goldAwarded: { type: "number" },
          currencies: { type: "object", description: "Updated currency balances" },
        },
        errors: {
          400: "Achievement not yet unlocked",
          404: "Achievement progress not found",
        },
      },
    },
  },
};

export function registerApiDocsRoutes(app: Express) {
  app.get("/api/docs", (_req, res) => {
    res.json(API_DOCS);
  });
}
