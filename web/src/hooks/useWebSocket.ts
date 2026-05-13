import { useState, useRef, useEffect, useCallback, type MutableRefObject } from "react";
import type { Message, StreamChunk } from "../types";

function applyChunk(
  prev: Message[],
  chunk: StreamChunk,
  sessionId: string,
  setSessionId: (id: string) => void,
  sendTimestamp: number | null,
  firstDeltaReceived: MutableRefObject<boolean>,
  onTtfb: (ms: number) => void,
): Message[] {
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
    if (chunk.delta && !firstDeltaReceived.current && sendTimestamp !== null) {
      firstDeltaReceived.current = true;
      onTtfb(Date.now() - sendTimestamp);
    }
    return [
      ...prev.slice(0, -1),
      { ...last, content: last.content + (chunk.delta || ""), streaming: !chunk.done },
    ];
  }
  if (chunk.delta) {
    if (!firstDeltaReceived.current && sendTimestamp !== null) {
      firstDeltaReceived.current = true;
      onTtfb(Date.now() - sendTimestamp);
    }
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
  const [ttfb, setTtfb] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseFallback = useRef(false);
  const wsFailCount = useRef(0);
  const sendTimestampRef = useRef<number | null>(null);
  const firstDeltaReceivedRef = useRef(false);

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
      setMessages((prev) => applyChunk(prev, chunk, sessionId, setSessionId, sendTimestampRef.current, firstDeltaReceivedRef, (ms) => setTtfb(ms)));
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
          setMessages((prev) => applyChunk(prev, chunk, sessionId, setSessionId, sendTimestampRef.current, firstDeltaReceivedRef, (ms) => setTtfb(ms)));
        }
      }
    } catch {
      sseFallback.current = false;
      wsFailCount.current = 0;
    }
  }, [sessionId]);

  const loadHistory = useCallback(async (sid: string) => {
    if (!sid) return;
    try {
      const res = await fetch(`/api/sessions/${sid}`);
      const data = await res.json();
      if (data.messages && Array.isArray(data.messages)) {
        const valid = data.messages.filter(
          (m: unknown) => m && typeof m === "object" && "id" in m && "role" in m && "content" in m,
        );
        setMessages(valid);
        setSessionId(sid);
      }
    } catch {
      // Session not found or unreachable
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId("");
  }, []);

  const send = useCallback((text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setTtfb(null);
    firstDeltaReceivedRef.current = false;
    sendTimestampRef.current = Date.now();

    if (sseFallback.current) {
      sendSSE(text);
      return;
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ message: text, session_id: sessionId || undefined }));
    }
  }, [sessionId, sendSSE]);

  return { messages, connected, send, sessionId, loadHistory, clearMessages, ttfb };
}
