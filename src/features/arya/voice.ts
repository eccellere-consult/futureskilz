// Arya's voice engine (browser side). One singleton, because there is exactly one
// Arya on screen and one audio output to share.
//
//  - Speaks via POST /api/v1/voice/speak (an authentic Indian-English neural voice).
//    If the server has no TTS configured or the call fails, it falls back to the best
//    en-IN voice the browser offers, so Arya never goes silent.
//  - Exposes mouth(): the current lip-sync shape, sampled every frame by the 3D
//    avatar. For server audio it is measured from the real waveform (volume → how
//    open the mouth is, spectrum → wide "ee" vs rounded "oo"); the browser fallback
//    has no audio to measure, so it is synthesised from word-boundary events.
//
// iOS/Safari only allow audio that starts inside a tap. unlock() must therefore be
// called synchronously from the tap handler that opens Arya; the same <audio>
// element is then reused for every later utterance so it stays unlocked.

export interface MouthShape {
  /** 0 closed → 1 fully open (jaw). */
  open: number;
  /** 0 → 1 lips drawn wide, as in "ee" and "s". */
  wide: number;
  /** 0 → 1 lips rounded and pushed forward, as in "oo" and "oh". */
  round: number;
}

/** Where Arya's speech audio is fetched from. Change it if your project mounts the route elsewhere. */
export const ARYA_SPEAK_ENDPOINT = '/api/arya/speech';

const CLOSED: MouthShape = { open: 0, wide: 0, round: 0 };
const MUTE_KEY = 'arya_muted';
const SOURCE_KEY = 'arya_voice_source';
const VOICE_KEY = 'arya_voice_uri';
const RATE_KEY = 'arya_voice_rate';
/** Speeds a listener may choose. 1 is Arya's normal, unhurried pace. */
export const VOICE_RATES = [0.75, 1, 1.25, 1.5] as const;

/** Where Arya's voice comes from. "auto" is the site's default studio voice, falling back to the device; "device" never calls an AI service. */
export type VoiceSource = 'auto' | 'device' | 'openai' | 'xai';
const SOURCES: VoiceSource[] = ['auto', 'device', 'openai', 'xai'];
const MAX_CACHED_CLIPS = 24;

// A valid, empty WAV — played inside the tap gesture purely to unlock audio.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const PREFERRED_FEMALE = /neerja|heera|veena|priya|kalpana|aditi|raveena|swara|lekha|female|woman/i;
const MALE = /\b(rishi|ravi|prabhat|hemant|madhur|male|man)\b/i;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

class AryaVoice {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  private clips = new Map<string, string>(); // text → blob: URL
  private runId = 0; // bumps on every speak()/stop() so a superseded utterance can tell it was cancelled
  private finish: (() => void) | null = null; // resolves the in-flight speak() promise

  private serverPlaying = false;
  private synthPlaying = false;
  private synthStartedAt = 0;
  private synthPulse = 0; // decays from 1 after each spoken word

  private level = 0; // smoothed mouth values, kept between frames
  private wide = 0;
  private round = 0;
  private muted = false;

  constructor() {
    try {
      this.muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // storage can be blocked — default to audible
    }
  }

  /** The listener's chosen voice source. A device voice costs nothing and uses no AI service. */
  getSource(): VoiceSource {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SOURCE_KEY) : null;
      return SOURCES.includes(stored as VoiceSource) ? (stored as VoiceSource) : 'auto';
    } catch {
      return 'auto';
    }
  }

  setSource(source: VoiceSource): void {
    try {
      localStorage.setItem(SOURCE_KEY, source);
    } catch {
      // not worth surfacing
    }
    this.stop();
  }

  /** A device voice the listener picked by name (their phone or computer's own voices), or '' for Arya's usual voice. */
  getVoiceURI(): string {
    try {
      return (typeof localStorage !== 'undefined' && localStorage.getItem(VOICE_KEY)) || '';
    } catch {
      return '';
    }
  }

  /** Picking a device voice also switches the source to the device; clearing it goes back to Arya's usual voice. */
  setVoiceURI(uri: string): void {
    try {
      if (uri) localStorage.setItem(VOICE_KEY, uri);
      else localStorage.removeItem(VOICE_KEY);
    } catch {
      // not worth surfacing
    }
    this.setSource(uri ? 'device' : 'auto');
  }

  getRate(): number {
    try {
      const stored = Number(typeof localStorage !== 'undefined' ? localStorage.getItem(RATE_KEY) : '');
      return (VOICE_RATES as readonly number[]).includes(stored) ? stored : 1;
    } catch {
      return 1;
    }
  }

  /** Takes effect from the next sentence; what is being said now also changes pace when it is a studio voice. */
  setRate(rate: number): void {
    try {
      localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      // not worth surfacing
    }
    if (this.audio) this.audio.playbackRate = rate;
  }

  get speaking(): boolean {
    return this.serverPlaying || this.synthPlaying;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // not worth surfacing
    }
    if (muted) this.stop();
  }

  /** Call synchronously from a tap/click handler. Safe to call repeatedly. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.audio.setAttribute('playsinline', '');
      }
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) {
          this.ctx = new Ctor();
          this.analyser = this.ctx.createAnalyser();
          this.analyser.fftSize = 1024;
          this.analyser.smoothingTimeConstant = 0.4;
          this.ctx.createMediaElementSource(this.audio).connect(this.analyser);
          this.analyser.connect(this.ctx.destination);
          this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
          this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
        }
      }
      void this.ctx?.resume();
      if (!this.audio.src) {
        this.audio.src = SILENT_WAV;
        void this.audio.play().catch(() => {});
      }
      // Touch speechSynthesis inside the gesture too, so the fallback voice is allowed later.
      window.speechSynthesis?.getVoices();
    } catch {
      // Audio is a nicety — captions still carry the conversation.
    }
  }

  /** Speaks `text`, resolving when finished (or cut off by stop()/a newer speak()). Never rejects. */
  async speak(text: string, lang = 'en'): Promise<void> {
    
    const clean = text.trim();
    this.stop();
    if (!clean || this.muted || typeof window === 'undefined') return;

    const run = ++this.runId;
    return new Promise<void>((resolve) => {
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        if (this.finish === end) this.finish = null;
        clear();
        resolve();
      };
      this.finish = end;

      // Watchdog: browsers sometimes never report that speech has ended (Chrome's speech
      // engine is known to drop the event, and headless/no-voice devices never fire it).
      // Without this, Arya would sit on "Speaking…" and never listen again.
      const words = clean.split(/\s+/).length;
      const watchdog = setTimeout(() => {
        if (run !== this.runId) return;
        this.stop();
      }, words * 520 + 3500);
      const clear = () => clearTimeout(watchdog);

      void (async () => {
        const url = await this.fetchClip(clean);
        if (run !== this.runId) return end();
        if (url && (await this.playClip(url, run))) return end();
        if (run !== this.runId) return end();
        await this.speakWithBrowserVoice(clean, run, lang);
        end();
      })();
    });
  }

  stop(): void {
    this.runId++;
    if (this.audio && this.serverPlaying) {
      this.audio.pause();
      this.audio.onended = null;
      this.audio.onerror = null;
    }
    this.serverPlaying = false;
    if (this.synthPlaying) window.speechSynthesis?.cancel();
    this.synthPlaying = false;
    const finish = this.finish;
    this.finish = null;
    finish?.();
  }

  /** Current lip-sync shape. Cheap; called once per rendered frame. */
  mouth(): MouthShape {
    let open = 0;
    let wide = 0;
    let round = 0;

    if (this.serverPlaying && this.analyser && this.timeData && this.freqData) {
      this.analyser.getByteTimeDomainData(this.timeData);
      this.analyser.getByteFrequencyData(this.freqData);

      let sum = 0;
      for (let i = 0; i < this.timeData.length; i++) {
        const v = (this.timeData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.timeData.length);
      open = clamp01((rms - 0.015) * 5.5);

      // Spectral balance: vowels like "oo/oh" carry their energy low, "ee" and sibilants high.
      const binHz = (this.ctx?.sampleRate ?? 48000) / this.analyser.fftSize;
      const energy = (fromHz: number, toHz: number) => {
        let e = 0;
        const from = Math.floor(fromHz / binHz);
        const to = Math.min(this.freqData!.length, Math.ceil(toHz / binHz));
        for (let i = from; i < to; i++) e += this.freqData![i];
        return e / Math.max(1, to - from);
      };
      const low = energy(120, 700);
      const high = energy(2200, 6500);
      const total = low + high + 1;
      wide = clamp01((high / total - 0.12) * 3) * open;
      round = clamp01((low / total - 0.7) * 3.5) * open;
    } else if (this.serverPlaying || this.synthPlaying) {
      // No waveform to read — a natural-looking syllable rhythm, kicked by word boundaries.
      const t = (performance.now() - this.synthStartedAt) / 1000;
      const syllables = Math.abs(Math.sin(t * 8.5)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 2.6 + 1.1)));
      this.synthPulse = Math.max(0, this.synthPulse - 0.07);
      open = clamp01(0.12 + syllables * 0.55 + this.synthPulse * 0.3);
      wide = clamp01(Math.sin(t * 3.1) * 0.5) * open;
      round = clamp01(Math.sin(t * 2.3 + 2) * 0.5) * open;
    }

    // Attack fast, release slower — mouths snap open and relax closed.
    const rate = open > this.level ? 0.55 : 0.28;
    this.level += (open - this.level) * rate;
    this.wide += (wide - this.wide) * 0.3;
    this.round += (round - this.round) * 0.3;

    if (this.level < 0.01 && !this.speaking) return CLOSED;
    return { open: this.level, wide: this.wide, round: this.round };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Blob URL of the server-synthesised clip, or null if the server voice is unavailable. */
  private async fetchClip(text: string): Promise<string | null> {
    const source = this.getSource();
    if (source === 'device') return null; // the listener chose their own device voice: no AI service is called
    const cacheKey = `${source}:${text}`;
    const cached = this.clips.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await fetch(ARYA_SPEAK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(source === 'auto' ? { text } : { text, provider: source }),
      });
      if (!res.ok) return null;
      const url = URL.createObjectURL(await res.blob());
      this.clips.set(cacheKey, url);
      if (this.clips.size > MAX_CACHED_CLIPS) {
        const oldest = this.clips.keys().next().value as string;
        URL.revokeObjectURL(this.clips.get(oldest)!);
        this.clips.delete(oldest);
      }
      return url;
    } catch {
      return null;
    }
  }

  /** Plays a clip; resolves true if it played to the end, false if playback was refused or failed. */
  private playClip(url: string, run: number): Promise<boolean> {
    const audio = this.audio;
    if (!audio) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      audio.onended = () => {
        this.serverPlaying = false;
        resolve(true);
      };
      audio.onerror = () => {
        this.serverPlaying = false;
        resolve(false);
      };
      audio.src = url;
      audio.playbackRate = this.getRate();
      this.synthStartedAt = performance.now();
      void this.ctx?.resume();
      audio.play().then(
        () => {
          if (run !== this.runId) return audio.pause();
          this.serverPlaying = true;
        },
        () => {
          this.serverPlaying = false;
          resolve(false); // autoplay refused — try the browser voice, then captions only
        },
      );
    });
  }

  private async pickBrowserVoice(lang: string): Promise<SpeechSynthesisVoice | null> {
    const synth = window.speechSynthesis;
    let voices = synth.getVoices();
    if (!voices.length) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 600);
        synth.addEventListener('voiceschanged', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      voices = synth.getVoices();
    }
    // The listener's own pick comes first, when this device still has it.
    const chosen = this.getVoiceURI();
    const picked = chosen ? voices.find((v) => v.voiceURI === chosen) : undefined;
    if (picked) return picked;
    // Another Indian language: the best woman's voice for it, else any voice for it.
    if (lang !== 'en') {
      const own = voices.filter((v) => new RegExp(`^${lang}[-_]IN$`, 'i').test(v.lang));
      if (own.length) return own.find((v) => PREFERRED_FEMALE.test(v.name)) ?? own.find((v) => !MALE.test(v.name)) ?? own[0];
    }
    const indian = voices.filter((v) => /^en[-_]IN$/i.test(v.lang));
    const hindi = voices.filter((v) => /^hi[-_]IN$/i.test(v.lang));
    const notMale = (v: SpeechSynthesisVoice) => !MALE.test(v.name);
    return (
      indian.find((v) => PREFERRED_FEMALE.test(v.name)) ??
      indian.find(notMale) ??
      hindi.find((v) => PREFERRED_FEMALE.test(v.name)) ??
      indian[0] ??
      null
    );
  }

  private async speakWithBrowserVoice(text: string, run: number, lang = 'en'): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voice = await this.pickBrowserVoice(lang);
    if (run !== this.runId) return;

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang ?? (lang === 'en' ? 'en-IN' : `${lang}-IN`);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.93 * this.getRate(); // unhurried and clear at 1; the listener may choose faster or slower
      utterance.pitch = this.getVoiceURI() ? 1 : 1.05;
      utterance.onstart = () => {
        this.synthPlaying = true;
        this.synthStartedAt = performance.now();
      };
      utterance.onboundary = () => {
        this.synthPulse = 1;
      };
      const over = () => {
        this.synthPlaying = false;
        resolve();
      };
      utterance.onend = over;
      utterance.onerror = over;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }
}

export const aryaVoice = new AryaVoice();

export type VoiceChoice = { uri: string; label: string; accent: string; gender: 'Female' | 'Male' | '' };

const ACCENTS: Record<string, string> = { 'en-in': 'Indian English', 'en-us': 'US English', 'en-gb': 'UK English', 'en-au': 'Australian English', 'en-ca': 'Canadian English', 'en-ie': 'Irish English', 'en-za': 'South African English', 'en-nz': 'New Zealand English', 'en-sg': 'Singapore English', 'hi-in': 'Hindi' };
const ACCENT_ORDER = ['Indian English', 'US English', 'UK English'];
const FEMALE_NAMES = /female|woman|neerja|heera|veena|priya|kalpana|aditi|raveena|swara|lekha|zira|aria|jenny|michelle|ana\b|sonia|libby|hazel|susan|samantha|karen|moira|tessa|fiona|victoria|allison|ava\b|emma|olivia|natasha|catherine|kate|serena|google us english|google uk english female/i;
const MALE_NAMES = /\bmale\b|\bman\b|ravi|hemant|prabhat|rishi|david|mark\b|guy\b|george|ryan|thomas|daniel|alex\b|fred|oliver|james|christopher|eric\b|brian|william|andrew|liam|google uk english male/i;

/**
 * The English (and Hindi) voices this device offers, named in plain words: the accent, whether it sounds like a woman or a man
 * where the name says so, and the maker (Google, Microsoft, Apple) so two voices of the same accent can be told apart.
 * Which voices exist depends on the listener's own phone, computer and browser: Chrome brings the Google US and UK voices.
 */
export function describeVoices(voices: Array<Pick<SpeechSynthesisVoice, 'voiceURI' | 'name' | 'lang'>>): VoiceChoice[] {
  const seen = new Set<string>();
  const out: VoiceChoice[] = [];
  for (const voice of voices) {
    const lang = voice.lang.toLowerCase().replace('_', '-');
    if (!lang.startsWith('en') && lang !== 'hi-in') continue;
    if (seen.has(voice.voiceURI)) continue;
    seen.add(voice.voiceURI);
    const accent = ACCENTS[lang] ?? 'English';
    const gender = MALE_NAMES.test(voice.name) ? 'Male' : FEMALE_NAMES.test(voice.name) ? 'Female' : '';
    const maker = /google/i.test(voice.name) ? 'Google' : /microsoft/i.test(voice.name) ? 'Microsoft' : /apple|siri/i.test(voice.name) ? 'Apple' : '';
    const person = voice.name.replace(/microsoft|google|apple|online|\(natural\)|natural|desktop|english|united states|united kingdom|india|\(.*?\)|- .*$/gi, ' ').replace(/\b(us|uk|female|male)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    out.push({ uri: voice.voiceURI, accent, gender, label: [accent, gender, [maker, person].filter(Boolean).join(' ')].filter(Boolean).join(' · ') });
  }
  const rank = (choice: VoiceChoice) => { const at = ACCENT_ORDER.indexOf(choice.accent); return at < 0 ? ACCENT_ORDER.length : at; };
  return out.sort((a, b) => rank(a) - rank(b) || a.accent.localeCompare(b.accent) || a.label.localeCompare(b.label));
}
