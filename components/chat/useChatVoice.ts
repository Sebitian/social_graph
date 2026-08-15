"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHAT_VOICE_STORAGE_KEY,
  getSpeechRecognitionCtor,
  listReadableVoices,
  pickDefaultVoice,
  speechSynthesisSupported,
  type BrowserSpeechRecognition,
} from "@/lib/chat/speech";

const CHROME_UTTERANCE_KEEPALIVE_MS = 12_000;

export function useChatVoice() {
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const speakingIdRef = useRef<string | null>(null);
  const askedWithVoiceRef = useRef(false);
  const ignoreEndRef = useRef(false);
  const baseTextRef = useRef("");
  const finalTextRef = useRef("");
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitVoiceRef = useRef<(text: string) => void>(() => {});
  const setInputRef = useRef<(text: string) => void>(() => {});
  const voiceURIRef = useRef("");

  const clearKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  };

  const stopSpeaking = useCallback(() => {
    clearKeepAlive();
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    speakingIdRef.current = null;
    setSpeakingId(null);
  }, []);

  useEffect(() => {
    setSttSupported(Boolean(getSpeechRecognitionCtor()));
    setTtsSupported(speechSynthesisSupported());
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return () => {};
    }

    const loadVoices = () => {
      const readable = listReadableVoices(window.speechSynthesis.getVoices());
      setVoices(readable);
      setVoiceURI((current) => {
        if (current && readable.some((voice) => voice.voiceURI === current)) {
          return current;
        }
        const stored = window.localStorage.getItem(CHAT_VOICE_STORAGE_KEY);
        if (stored && readable.some((voice) => voice.voiceURI === stored)) {
          return stored;
        }
        return pickDefaultVoice(readable)?.voiceURI ?? readable[0]?.voiceURI ?? "";
      });
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      ignoreEndRef.current = true;
      listeningRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      clearKeepAlive();
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    voiceURIRef.current = voiceURI;
  }, [voiceURI]);

  const speak = useCallback(
    (id: string, text: string, options?: { toggle?: boolean }) => {
      const spoken = text.trim();
      if (!spoken || typeof window === "undefined" || !window.speechSynthesis) {
        return;
      }
      const allowToggle = options?.toggle !== false;
      if (speakingIdRef.current === id) {
        if (allowToggle) stopSpeaking();
        return;
      }
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(spoken);
      const selected =
        window.speechSynthesis
          .getVoices()
          .find((voice) => voice.voiceURI === voiceURIRef.current) ?? null;
      if (selected) {
        utterance.voice = selected;
        utterance.lang = selected.lang;
      } else {
        utterance.lang = navigator.language || "en-US";
      }
      utterance.rate = 1;
      utterance.onend = () => {
        clearKeepAlive();
        if (speakingIdRef.current === id) {
          speakingIdRef.current = null;
          setSpeakingId(null);
        }
      };
      utterance.onerror = () => {
        clearKeepAlive();
        if (speakingIdRef.current === id) {
          speakingIdRef.current = null;
          setSpeakingId(null);
        }
      };
      speakingIdRef.current = id;
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
      keepAliveRef.current = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearKeepAlive();
          return;
        }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, CHROME_UTTERANCE_KEEPALIVE_MS);
    },
    [stopSpeaking],
  );

  const stopListening = useCallback((mode: "submit" | "cancel" = "submit") => {
    ignoreEndRef.current = mode === "cancel";
    listeningRef.current = false;
    setListening(false);
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || listeningRef.current) return;

    stopSpeaking();
    setMicError(null);
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognitionRef.current = recognition;
    ignoreEndRef.current = false;
    listeningRef.current = true;
    setListening(true);
    finalTextRef.current = baseTextRef.current;

    recognition.onresult = (event) => {
      let finals = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript ?? "";
        if (result.isFinal) finals += piece;
        else interim += piece;
      }
      if (finals) {
        const prefix = finalTextRef.current;
        const joiner = prefix && !prefix.endsWith(" ") ? " " : "";
        finalTextRef.current = `${prefix}${joiner}${finals}`.replace(/\s+/g, " ").trim();
      }
      const live = [finalTextRef.current, interim].filter(Boolean).join(" ").replace(/\s+/g, " ");
      setInputRef.current(live.trimStart());
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        ignoreEndRef.current = true;
        setMicError("Microphone permission is blocked in this browser.");
      } else if (event.error === "aborted") {
        ignoreEndRef.current = true;
      } else if (event.error !== "no-speech") {
        ignoreEndRef.current = true;
        setMicError("Voice input failed. Try typing instead.");
      }
      listeningRef.current = false;
      setListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
      const text = finalTextRef.current.trim();
      if (!ignoreEndRef.current && text.length >= 2) {
        askedWithVoiceRef.current = true;
        submitVoiceRef.current(text);
      }
      ignoreEndRef.current = false;
    };

    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setMicError("Voice input could not start. Try typing instead.");
    }
  }, [stopSpeaking]);

  const toggleListening = useCallback(
    (input: string) => {
      if (listeningRef.current) {
        stopListening();
        return;
      }
      baseTextRef.current = input.trim();
      startListening();
    },
    [startListening, stopListening],
  );

  const bindVoice = useCallback(
    (handlers: {
      setInput: (text: string) => void;
      submit: (text: string) => void;
    }) => {
      setInputRef.current = handlers.setInput;
      submitVoiceRef.current = handlers.submit;
    },
    [],
  );

  const consumeAskedWithVoice = useCallback(() => {
    const asked = askedWithVoiceRef.current;
    askedWithVoiceRef.current = false;
    return asked;
  }, []);

  const selectVoice = useCallback((nextURI: string) => {
    setVoiceURI(nextURI);
    voiceURIRef.current = nextURI;
    try {
      window.localStorage.setItem(CHAT_VOICE_STORAGE_KEY, nextURI);
    } catch {
      /* storage may be blocked */
    }
  }, []);

  return {
    listening,
    speakingId,
    sttSupported,
    ttsSupported,
    micError,
    voices,
    voiceURI,
    selectVoice,
    speak,
    stopSpeaking,
    stopListening,
    toggleListening,
    bindVoice,
    consumeAskedWithVoice,
  };
}
