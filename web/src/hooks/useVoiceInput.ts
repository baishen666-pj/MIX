import { useState, useCallback, useRef } from "react";

interface UseVoiceInputResult {
  recording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

export function useVoiceInput(onTranscription: (text: string) => void): UseVoiceInputResult {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribe(blob, onTranscription, setError);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError("Microphone access denied");
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  return { recording, startRecording, stopRecording, error };
}

async function transcribe(
  blob: Blob,
  onSuccess: (text: string) => void,
  onError: (msg: string) => void,
) {
  try {
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");
    const res = await fetch("/api/voice/stt", { method: "POST", body: formData });
    const data = await res.json();
    if (data.text) {
      onSuccess(data.text);
    } else {
      onError(data.error || "Transcription failed");
    }
  } catch {
    onError("Network error during transcription");
  }
}
