import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      <div className={`flex items-start gap-2 max-w-[75%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold ${
          isUser ? 'bg-brand-600 text-white' : 'bg-surface-2 text-secondary'
        }`}>
          {isUser ? 'U' : 'A'}
        </div>
        <div className="relative">
          <div
            className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? 'bg-brand-600 text-white rounded-tr-md'
                : 'bg-surface-2 text-primary rounded-tl-md'
            }`}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap break-words">{content.trim()}</span>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none break-words [&_pre]:bg-surface-0 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-xs [&_code]:bg-surface-0 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_a]:text-brand-400 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.trim()}</ReactMarkdown>
              </div>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 text-[10px] text-muted hover:text-secondary transition-opacity"
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  );
}
