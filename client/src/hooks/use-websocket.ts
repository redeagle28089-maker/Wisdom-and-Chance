import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "./use-auth";

interface WSMessage {
  type: string;
  payload?: any;
}

type MessageHandler = (message: WSMessage) => void;

const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_MISSED_PONGS = 3;
const RECONNECT_DELAY_MS = 3_000;
// Don't buffer outbound messages forever — drop stale ones older than 30 s
// so an offline tab doesn't deliver a flood of zombie actions on reconnect.
const QUEUE_TTL_MS = 30_000;

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<number | null>(null);
  // Outbound queue: messages sent while the socket is CONNECTING/CLOSED are
  // buffered and flushed on the next "open". Each entry tracks its enqueue
  // time so we can drop expired ones (lag handling, task #63).
  const outboundQueueRef = useRef<Array<{ message: WSMessage; enqueuedAt: number }>>([]);
  // Heartbeat machinery — send {type:"ping"} every HEARTBEAT_INTERVAL_MS,
  // count missed pongs, and force ws.close() after MAX_MISSED_PONGS to kick
  // the reconnect path. Mirrors the server-side WS-level heartbeat watchdog.
  const heartbeatTimerRef = useRef<number | null>(null);
  const missedPongsRef = useRef(0);

  const updatePendingCount = useCallback(() => {
    setPendingCount(outboundQueueRef.current.length);
  }, []);

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    const queue = outboundQueueRef.current;
    outboundQueueRef.current = [];
    for (const entry of queue) {
      if (now - entry.enqueuedAt > QUEUE_TTL_MS) continue;
      try {
        ws.send(JSON.stringify(entry.message));
      } catch (e) {
        // If send fails, drop and continue — the next reconnect will refill.
        console.warn("[ws] flush send failed:", e);
      }
    }
    updatePendingCount();
  }, [updatePendingCount]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    missedPongsRef.current = 0;
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatTimerRef.current = window.setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      missedPongsRef.current += 1;
      if (missedPongsRef.current > MAX_MISSED_PONGS) {
        console.warn("[ws] missed pongs threshold reached — forcing reconnect");
        try { ws.close(); } catch {}
        return;
      }
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch (e) {
        console.warn("[ws] ping send failed:", e);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat]);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.id) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      missedPongsRef.current = 0;
      flushQueue();
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        if (message.type === "auth_error") {
          console.warn("WebSocket authentication failed:", message.payload?.message);
          ws.close();
          return;
        }

        // Reset missed-pong counter on any incoming traffic, not only "pong".
        // Servers may send game_state, presence_update, etc. — all of those
        // prove the socket is alive.
        missedPongsRef.current = 0;

        if (message.type === "pong") return;

        const handlers = handlersRef.current.get(message.type);
        if (handlers) {
          handlers.forEach((handler) => handler(message));
        }
        const allHandlers = handlersRef.current.get("*");
        if (allHandlers) {
          allHandlers.forEach((handler) => handler(message));
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      stopHeartbeat();
      wsRef.current = null;
      if (isAuthenticated) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [isAuthenticated, user?.id, flushQueue, startHeartbeat, stopHeartbeat]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    stopHeartbeat();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [stopHeartbeat]);

  /**
   * Send a message immediately if the socket is OPEN, otherwise buffer it
   * for delivery on the next "open" event. Buffered messages older than
   * QUEUE_TTL_MS are dropped on flush so we don't deliver stale actions
   * after a long disconnect.
   */
  const send = useCallback((message: WSMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return;
      } catch (e) {
        console.warn("[ws] send failed, queuing:", e);
      }
    }
    outboundQueueRef.current.push({ message, enqueuedAt: Date.now() });
    updatePendingCount();
  }, [updatePendingCount]);

  const subscribe = useCallback((type: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    return () => {
      const handlers = handlersRef.current.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(type);
        }
      }
    };
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    send({ type: "join_room", payload: { roomId } });
  }, [send]);

  const leaveRoom = useCallback((roomId: string) => {
    send({ type: "leave_room", payload: { roomId } });
  }, [send]);

  const joinGame = useCallback((gameId: string) => {
    send({ type: "join_game", payload: { gameId } });
  }, [send]);

  const leaveGame = useCallback((gameId: string) => {
    send({ type: "leave_game", payload: { gameId } });
  }, [send]);

  const sendRoomMessage = useCallback((roomId: string, message: string) => {
    send({ type: "room_message", payload: { roomId, message } });
  }, [send]);

  const sendGameMessage = useCallback((gameId: string, message: string) => {
    send({ type: "game_message", payload: { gameId, message } });
  }, [send]);

  /**
   * Send a multiplayer game action. A clientActionId is generated so the
   * server can dedupe retries (e.g. when a buffered message is flushed
   * after reconnect). Returns the clientActionId so callers can correlate
   * with the matching `action_ack` message.
   */
  const sendGameAction = useCallback((gameId: string, action: string, data: any, clientActionId?: string) => {
    const id = clientActionId
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    send({ type: "game_action", payload: { gameId, action, data, clientActionId: id } });
    return id;
  }, [send]);

  const sendRoomUpdate = useCallback((roomId: string, data: any) => {
    send({ type: "room_update", payload: { roomId, data } });
  }, [send]);

  const setPlayerReady = useCallback((roomId: string, ready: boolean, deckId?: string) => {
    send({ type: "player_ready", payload: { roomId, ready, deckId } });
  }, [send]);

  const startGame = useCallback((roomId: string, gameId: string) => {
    send({ type: "game_start", payload: { roomId, gameId } });
  }, [send]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, user?.id, connect, disconnect]);

  return {
    isConnected,
    pendingCount,
    send,
    subscribe,
    joinRoom,
    leaveRoom,
    joinGame,
    leaveGame,
    sendRoomMessage,
    sendGameMessage,
    sendGameAction,
    sendRoomUpdate,
    setPlayerReady,
    startGame,
  };
}
