import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const language = className?.replace('language-', '') || '';

  useEffect(() => {
    if (codeRef.current && language && hljs.getLanguage(language)) {
      codeRef.current.innerHTML = hljs.highlight(children, { language }).value;
    }
  }, [children, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-3">
      <div className="flex items-center justify-between bg-surface-3 rounded-t-xl px-4 py-1.5 border border-b-0 border-default">
        <span className="text-[10px] font-mono text-muted uppercase">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-[10px] text-muted hover:text-primary transition-colors px-2 py-0.5 rounded hover:bg-surface-2"
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="bg-surface-0 rounded-b-xl p-4 overflow-x-auto border border-t-0 border-default m-0">
        <code ref={codeRef} className={`text-xs font-mono leading-relaxed text-primary ${className || ''}`}>
          {children}
        </code>
      </pre>
    </div>
  );
}

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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5 group`}>
      <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse max-w-[75%]' : 'max-w-[85%]'}`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
          isUser ? 'bg-brand-600 text-white' : 'bg-surface-2 text-secondary'
        }`}>
          {isUser ? 'U' : 'A'}
        </div>
        <div className="relative min-w-0 flex-1">
          {isUser ? (
            <div className="px-4 py-2.5 bg-brand-600 text-white rounded-2xl rounded-tr-md text-sm leading-relaxed whitespace-pre-wrap break-words">
              {content.trim()}
            </div>
          ) : (
            <div className="px-4 py-3 bg-surface-2 rounded-2xl rounded-tl-md text-sm leading-relaxed">
              <div className="max-w-none
                [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-primary [&_h1]:mt-4 [&_h1]:mb-2
                [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary [&_h2]:mt-3 [&_h2]:mb-2
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-primary [&_h3]:mt-3 [&_h3]:mb-1.5
                [&_p]:text-secondary [&_p]:my-2 [&_p]:leading-relaxed
                [&_strong]:text-primary [&_strong]:font-semibold
                [&_ul]:my-2 [&_ul]:pl-4 [&_ul]:space-y-1
                [&_ol]:my-2 [&_ol]:pl-4 [&_ol]:space-y-1
                [&_li]:text-secondary [&_li]:leading-relaxed
                [&_li_p]:my-0
                [&_code]:text-xs [&_code]:bg-surface-0 [&_code]:text-brand-400 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:font-mono
                [&_blockquote]:border-l-2 [&_blockquote]:border-brand-500 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:text-muted [&_blockquote]:italic
                [&_table]:w-full [&_table]:my-3 [&_table]:text-xs [&_table]:border-collapse
                [&_th]:px-3 [&_th]:py-2 [&_th]:bg-surface-0 [&_th]:text-left [&_th]:font-semibold [&_th]:text-primary [&_th]:border-b [&_th]:border-default
                [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-default [&_td]:text-secondary
                [&_a]:text-brand-400 [&_a]:underline [&_a]:underline-offset-2
                [&_hr]:border-default [&_hr]:my-4
              ">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const isBlock = className?.startsWith('language-') || String(children).includes('\n');
                      if (isBlock) {
                        return <CodeBlock className={className}>{String(children).replace(/\n$/, '')}</CodeBlock>;
                      }
                      return <code className={className} {...props}>{children}</code>;
                    },
                    pre({ children }) {
                      return <>{children}</>;
                    },
                  }}
                >
                  {content.trim()}
                </ReactMarkdown>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="text-[10px] text-muted hover:text-secondary px-1.5 py-0.5 rounded hover:bg-surface-2 transition-colors"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
