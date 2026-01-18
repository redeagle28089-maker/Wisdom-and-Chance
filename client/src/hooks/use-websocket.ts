import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "./use-auth";

interface WSMessage {
  type: string;
  payload?: any;
}

type MessageHandler = (message: WSMessage) => void;

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.id) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authentication happens automatically via session cookie
      // Server validates session on connection - no need to send auth message
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        // Handle auth error from server (session validation failed)
        if (message.type === "auth_error") {
          console.warn("WebSocket authentication failed:", message.payload?.message);
          ws.close();
          return;
        }
        
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
      wsRef.current = null;
      if (isAuthenticated) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [isAuthenticated, user?.id]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

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

  const sendGameAction = useCallback((gameId: string, action: string, data: any) => {
    send({ type: "game_action", payload: { gameId, action, data } });
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
