import { useState, useRef, useEffect } from 'react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      setInterim('');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      let final = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (final) onTranscript(final);
      setInterim(interimText);
    };

    recognition.onerror = () => { setRecording(false); setInterim(''); };
    recognition.onend = () => { setRecording(false); setInterim(''); };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleRecording}
        disabled={disabled}
        title={recording ? 'Parar gravação' : 'Falar'}
        className={`p-2 rounded-xl transition-all ${
          recording
            ? 'bg-red-500/10 text-red-500 animate-pulse'
            : 'text-muted hover:text-secondary hover:bg-surface-2'
        } disabled:opacity-30`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {recording ? (
            <><rect x="6" y="6" width="12" height="12" rx="2"/></>
          ) : (
            <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
          )}
        </svg>
      </button>
      {interim && (
        <span className="text-[10px] text-muted italic max-w-[120px] truncate">{interim}</span>
      )}
    </div>
  );
}
