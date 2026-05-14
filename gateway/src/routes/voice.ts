import type { RouteContext } from "./types.js";

export function registerVoiceRoutes(ctx: RouteContext): void {
  const { app, bridge } = ctx;

  app.post("/api/voice/stt", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400);
        return { error: "No audio file uploaded" };
      }
      const buffer = await data.toBuffer();
      const file = new File([new Uint8Array(buffer)], data.filename, { type: data.mimetype });
      const result = await bridge.transcribeAudio(file);
      return result;
    } catch (err) {
      reply.code(502);
      return { error: "Voice transcription failed" };
    }
  });

  app.post("/api/voice/tts", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const text = body.text as string;
      if (!text) {
        reply.code(400);
        return { error: "text is required" };
      }
      const stream = body.stream as boolean | undefined;
      const voice = body.voice as string | undefined;
      const model = body.model as string | undefined;

      if (stream) {
        reply.raw.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache",
        });
        for await (const chunk of bridge.synthesizeSpeechStream(text, voice, model)) {
          reply.raw.write(chunk);
        }
        reply.raw.end();
        return;
      }

      const result = await bridge.synthesizeSpeech(text, voice, model);
      return result;
    } catch (err) {
      reply.code(502);
      return { error: "Voice synthesis failed" };
    }
  });
}
