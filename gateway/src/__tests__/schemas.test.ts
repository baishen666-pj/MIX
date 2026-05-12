import { describe, it, expect } from "vitest";
import { chatRequestSchema, wsMessageSchema, pairingApproveSchema, validate } from "../schemas.js";

describe("chatRequestSchema", () => {
  it("accepts a valid chat request with message only", () => {
    const result = chatRequestSchema.parse({ message: "Hello" });
    expect(result.message).toBe("Hello");
  });

  it("accepts a chat request with all optional fields", () => {
    const result = chatRequestSchema.parse({
      message: "Hello",
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      channel: "webchat",
      metadata: { key: "value" },
    });
    expect(result.message).toBe("Hello");
    expect(result.session_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.channel).toBe("webchat");
  });

  it("rejects empty message", () => {
    expect(() => chatRequestSchema.parse({ message: "" })).toThrow();
  });

  it("rejects message over 10000 chars", () => {
    expect(() => chatRequestSchema.parse({ message: "x".repeat(10001) })).toThrow();
  });

  it("accepts message at exactly 10000 chars", () => {
    expect(() => chatRequestSchema.parse({ message: "x".repeat(10000) })).not.toThrow();
  });

  it("rejects missing message", () => {
    expect(() => chatRequestSchema.parse({})).toThrow();
  });

  it("rejects non-string message", () => {
    expect(() => chatRequestSchema.parse({ message: 123 })).toThrow();
  });

  it("rejects invalid session_id format", () => {
    expect(() => chatRequestSchema.parse({ message: "hi", session_id: "not-a-uuid" })).toThrow();
  });
});

describe("wsMessageSchema", () => {
  it("accepts a valid ws message", () => {
    const result = wsMessageSchema.parse({ message: "Hello" });
    expect(result.message).toBe("Hello");
  });

  it("accepts ws message with session_id", () => {
    const result = wsMessageSchema.parse({
      message: "Hello",
      session_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.session_id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects empty message", () => {
    expect(() => wsMessageSchema.parse({ message: "" })).toThrow();
  });

  it("rejects missing message", () => {
    expect(() => wsMessageSchema.parse({})).toThrow();
  });
});

describe("pairingApproveSchema", () => {
  it("accepts valid channel and code", () => {
    const result = pairingApproveSchema.parse({ channel: "telegram", code: "ABC123" });
    expect(result.channel).toBe("telegram");
    expect(result.code).toBe("ABC123");
  });

  it("rejects empty channel", () => {
    expect(() => pairingApproveSchema.parse({ channel: "", code: "ABC123" })).toThrow();
  });

  it("rejects empty code", () => {
    expect(() => pairingApproveSchema.parse({ channel: "telegram", code: "" })).toThrow();
  });

  it("rejects missing fields", () => {
    expect(() => pairingApproveSchema.parse({})).toThrow();
  });
});

describe("validate helper", () => {
  it("returns typed data on valid input", () => {
    const result = validate(chatRequestSchema, { message: "test" });
    expect(result.message).toBe("test");
  });

  it("throws on invalid input", () => {
    expect(() => validate(chatRequestSchema, {})).toThrow();
  });
});
