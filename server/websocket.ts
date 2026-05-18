import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "http";
import { log } from "./index";
import { db } from "./db";
import { gameRooms, users, roomSpectators } from "@shared/schema";
import { eq, or, and } from "drizzle-orm";
import { storage } from "./storage";
import { getSessionStore, getSessionSecret } from "./replit_integrations/auth/replitAuth";
import cookie from "cookie";
import cookieSignature from "cookie-signature";
import { filterObscenity } from "./obscenity-filter";
import jwt from "jsonwebtoken";
import { gameEngine } from "./gameEngine";
import { handleGameEndRewards, updateWeeklyChallengeProgress } from "./economyService";

interface ConnectedUser {
  id: string;
  ws: WebSocket;
  roomId?: string;
  gameId?: string;
  displayName?: string;
  isAlive?: boolean;
  lastPongAt?: number;
}

const HEARTBEAT_INTERVAL_MS = 15_000;
function getHeartbeatTimeoutMs(): number {
  return Number(process.env.MP_HEARTBEAT_TIMEOUT_MS) || 45_000;
}

interface WSMessage {
  type: string;
  payload?: any;
}

interface AuthenticatedSession {
  userId: string;
  email?: string;
  displayName?: string;
}

class GameWebSocketServer {
  private wss: WebSocketServer;
  private users: Map<string, ConnectedUser> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private games: Map<string, Set<string>> = new Map();

  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.setupHandlers();
    this.startHeartbeatLoop();
    log("WebSocket server initialized on /ws", "websocket");
  }

  /**
   * Per-connection heartbeat watchdog (lag handling, task #63). Every
   * HEARTBEAT_INTERVAL_MS we send a low-level WS ping frame to each socket.
   * The native pong handler stamps lastPongAt. Any socket whose pong is
   * older than MP_HEARTBEAT_TIMEOUT_MS (default 45s) is force-terminated so
   * the close handler runs (triggering the disconnect-forfeit timer) and
   * the client reconnects fresh — preventing "ghost players" on stalled
   * NAT/proxy connections.
   */
  private startHeartbeatLoop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => this.runHeartbeatTickOnce(), HEARTBEAT_INTERVAL_MS);
  }

  /**
   * One heartbeat iteration — exposed publicly so an admin test endpoint
   * can fire it on demand instead of waiting up to HEARTBEAT_INTERVAL_MS
   * (15 s) for the natural tick (lag handling, task #63). Pass a
   * `targetUserId` to scope the iteration to a single connection (used by
   * the hardening test so a shortened timeout doesn't take out unrelated
   * live test clients whose pong is older than the test threshold).
   */
  public runHeartbeatTickOnce(targetUserId?: string) {
    const now = Date.now();
    const timeoutMs = getHeartbeatTimeoutMs();
    for (const [userId, user] of Array.from(this.users.entries())) {
      if (targetUserId && userId !== targetUserId) continue;
      const ws = user.ws;
      if (ws.readyState !== WebSocket.OPEN) continue;
      const lastPong = user.lastPongAt ?? now;
      if (now - lastPong > timeoutMs) {
        log(`Heartbeat timeout for user ${userId} — terminating socket`, "websocket");
        try { ws.terminate(); } catch {}
        continue;
      }
      try { ws.ping(); } catch {}
    }
  }

  private parseSessionFromRequest(req: IncomingMessage): Promise<AuthenticatedSession | null> {
    return new Promise((resolve) => {
      try {
        const cookies = cookie.parse(req.headers.cookie || "");
        let sessionCookie = cookies["connect.sid"];
        
        if (!sessionCookie) {
          log("No session cookie found", "websocket");
          resolve(null);
          return;
        }

        // URL decode the cookie value first
        sessionCookie = decodeURIComponent(sessionCookie);

        // Parse signed cookie: format is "s:<sessionId>.<signature>"
        const secret = getSessionSecret();
        let sessionId: string | false = false;
        
        if (sessionCookie.startsWith("s:")) {
          // Remove the "s:" prefix and unsign
          // cookie-signature.unsign expects just the "<sessionId>.<signature>" part
          sessionId = cookieSignature.unsign(sessionCookie.slice(2), secret);
          if (!sessionId) {
            log("Invalid session signature", "websocket");
            resolve(null);
            return;
          }
        } else {
          // Unsigned cookie (shouldn't happen with secure setup)
          sessionId = sessionCookie;
        }

        // Get session from store
        const store = getSessionStore();
        store.get(sessionId, (err: any, session: any) => {
          if (err || !session) {
            log(`Session not found or error: ${err?.message || 'no session'}`, "websocket");
            resolve(null);
            return;
          }

          // Extract user from passport session
          const passportUser = session?.passport?.user;
          if (!passportUser?.claims?.sub) {
            log("No user in session", "websocket");
            resolve(null);
            return;
          }

          const userId = passportUser.claims.sub;
          const email = passportUser.claims.email;
          const displayName = passportUser.claims.first_name || email?.split('@')[0] || "Player";

          log(`Session authenticated for user ${userId}`, "websocket");
          resolve({ userId, email, displayName });
        });
      } catch (error: any) {
        log(`Session parse error: ${error.message}`, "websocket");
        resolve(null);
      }
    });
  }

  private async getUserDisplayName(userId: string): Promise<string> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user) {
        return user.firstName || user.email?.split('@')[0] || "Player";
      }
    } catch (e) {
      // Fallback if DB query fails
    }
    return "Player";
  }

  private async isRoomMember(userId: string, roomId: string): Promise<boolean> {
    try {
      // Check if user is host or guest
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId)).limit(1);
      if (room) {
        const isHostOrGuest = room.hostId === userId || room.guestId === userId;
        if (isHostOrGuest) return true;
      }
      
      // Check if user is a spectator
      const [spectator] = await db
        .select()
        .from(roomSpectators)
        .where(and(eq(roomSpectators.roomId, roomId), eq(roomSpectators.userId, userId)))
        .limit(1);
      
      return !!spectator;
    } catch (e) {
      // Fallback if DB query fails
    }
    return false;
  }

  private async isGameParticipant(userId: string, gameId: string): Promise<boolean> {
    try {
      // Check if user is a player in this game
      const game = await storage.getGame(gameId);
      if (game) {
        return game.player1Id === userId || game.player2Id === userId;
      }
      return false;
    } catch (e) {
      log(`Error checking game participant: ${e}`, "websocket");
      return false;
    }
  }

  private async parseJWTFromRequest(req: IncomingMessage): Promise<AuthenticatedSession | null> {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");
      if (!token) return null;

      const secret = process.env.SESSION_SECRET;
      if (!secret) return null;

      const payload = jwt.verify(token, secret) as any;
      if (!payload?.userId) return null;

      const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (!user) return null;

      const displayName = user.firstName || user.email?.split("@")[0] || "Player";
      log(`JWT authenticated for user ${user.id}`, "websocket");
      return { userId: user.id, email: user.email || undefined, displayName };
    } catch (error: any) {
      log(`JWT parse error: ${error.message}`, "websocket");
      return null;
    }
  }

  private setupHandlers() {
    this.wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
      let session = await this.parseSessionFromRequest(req);
      
      if (!session) {
        session = await this.parseJWTFromRequest(req);
      }

      if (!session) {
        log("WebSocket connection rejected: no valid session or token", "websocket");
        ws.send(JSON.stringify({ type: "auth_error", payload: { message: "Authentication required" } }));
        ws.close(4001, "Authentication required");
        return;
      }

      const userId = session.userId;
      const displayName = session.displayName || "Player";
      
      this.users.set(userId, {
        id: userId,
        ws,
        displayName,
        isAlive: true,
        lastPongAt: Date.now(),
      });
      this.broadcastPresence(userId, "online");
      log(`User ${userId} (${displayName}) authenticated`, "websocket");

      // Heartbeat: stamp lastPongAt whenever the client responds to a WS
      // ping frame (sent by startHeartbeatLoop). The legacy app-level
      // {type:"ping"} → {type:"pong"} handler below remains for older
      // clients that don't speak native ping/pong.
      ws.on("pong", () => {
        const u = this.users.get(userId);
        if (u) u.lastPongAt = Date.now();
      });

      ws.send(JSON.stringify({ type: "auth_success", payload: { userId, displayName } }));

      ws.on("message", async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          
          switch (message.type) {
            // Auth message is now ignored - authentication happens on connection
            case "auth":
              // Legacy support: just acknowledge, already authenticated
              ws.send(JSON.stringify({ type: "auth_success", payload: { userId, displayName } }));
              break;

            case "join_room":
              if (message.payload?.roomId) {
                const roomId = message.payload.roomId;
                const isMember = await this.isRoomMember(userId, roomId);
                if (isMember) {
                  this.joinRoom(userId, roomId);
                } else {
                  ws.send(JSON.stringify({ 
                    type: "error", 
                    payload: { message: "Not authorized to join this room" } 
                  }));
                  log(`User ${userId} denied access to room ${roomId}`, "websocket");
                }
              }
              break;

            case "leave_room":
              if (message.payload?.roomId) {
                this.leaveRoom(userId, message.payload.roomId);
              }
              break;

            case "join_game":
              if (message.payload?.gameId) {
                const gameId = message.payload.gameId;
                const isParticipant = await this.isGameParticipant(userId, gameId);
                if (isParticipant) {
                  this.joinGame(userId, gameId);
                } else {
                  ws.send(JSON.stringify({ 
                    type: "error", 
                    payload: { message: "Not authorized to join this game" } 
                  }));
                  log(`User ${userId} denied access to game ${gameId}`, "websocket");
                }
              }
              break;

            case "leave_game":
              if (message.payload?.gameId) {
                this.leaveGame(userId, message.payload.gameId);
              }
              break;

            case "room_message":
              if (message.payload?.roomId) {
                const connectedUser = this.users.get(userId);
                this.broadcastToRoom(message.payload.roomId, {
                  type: "room_message",
                  payload: {
                    roomId: message.payload.roomId,
                    senderId: userId,
                    senderName: connectedUser?.displayName || displayName,
                    message: filterObscenity(message.payload.message || ""),
                    timestamp: new Date().toISOString(),
                  },
                });
              }
              break;

            case "game_message":
              if (message.payload?.gameId) {
                const connectedUser = this.users.get(userId);
                this.broadcastToGame(message.payload.gameId, {
                  type: "game_message",
                  payload: {
                    gameId: message.payload.gameId,
                    senderId: userId,
                    senderName: connectedUser?.displayName || displayName,
                    message: filterObscenity(message.payload.message || ""),
                    timestamp: new Date().toISOString(),
                  },
                });
              }
              break;

            case "game_action":
              if (message.payload?.gameId) {
                await this.handleGameAction(userId, message.payload);
              }
              break;

            case "room_update":
              if (message.payload?.roomId) {
                this.broadcastToRoom(message.payload.roomId, {
                  type: "room_update",
                  payload: message.payload.data,
                });
              }
              break;

            case "player_ready":
              if (message.payload?.roomId) {
                this.broadcastToRoom(message.payload.roomId, {
                  type: "player_ready",
                  payload: {
                    playerId: userId,
                    ready: message.payload.ready,
                    deckId: message.payload.deckId,
                  },
                });
              }
              break;

            case "game_start":
              if (message.payload?.roomId) {
                this.broadcastToRoom(message.payload.roomId, {
                  type: "game_start",
                  payload: {
                    gameId: message.payload.gameId,
                  },
                });
              }
              break;

            case "ping":
              // Treat an app-level ping as proof of life as well, so the
              // client's heartbeat code path also keeps lastPongAt fresh.
              {
                const u = this.users.get(userId);
                if (u) u.lastPongAt = Date.now();
              }
              ws.send(JSON.stringify({ type: "pong", payload: { ts: Date.now() } }));
              break;
          }
        } catch (error) {
          log(`WebSocket message error: ${error}`, "websocket");
        }
      });

      ws.on("close", () => {
        const user = this.users.get(userId);
        if (user?.roomId) {
          this.leaveRoom(userId, user.roomId);
        }
        if (user?.gameId) {
          const gameId = user.gameId;
          const activeGame = gameEngine.getActiveGame(gameId);
          if (activeGame && activeGame.game.status === "in_progress" && activeGame.game.gameType === "multiplayer") {
            gameEngine.handleDisconnect(gameId, userId, (winnerId: string) => {
              this.broadcastToGame(gameId, {
                type: "game_over",
                payload: { gameId, winnerId, reason: "opponent_forfeit" },
              });
              handleGameEndRewards(winnerId, activeGame.game.player1Id, activeGame.game.player2Id, "forfeit");
              this.sendGameStateToPlayers(gameId);
              gameEngine.removeGame(gameId);
            });
            this.broadcastToGame(gameId, {
              type: "opponent_disconnected",
              payload: { gameId, disconnectedPlayerId: userId, reconnectTimeout: 60 },
            }, userId);
          } else {
            this.leaveGame(userId, gameId);
          }
        }
        this.users.delete(userId);
        this.broadcastPresence(userId, "offline");
        log(`User ${userId} disconnected`, "websocket");
      });

      ws.on("error", (error) => {
        log(`WebSocket error: ${error}`, "websocket");
      });
    });
  }

  private joinRoom(userId: string, roomId: string) {
    const user = this.users.get(userId);
    if (!user) return;

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(userId);
    user.roomId = roomId;

    this.broadcastToRoom(roomId, {
      type: "user_joined_room",
      payload: { userId, roomId },
    });

    log(`User ${userId} joined room ${roomId}`, "websocket");
  }

  private leaveRoom(userId: string, roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    const user = this.users.get(userId);
    if (user) {
      user.roomId = undefined;
    }

    this.broadcastToRoom(roomId, {
      type: "user_left_room",
      payload: { userId, roomId },
    });

    log(`User ${userId} left room ${roomId}`, "websocket");
  }

  private async joinGame(userId: string, gameId: string) {
    const user = this.users.get(userId);
    if (!user) return;

    if (!this.games.has(gameId)) {
      this.games.set(gameId, new Set());
    }
    this.games.get(gameId)!.add(userId);
    user.gameId = gameId;

    const activeGame = gameEngine.getActiveGame(gameId);
    if (activeGame && activeGame.game.gameType === "multiplayer") {
      const wasDisconnected = gameEngine.isPlayerDisconnected(gameId, userId);
      if (wasDisconnected) {
        gameEngine.handleReconnect(gameId, userId);
        this.broadcastToGame(gameId, {
          type: "opponent_reconnected",
          payload: { gameId, reconnectedPlayerId: userId },
        }, userId);
        log(`User ${userId} reconnected to game ${gameId}`, "websocket");
      }
      const sanitized = gameEngine.getGameStateForPlayer(gameId, userId);
      if (sanitized) {
        this.sendToUser(userId, {
          type: "game_state",
          payload: sanitized,
        });
      }
    } else if (!activeGame) {
      const game = await storage.getGame(gameId);
      if (game && game.gameType === "multiplayer" && game.status === "in_progress") {
        await gameEngine.registerGame(game);
        this.installEngineBroadcastHandler(gameId);
        const sanitized = gameEngine.getGameStateForPlayer(gameId, userId);
        if (sanitized) {
          this.sendToUser(userId, {
            type: "game_state",
            payload: sanitized,
          });
        }
      }
    }

    log(`User ${userId} joined game ${gameId}`, "websocket");
  }

  private leaveGame(userId: string, gameId: string) {
    const game = this.games.get(gameId);
    if (game) {
      game.delete(userId);
      if (game.size === 0) {
        this.games.delete(gameId);
      }
    }

    const user = this.users.get(userId);
    if (user) {
      user.gameId = undefined;
    }

    this.broadcastToGame(gameId, {
      type: "user_left_game",
      payload: { userId, gameId },
    });

    log(`User ${userId} left game ${gameId}`, "websocket");
  }

  /**
   * Hook the engine's broadcast handler so timer-driven events (turn_timeout,
   * auto-action state advance, timeout-forfeit game_over) reach connected
   * players. Installed once per game registration.
   */
  /**
   * Install the engine→WS broadcast bridge for a game. Public so the
   * room `/start` route (which pre-registers the game in the engine
   * before any client `join_game` arrives) can hook engine-initiated
   * events (turn_timeout, state_advance, game_over_from_timeout) up to
   * the websocket layer immediately. Otherwise the engine's turn-timer
   * would fire into a no-op `active.broadcastHandler?.(...)`.
   */
  public ensureEngineBroadcastHandler(gameId: string): void {
    this.installEngineBroadcastHandler(gameId);
  }

  private installEngineBroadcastHandler(gameId: string) {
    gameEngine.setBroadcastHandler(gameId, async (eventType, eventPayload) => {
      try {
        if (eventType === "turn_timeout") {
          this.broadcastToGame(gameId, { type: "turn_timeout", payload: eventPayload });
          this.sendGameStateToPlayers(gameId);
        } else if (eventType === "turn_timeout_forfeit") {
          this.broadcastToGame(gameId, { type: "turn_timeout_forfeit", payload: eventPayload });
        } else if (eventType === "state_advance") {
          this.sendGameStateToPlayers(gameId);
        } else if (eventType === "game_over_from_timeout") {
          const active = gameEngine.getActiveGame(gameId);
          this.broadcastToGame(gameId, {
            type: "game_over",
            payload: {
              gameId,
              winnerId: eventPayload.winnerId,
              reason: eventPayload.reason,
            },
          });
          if (active) {
            handleGameEndRewards(
              eventPayload.winnerId,
              active.game.player1Id,
              active.game.player2Id,
              eventPayload.reason,
            );
          }
          this.sendGameStateToPlayers(gameId);
          gameEngine.removeGame(gameId);
        }
      } catch (e) {
        log(`Engine broadcast handler error: ${e}`, "websocket");
      }
    });
  }

  private async handleGameAction(userId: string, payload: any) {
    const { gameId, action, data, clientActionId } = payload;

    const activeGame = gameEngine.getActiveGame(gameId);
    if (!activeGame) {
      const game = await storage.getGame(gameId);
      if (game && game.gameType === "multiplayer" && game.status === "in_progress") {
        await gameEngine.registerGame(game);
        this.installEngineBroadcastHandler(gameId);
      } else {
        this.broadcastToGame(gameId, {
          type: "game_update",
          payload: {
            gameId,
            playerId: userId,
            action,
            data,
            timestamp: new Date().toISOString(),
          },
        }, userId);
        return;
      }
    }

    const currentGame = gameEngine.getActiveGame(gameId);
    if (!currentGame || currentGame.game.gameType !== "multiplayer") {
      this.broadcastToGame(gameId, {
        type: "game_update",
        payload: { gameId, playerId: userId, action, data, timestamp: new Date().toISOString() },
      }, userId);
      return;
    }

    // Reject actions from non-participants (spectators, strangers).
    // Without this, gameEngine.isPlayer1 returns false for any non-P1, silently treating
    // unknown senders as Player 2.
    if (
      currentGame.game.player1Id !== userId &&
      currentGame.game.player2Id !== userId
    ) {
      this.sendToUser(userId, {
        type: "game_error",
        payload: { gameId, error: "Not a participant in this game" },
      });
      return;
    }

    // Idempotency: if the client retried with the same clientActionId, ack
    // by re-sending the latest state but don't re-execute the action. This
    // makes "send → reconnect → resend the buffered message" safe (task #63).
    if (clientActionId && gameEngine.markActionSeen(gameId, userId, String(clientActionId))) {
      this.sendGameStateToPlayers(gameId);
      this.sendToUser(userId, {
        type: "action_ack",
        payload: { gameId, clientActionId, duplicate: true },
      });
      return;
    }

    // Reset this player's consecutive-timeout counter — they're not AFK.
    gameEngine.noteManualAction(gameId, userId);

    let result;
    switch (action) {
      case "battlefield_flip":
        result = await gameEngine.processBattlefieldPhase(gameId, userId);
        break;
      case "draw":
        result = await gameEngine.processDrawPhase(gameId, userId);
        break;
      case "deploy":
        result = await gameEngine.processDeployment(gameId, userId, data?.cardIds || []);
        break;
      case "end_turn":
        result = await gameEngine.processEndTurn(gameId, userId);
        break;
      case "use_ability":
        result = await gameEngine.processAbility(gameId, userId, data?.abilityId);
        break;
      case "forfeit":
        result = await gameEngine.forfeitGame(gameId, userId, "player_forfeit");
        break;
      default:
        this.sendToUser(userId, {
          type: "game_error",
          payload: { gameId, error: `Unknown action: ${action}` },
        });
        return;
    }

    if (!result.success) {
      this.sendToUser(userId, {
        type: "game_error",
        payload: { gameId, error: result.error },
      });
      return;
    }

    if (result.type === "combat_result") {
      this.broadcastToGame(gameId, {
        type: "combat_result",
        payload: { gameId, ...result.combatResult },
      });

      const p1Id = currentGame.game.player1Id;
      const p2Id = currentGame.game.player2Id;
      const damage = result.combatResult.damage || 0;
      const p1Cards = result.combatResult.player1Breakdown?.length || 0;
      const p2Cards = result.combatResult.player2Breakdown?.length || 0;

      if (result.combatResult.winner === "player1" && damage > 0 && p1Id) {
        updateWeeklyChallengeProgress(p1Id, "deal_damage", damage).catch(() => {});
      } else if (result.combatResult.winner === "player2" && damage > 0 && p2Id) {
        updateWeeklyChallengeProgress(p2Id, "deal_damage", damage).catch(() => {});
      }

      if (p1Id && p1Cards > 0) updateWeeklyChallengeProgress(p1Id, "play_element", p1Cards).catch(() => {});
      if (p2Id && p2Cards > 0) updateWeeklyChallengeProgress(p2Id, "play_element", p2Cards).catch(() => {});

      if (result.combatResult.gameOver) {
        this.broadcastToGame(gameId, {
          type: "game_over",
          payload: { gameId, winnerId: result.combatResult.winnerId, reason: "hp_zero" },
        });
        handleGameEndRewards(result.combatResult.winnerId, currentGame.game.player1Id, currentGame.game.player2Id, "hp_zero");
      }
    }

    if (result.type === "game_over") {
      this.broadcastToGame(gameId, {
        type: "game_over",
        payload: { gameId, winnerId: result.winnerId, reason: result.reason },
      });
      handleGameEndRewards(result.winnerId, currentGame.game.player1Id, currentGame.game.player2Id, result.reason);
    }

    if (result.type === "state_update" && result.broadcast) {
      const opponentId = currentGame.game.player1Id === userId ? currentGame.game.player2Id : currentGame.game.player1Id;
      if (opponentId) {
        this.sendToUser(opponentId, {
          type: result.broadcast,
          payload: { gameId, playerId: userId },
        });
      }
    }

    this.sendGameStateToPlayers(gameId);

    // Acknowledge the action so the client can clear its "Sending…" badge
    // even when the broadcast game_state doesn't visually change anything.
    if (clientActionId) {
      this.sendToUser(userId, {
        type: "action_ack",
        payload: { gameId, clientActionId, duplicate: false },
      });
    }
  }

  private sendGameStateToPlayers(gameId: string) {
    const gamePlayers = this.games.get(gameId);
    if (!gamePlayers) return;

    gamePlayers.forEach((playerId) => {
      const sanitized = gameEngine.getGameStateForPlayer(gameId, playerId);
      if (sanitized) {
        this.sendToUser(playerId, {
          type: "game_state",
          payload: sanitized,
        });
      }
    });

    // Deliver battlefield zone to spectators (they are in the room channel but
    // not subscribed to the game channel). Battlefield cards apply globally, so
    // their name/effects are not private; only HP, hand, and deck contents are.
    this.sendBattlefieldStateToSpectators(gameId, gamePlayers);
  }

  private sendBattlefieldStateToSpectators(gameId: string, gamePlayers: Set<string>) {
    const active = gameEngine.getActiveGame(gameId);
    if (!active?.battlefieldMode) return;

    // Locate the roomId via any participant's ConnectedUser.roomId
    let roomId: string | undefined;
    gamePlayers.forEach((pid) => {
      if (!roomId) {
        const cu = this.users.get(pid);
        if (cu?.roomId) roomId = cu.roomId;
      }
    });
    if (!roomId) return;

    const gs = active.game.gameState as any;
    const payload = {
      gameId,
      battlefieldModeEnabled: true,
      activeCard: active.activeFieldCard,
      activeCardOwner: (gs.activeFieldCardOwner as string | undefined) || null,
      p1DeckRemaining: (gs.p1BattlefieldDeck as string[] | undefined)?.length ?? 0,
      p2DeckRemaining: (gs.p2BattlefieldDeck as string[] | undefined)?.length ?? 0,
    };

    const data = JSON.stringify({ type: "spectator_battlefield_update", payload });
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.forEach((uid) => {
      if (gamePlayers.has(uid)) return; // participants already got game_state
      const cu = this.users.get(uid);
      if (cu?.ws.readyState === WebSocket.OPEN) {
        cu.ws.send(data);
      }
    });
  }

  private broadcastToRoom(roomId: string, message: WSMessage, excludeUserId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const data = JSON.stringify(message);
    room.forEach((userId) => {
      if (excludeUserId && userId === excludeUserId) return;
      const user = this.users.get(userId);
      if (user?.ws.readyState === WebSocket.OPEN) {
        user.ws.send(data);
      }
    });
  }

  private broadcastToGame(gameId: string, message: WSMessage, excludeUserId?: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    const data = JSON.stringify(message);
    game.forEach((userId) => {
      if (excludeUserId && userId === excludeUserId) return;
      const user = this.users.get(userId);
      if (user?.ws.readyState === WebSocket.OPEN) {
        user.ws.send(data);
      }
    });
  }

  private broadcastPresence(userId: string, status: "online" | "offline") {
    const message = JSON.stringify({
      type: "presence_update",
      payload: { userId, status },
    });

    this.users.forEach((user, id) => {
      if (id !== userId && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(message);
      }
    });
  }

  public sendToUser(userId: string, message: WSMessage) {
    const user = this.users.get(userId);
    if (user?.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(message));
    }
  }

  public sendToRoom(roomId: string, message: WSMessage) {
    this.broadcastToRoom(roomId, message);
  }

  public sendToGame(gameId: string, message: WSMessage) {
    this.broadcastToGame(gameId, message);
  }

  public isUserOnline(userId: string): boolean {
    const user = this.users.get(userId);
    return user?.ws.readyState === WebSocket.OPEN;
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.users.keys());
  }

  public getRoomUsers(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room) : [];
  }

  public getGameUsers(gameId: string): string[] {
    const game = this.games.get(gameId);
    return game ? Array.from(game) : [];
  }
}

let wsServer: GameWebSocketServer | null = null;

export function initializeWebSocket(server: Server): GameWebSocketServer {
  wsServer = new GameWebSocketServer(server);
  return wsServer;
}

export function getWebSocketServer(): GameWebSocketServer | null {
  return wsServer;
}
