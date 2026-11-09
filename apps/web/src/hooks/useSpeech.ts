import { useCallback, useEffect, useRef, useState } from "react";

interface SpeakOptions {
  language?: string;
  voiceName?: string;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

interface ListenOptions {
  language?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
}

function pickMaleVoice(voices: SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | null {
  const prefix = language.split("-")[0];
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(prefix));
  const pool = matching.length ? matching : voices;
  const maleHints = /(male|david|guy|james|daniel|george|thomas|alex|ravi|mark|fred|diego|paul)/i;
  return pool.find((voice) => maleHints.test(voice.name)) ?? pool[0] ?? null;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " Code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#>*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function useSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<any>(null);
  const synthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const recognitionSupported =
    typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    if (!synthesisSupported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [synthesisSupported]);

  const stopSpeaking = useCallback(() => {
    if (!synthesisSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [synthesisSupported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!synthesisSupported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(stripMarkdown(text).slice(0, 6000));
      const language = options.language || "en";
      utterance.lang = language;
      const voice = options.voiceName
        ? voices.find((candidate) => candidate.name === options.voiceName) ?? pickMaleVoice(voices, language)
        : pickMaleVoice(voices, language);
      if (voice) utterance.voice = voice;
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 0.95;
      utterance.onend = () => {
        setSpeaking(false);
        options.onEnd?.();
      };
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [synthesisSupported, voices],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const listen = useCallback(
    (options: ListenOptions) => {
      if (!recognitionSupported) return;
      stopListening();
      const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new Recognition();
      recognition.lang = options.language || "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        setInterim(interimText);
        if (finalText) options.onResult(finalText, true);
        else if (interimText) options.onResult(interimText, false);
      };
      recognition.onerror = () => {
        setListening(false);
        setInterim("");
      };
      recognition.onend = () => {
        setListening(false);
        setInterim("");
      };
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [recognitionSupported, stopListening],
  );

  return {
    voices,
    speaking,
    listening,
    interim,
    synthesisSupported,
    recognitionSupported,
    speak,
    stopSpeaking,
    listen,
    stopListening,
  };
}
