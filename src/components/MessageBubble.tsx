interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-2 max-w-[75%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold ${
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-surface-2 text-secondary'
        }`}>
          {isUser ? 'U' : 'A'}
        </div>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-600 text-white rounded-tr-md'
              : 'bg-surface-2 text-primary rounded-tl-md'
          }`}
        >
          <span className="whitespace-pre-wrap break-words">{content.trim()}</span>
        </div>
      </div>
    </div>
  );
}
