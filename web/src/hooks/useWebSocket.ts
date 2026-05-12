import { useState, useRef, useEffect, useCallback } from "react";
import type { Message, StreamChunk } from "../types";

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onmessage = (event) => {
      const chunk: StreamChunk = JSON.parse(event.data as string);
      if (chunk.error) return;
      if (chunk.session_id && !sessionId) setSessionId(chunk.session_id);

      setMessages((prev) => {
        const last = prev[prev.length - 1];

        if (chunk.type === "tool_call" && last?.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolEvents: [...(last.toolEvents || []), { type: "tool_call", name: chunk.tool_call?.function?.name }],
            },
          ];
        }

        if (chunk.type === "tool_result" && last?.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolEvents: [
                ...(last.toolEvents || []),
                { type: "tool_result", name: chunk.name, content: chunk.content },
              ],
            },
          ];
        }

        if (last?.role === "assistant" && last.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + (chunk.delta || ""), streaming: !chunk.done },
          ];
        }
        if (chunk.delta) {
          return [
            ...prev,
            { id: chunk.id, role: "assistant", content: chunk.delta, streaming: !chunk.done, toolEvents: [] },
          ];
        }
        return prev;
      });
    };

    wsRef.current = ws;
  }, [url, sessionId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    wsRef.current.send(JSON.stringify({ message: text, session_id: sessionId || undefined }));
  }, [sessionId]);

  return { messages, connected, send, sessionId };
}
