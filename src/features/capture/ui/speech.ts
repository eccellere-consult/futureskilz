"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
const synthesisAvailable = () => typeof window !== "undefined" && "speechSynthesis" in window;
// Server and first client render both say "not available", so nothing mismatches; the browser's answer follows.
function useRecognitionSupported(): boolean {
  return useSyncExternalStore(never, recognitionAvailable, () => false);
}
function useSynthesisSupported(): boolean {
  return useSyncExternalStore(never, synthesisAvailable, () => false);
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
  speak: (text: string) => void;
  cancel: () => void;
  /** 0..1 right now, read every frame to move Arya's mouth. */
  level: () => number;
};

const FEMALE_INDIAN = /(neerja|heera|veena|kalpana|swara|aditi|raveena|priya|lekha|kajal|sangeeta|tara|isha|female)/i;

/** The most natural Indian-English woman's voice the device offers, else any en-IN voice, else the best English one. */
export function pickAryaVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | null {
  const lang = (LANGUAGES[language] ?? "en-IN").toLowerCase();
  const by = (test: (voice: SpeechSynthesisVoice) => boolean) => voices.filter(test);
  const indian = by((voice) => voice.lang.toLowerCase().replace("_", "-") === lang);
  const natural = (list: SpeechSynthesisVoice[]) => list.find((voice) => /natural|online|neural/i.test(voice.name) && FEMALE_INDIAN.test(voice.name)) ?? list.find((voice) => FEMALE_INDIAN.test(voice.name)) ?? list.find((voice) => /natural|online|neural/i.test(voice.name)) ?? list[0];
  if (indian.length) return natural(indian) ?? null;
  const english = by((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  return english.length ? (natural(english) ?? null) : null;
}

let serverVoice: Promise<boolean> | null = null;
const studioVoiceOn = (): Promise<boolean> => (serverVoice ??= fetch("/api/arya/speech", { cache: "no-store" }).then((r) => r.json()).then((j: { server?: boolean }) => !!j.server).catch(() => false));

export function useSpeechOutput(language: string): SpeechOutput {
  const supported = useSynthesisSupported();
  const [speaking, setSpeaking] = useState(false);
  const enabled = useSyncExternalStore(subscribePreference, readPreference, () => false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<{ node: AnalyserNode; data: Uint8Array<ArrayBuffer> } | null>(null);
  const pulse = useRef(0);
  const talking = useRef(false);
  const started = useRef(0);
  const token = useRef(0);

  const cancel = useCallback(() => {
    token.current += 1;
    talking.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  const deviceVoice = useCallback(
    (text: string, mine: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANGUAGES[language] ?? "en-IN";
      const voice = pickAryaVoice(window.speechSynthesis.getVoices(), language);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.93;
      utterance.pitch = 1.06;
      utterance.onstart = () => {
        if (token.current !== mine) return;
        talking.current = true;
        started.current = performance.now();
        setSpeaking(true);
      };
      utterance.onboundary = () => {
        pulse.current = 1;
      };
      const done = () => {
        if (token.current !== mine) return;
        talking.current = false;
        setSpeaking(false);
      };
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    },
    [language],
  );

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !text) return;
      cancel();
      const mine = token.current;
      void studioVoiceOn().then(async (studio) => {
        if (token.current !== mine) return;
        if (!studio) return deviceVoice(text, mine);
        try {
          const response = await fetch("/api/arya/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
          if (!response.ok) throw new Error("studio voice unavailable");
          const blob = await response.blob();
          if (token.current !== mine) return;
          const audio = new Audio(URL.createObjectURL(blob));
          audioRef.current = audio;
          try {
            const context = new AudioContext();
            const node = context.createAnalyser();
            node.fftSize = 512;
            context.createMediaElementSource(audio).connect(node);
            node.connect(context.destination);
            analyser.current = { node, data: new Uint8Array(new ArrayBuffer(node.fftSize)) };
          } catch {
            analyser.current = null;
          }
          audio.onplay = () => {
            talking.current = true;
            started.current = performance.now();
            setSpeaking(true);
          };
          const finish = () => {
            if (token.current !== mine) return;
            talking.current = false;
            analyser.current = null;
            setSpeaking(false);
          };
          audio.onended = finish;
          audio.onerror = finish;
          await audio.play();
        } catch {
          if (token.current === mine) {
            analyser.current = null;
            deviceVoice(text, mine);
          }
        }
      });
    },
    [cancel, deviceVoice],
  );

  /** The mouth follows the real audio when we have it; with a device voice it follows word boundaries and a natural rhythm. */
  const level = useCallback((): number => {
    if (!talking.current) return 0;
    const meter = analyser.current;
    if (meter) {
      meter.node.getByteTimeDomainData(meter.data);
      let sum = 0;
      for (const value of meter.data) sum += ((value - 128) / 128) ** 2;
      return Math.min(1, Math.sqrt(sum / meter.data.length) * 5.5);
    }
    const t = (performance.now() - started.current) / 1000;
    pulse.current *= 0.9;
    const rhythm = 0.5 + 0.28 * Math.sin(t * 2 * Math.PI * 4.1) + 0.14 * Math.sin(t * 2 * Math.PI * 7.3 + 1);
    return Math.min(1, Math.max(0.08, rhythm * 0.7 + pulse.current * 0.3));
  }, []);

  const setEnabled = useCallback(
    (value: boolean) => {
      try {
        window.localStorage.setItem("fs-read-aloud", value ? "1" : "0");
      } catch {
        /* storage can be blocked */
      }
      preferenceListeners.forEach((listener) => listener());
      if (!value) cancel();
    },
    [cancel],
  );

  useEffect(() => () => cancel(), [cancel]);
  // Some browsers load their voice list late; ask once so the first greeting already uses the right voice.
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
  }, []);
  return { supported, speaking, enabled, setEnabled, speak, cancel, level };
}
