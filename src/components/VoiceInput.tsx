import { useState, useRef } from 'react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const ados = (window as any).ados;

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setDuration(0);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 500) return;

        setTranscribing(true);
        try {
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
          }
          const base64 = btoa(binary);
          const result = await ados.llm.transcribe(base64, mimeType);
          console.log('[VoiceInput] transcribe result:', result);
          if (result?.text) {
            onTranscript(result.text);
          }
        } catch (e) { console.error('[VoiceInput] transcribe error:', e); }
        setTranscribing(false);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {}
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={toggleRecording}
        disabled={disabled || transcribing}
        title={recording ? 'Parar gravação' : transcribing ? 'Transcrevendo...' : 'Gravar áudio'}
        className={`p-2 rounded-xl transition-all ${
          recording
            ? 'bg-red-500/20 text-red-500 animate-pulse ring-2 ring-red-500/30'
            : transcribing
              ? 'text-brand-500 animate-pulse'
              : 'text-muted hover:text-secondary hover:bg-surface-2'
        } disabled:opacity-30`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {recording ? (
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          ) : (
            <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
          )}
        </svg>
      </button>
      {recording && (
        <span className="text-[10px] text-red-400 font-mono tabular-nums">
          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
        </span>
      )}
      {transcribing && (
        <span className="text-[10px] text-brand-500 italic">Transcrevendo...</span>
      )}
    </div>
  );
}
