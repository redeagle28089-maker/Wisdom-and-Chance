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

interface ConnectedUser {
  id: string;
  ws: WebSocket;
  roomId?: string;
  gameId?: string;
  displayName?: string;
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

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.setupHandlers();
    log("WebSocket server initialized on /ws", "websocket");
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

  private setupHandlers() {
    this.wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
      // Authenticate using session cookie
      const session = await this.parseSessionFromRequest(req);
      
      if (!session) {
        log("WebSocket connection rejected: no valid session", "websocket");
        ws.send(JSON.stringify({ type: "auth_error", payload: { message: "Authentication required" } }));
        ws.close(4001, "Authentication required");
        return;
      }

      const userId = session.userId;
      const displayName = session.displayName || "Player";
      
      // Register the authenticated user
      this.users.set(userId, { id: userId, ws, displayName });
      this.broadcastPresence(userId, "online");
      log(`User ${userId} (${displayName}) authenticated via session`, "websocket");
      
      // Send auth success confirmation
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
                this.broadcastToGame(message.payload.gameId, {
                  type: "game_update",
                  payload: {
                    gameId: message.payload.gameId,
                    playerId: userId,
                    action: message.payload.action,
                    data: message.payload.data,
                    timestamp: new Date().toISOString(),
                  },
                }, userId);
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
              ws.send(JSON.stringify({ type: "pong" }));
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
          this.leaveGame(userId, user.gameId);
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

  private joinGame(userId: string, gameId: string) {
    const user = this.users.get(userId);
    if (!user) return;

    if (!this.games.has(gameId)) {
      this.games.set(gameId, new Set());
    }
    this.games.get(gameId)!.add(userId);
    user.gameId = gameId;

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
