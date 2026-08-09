'use client';

import { ChatMessage } from './types';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex animate-message-in',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] px-4 py-2.5',
          isUser
            ? 'rounded-2xl rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-2xl rounded-bl-md bg-card bento-shadow',
          message.isError && 'border border-destructive/30 bg-destructive/5',
          message.isFallback && 'border border-amber-400/30 bg-amber-50 dark:bg-amber-950/20'
        )}
      >
        {!isUser && message.nodeTitle && (
          <div className="mb-1 flex items-center gap-1.5">
            <span className="inline-flex h-4 items-center rounded-full bg-primary/10 px-2 text-[10px] font-medium text-primary">
              {message.nodeTitle}
              {message.loopIndex !== undefined && ` #${message.loopIndex + 1}`}
            </span>
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">
          {message.content}
        </p>
        <span
          className={cn(
            'mt-1 block text-[10px]',
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
