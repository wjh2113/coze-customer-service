'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { PendingResume } from './types';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  pendingResume: PendingResume | null;
}

export function ChatInput({ onSend, onStop, isStreaming, pendingResume }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm px-4 py-4">
      <div className="mx-auto max-w-3xl">
        {pendingResume && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-1.5 text-xs text-primary">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>工作流等待补充信息，请直接回复</span>
          </div>
        )}
        <div className="flex items-end gap-3 rounded-2xl border border-border bg-card p-2 bento-shadow transition-colors focus-within:border-primary/40">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingResume ? '请输入补充信息...' : '输入消息，Enter 发送...'}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
              title="停止生成"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              title="发送"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22 11 13 2 9z" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          智能客服由工作流驱动 · 支持订单查询、物流跟踪、售后处理
        </p>
      </div>
    </div>
  );
}
