import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, Paperclip, Square, X } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/common/ui";

export interface PendingAttachment {
  id: string;
  filename: string;
}

const SPEECH_LOCALES: Record<string, string> = {
  en: "en-US",
  ta: "ta-IN",
  hi: "hi-IN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ar: "ar-SA",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  pt: "pt-BR",
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  attachments,
  onFiles,
  onRemoveAttachment,
  uploading,
  language,
  onLanguageChange,
  languages,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  attachments: PendingAttachment[];
  onFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  uploading?: boolean;
  language: string;
  onLanguageChange: (value: string) => void;
  languages: Array<{ code: string; name: string }>;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const speech = useSpeech();
  const baseValue = useRef(value);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => {
    baseValue.current = value;
  }, [value]);

  useEffect(() => () => speech.stopListening(), [speech.stopListening]);

  function toggleMic() {
    if (speech.listening) {
      speech.stopListening();
      return;
    }
    speech.listen({
      language: SPEECH_LOCALES[language] ?? "en-US",
      onResult: (transcript, final) => {
        const prefix = baseValue.current.trim();
        onChange(prefix ? `${prefix} ${transcript}` : transcript);
        if (final) {
          onChange(`${prefix ? `${prefix} ` : ""}${transcript} `);
        }
      },
    });
  }

  return (
    <div
      className={cn(
        "panel relative overflow-hidden transition-colors",
        dragging ? "border-gold/50" : "focus-within:border-gold/30",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files);
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Message ASTA
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!streaming && !disabled) onSend();
          }
        }}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        className="max-h-[220px] min-h-[58px] w-full resize-none bg-transparent px-4 pt-4 text-[0.95rem] leading-relaxed text-parchment placeholder:text-ash/55 focus:outline-none disabled:opacity-60"
      />

      {(attachments.length > 0 || uploading || speech.listening) && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1" aria-live="polite">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-line bg-elevated/70 px-2.5 py-1 text-[0.68rem] text-ash"
            >
              <Paperclip size={11} />
              <span className="truncate">{attachment.filename}</span>
              <button
                onClick={() => onRemoveAttachment(attachment.id)}
                className="text-ash hover:text-danger"
                aria-label={`Remove ${attachment.filename}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {uploading && (
            <span className="inline-flex items-center gap-1.5 text-[0.68rem] text-ash">
              <Spinner size={11} /> Parsing document…
            </span>
          )}
          {speech.listening && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[0.68rem] text-danger">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> Listening · speak now
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.pptx"
            onChange={(event) => {
              if (event.target.files) onFiles(event.target.files);
              event.target.value = "";
            }}
            aria-label="Choose a document to attach"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-quiet p-2"
            aria-label="Attach a document (PDF, DOCX, XLSX, CSV, TXT, MD, PPTX)"
            title="Attach a document"
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            onClick={toggleMic}
            className={cn("btn-quiet p-2", speech.listening && "text-danger")}
            aria-label={speech.listening ? "Stop listening" : "Speak your message"}
            aria-pressed={speech.listening}
            disabled={!speech.recognitionSupported}
            title={
              speech.recognitionSupported
                ? "Speech recognition runs in your browser. Microphone activates only on click."
                : "Speech recognition is not available in this browser."
            }
          >
            {speech.listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <div className="ms-1 hidden items-center gap-1.5 sm:flex">
            <label htmlFor="response-language" className="sr-only">
              Response language
            </label>
            <select
              id="response-language"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="rounded-md border border-line bg-coal px-1.5 py-1 text-[0.68rem] text-ash focus-ring"
              title="Response language"
            >
              <option value="auto">Auto language</option>
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[0.62rem] text-ash/45 sm:inline">
            Enter to send · Shift+Enter for a new line
          </span>
          {streaming ? (
            <button onClick={onStop} className="btn-ghost !rounded-full !p-2.5" aria-label="Stop generating">
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              className="btn-primary !rounded-full !p-2.5"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-abyss/70 text-xs uppercase tracking-[0.2em] text-gold">
          Drop document to attach
        </div>
      )}
    </div>
  );
}
