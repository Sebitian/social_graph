import type { ChatDisplayPart } from "./display";

export const CHAT_VOICE_STORAGE_KEY = "netgraph-chat-voice";

export interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

export interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function markdownToSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[|]+/g, ", ")
    .replace(/[#>~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function spokenTextFromDisplay(parts: ChatDisplayPart[]): string {
  return parts
    .filter((part): part is Extract<ChatDisplayPart, { type: "text" }> => part.type === "text")
    .map((part) => markdownToSpeech(part.text))
    .filter(Boolean)
    .join(" ");
}

function voiceLangScore(voice: SpeechSynthesisVoice, lang: string): number {
  const want = lang.toLowerCase();
  const have = voice.lang.toLowerCase();
  if (have === want) return 8;
  if (have.startsWith(want.slice(0, 2))) return 5;
  if (have.startsWith("en")) return 2;
  return -20;
}

function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (/premium|enhanced|neural|natural|wavenet|studio/.test(name)) score += 12;
  if (/samantha|karen|moira|fiona|tessa|veena|rishi|siri/.test(name)) score += 9;
  if (/aria|jenny|guy|davis|sara|sonia|andrew|emma|brian|ava/.test(name)) score += 8;
  if (/google/.test(name)) score += 6;
  if (/samantha|karen|daniel/.test(name) && voice.localService) score += 3;
  if (/compact|eloquence|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|pipe organ|trinoids|whisper|zarvox/.test(name)) {
    score -= 30;
  }
  return score;
}

export function pickDefaultVoice(
  voices: SpeechSynthesisVoice[],
  lang = typeof navigator === "undefined" ? "en-US" : navigator.language,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  return [...voices].sort((a, b) => {
    const delta =
      voiceLangScore(b, lang) +
      voiceQualityScore(b) -
      (voiceLangScore(a, lang) + voiceQualityScore(a));
    return delta !== 0 ? delta : a.name.localeCompare(b.name);
  })[0] ?? null;
}

export function listReadableVoices(
  voices: SpeechSynthesisVoice[],
  lang = typeof navigator === "undefined" ? "en-US" : navigator.language,
): SpeechSynthesisVoice[] {
  const prefix = lang.slice(0, 2).toLowerCase();
  const matched = voices.filter((voice) => {
    const have = voice.lang.toLowerCase();
    return have.startsWith(prefix) || have.startsWith("en");
  });
  const pool = matched.length > 0 ? matched : voices;
  return [...pool].sort((a, b) => {
    const delta =
      voiceLangScore(b, lang) +
      voiceQualityScore(b) -
      (voiceLangScore(a, lang) + voiceQualityScore(a));
    return delta !== 0 ? delta : a.name.localeCompare(b.name);
  });
}
