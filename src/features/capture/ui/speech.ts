"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { aryaVoice } from "@/features/arya/voice";

/**
 * Voice in and out, using the browser's own speech services. Hostinger offers no WebSockets or server-side
 * transcription, so speech never leaves the browser except as the text the contributor chooses to send. Text always works.
 */

type RecognitionEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const never = () => () => undefined;
const recognitionAvailable = () => recognitionClass() !== null;
// Server and first client render both say "not available", so nothing mismatches; the browser's answer follows.
function useRecognitionSupported(): boolean {
  return useSyncExternalStore(never, recognitionAvailable, () => false);
}

const preferenceListeners = new Set<() => void>();
const readPreference = (): boolean => {
  try {
    return window.localStorage.getItem("fs-read-aloud") === "1";
  } catch {
    return false;
  }
};
const subscribePreference = (listener: () => void) => {
  preferenceListeners.add(listener);
  return () => void preferenceListeners.delete(listener);
};

export type SpeechInput = {
  supported: boolean;
  listening: boolean;
  interim: string;
  problem: string | null;
  start: () => void;
  stop: () => void;
};

const LANGUAGES: Record<string, string> = { en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN", mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN" };

export function useSpeechInput(language: string, onFinal: (text: string) => void): SpeechInput {
  const supported = useRecognitionSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const ref = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const callback = useRef(onFinal);
  useEffect(() => {
    callback.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    wantRef.current = false;
    ref.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Recognition = recognitionClass();
    if (!Recognition) return;
    setProblem(null);
    const recognition = new Recognition();
    recognition.lang = LANGUAGES[language] ?? "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) callback.current(text.trim());
        else live += text;
      }
      setInterim(live);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      wantRef.current = false;
      setListening(false);
      setProblem(event.error === "not-allowed" ? "The microphone is blocked. Allow it in your browser, or type your answer." : "Voice input stopped. You can type instead, or start it again.");
    };
    recognition.onend = () => {
      // Browsers end a session after a pause; keep listening while the contributor wants to.
      if (wantRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
      setInterim("");
    };
    ref.current = recognition;
    wantRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setProblem("Voice input could not start. You can type instead.");
    }
  }, [language]);

  useEffect(() => () => {
    wantRef.current = false;
    ref.current?.stop();
  }, []);

  return { supported, listening, interim, problem, start, stop };
}

export type SpeechOutput = {
  supported: boolean;
  speaking: boolean;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  /** Arya says it. Her mouth follows the sound (the avatar reads the voice engine itself). */
  speak: (text: string) => void;
  cancel: () => void;
};

const clientOnly = () => () => undefined;

/** Arya's voice: a studio voice from the server when it is switched on, else the best Indian-English voice on the device. */
export function useSpeechOutput(language: string): SpeechOutput {
  const supported = useSyncExternalStore(clientOnly, () => true, () => false);
  const [speaking, setSpeaking] = useState(false);
  const enabled = useSyncExternalStore(subscribePreference, readPreference, () => false);
  const token = useRef(0);

  const cancel = useCallback(() => {
    token.current += 1;
    aryaVoice.stop();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      aryaVoice.unlock(); // inside a tap this lets iOS play audio later; harmless elsewhere
      token.current += 1;
      const mine = token.current;
      setSpeaking(true);
      void aryaVoice.speak(text, language).then(() => {
        if (token.current === mine) setSpeaking(false);
      });
    },
    [language],
  );

  const setEnabled = useCallback(
    (value: boolean) => {
      try {
        window.localStorage.setItem("fs-read-aloud", value ? "1" : "0");
      } catch {
        /* storage can be blocked */
      }
      preferenceListeners.forEach((listener) => listener());
      if (value) aryaVoice.unlock();
      else cancel();
    },
    [cancel],
  );

  useEffect(() => () => aryaVoice.stop(), []);
  return { supported, speaking, enabled, setEnabled, speak, cancel };
}
