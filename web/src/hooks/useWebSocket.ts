import { useState, useRef, useEffect, useCallback } from "react";
import type { Message, StreamChunk } from "../types";

function applyChunk(prev: Message[], chunk: StreamChunk, sessionId: string, setSessionId: (id: string) => void): Message[] {
  if (chunk.error) return prev;
  if (chunk.session_id && !sessionId) setSessionId(chunk.session_id);

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
}

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const sseFallback = useRef(false);
  const wsFailCount = useRef(0);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      wsFailCount.current = 0;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.onclose = () => {
      setConnected(false);
      wsFailCount.current += 1;
      if (wsFailCount.current >= 3) {
        sseFallback.current = true;
        setConnected(true);
        return;
      }
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onmessage = (event) => {
      const chunk: StreamChunk = JSON.parse(event.data as string);
      setMessages((prev) => applyChunk(prev, chunk, sessionId, setSessionId));
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

  const sendSSE = useCallback(async (text: string) => {
    const params = new URLSearchParams({ message: text });
    if (sessionId) params.set("session_id", sessionId);
    try {
      const res = await fetch(`/api/chat/stream?${params}`);
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") return;
          const chunk: StreamChunk = JSON.parse(payload);
          setMessages((prev) => applyChunk(prev, chunk, sessionId, setSessionId));
        }
      }
    } catch {
      sseFallback.current = false;
      wsFailCount.current = 0;
    }
  }, [sessionId]);

  const send = useCallback((text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);

    if (sseFallback.current) {
      sendSSE(text);
      return;
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ message: text, session_id: sessionId || undefined }));
    }
  }, [sessionId, sendSSE]);

  return { messages, connected, send, sessionId };
}
