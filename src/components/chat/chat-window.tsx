'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage, SSEEvent, PendingResume } from './types';
import { MessageBubble } from './message-bubble';
import { ChatInput } from './chat-input';
import { ChatHeader } from './chat-header';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Welcome message on mount
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '您好！我是智能客服助手，可以帮您查询订单、跟踪物流、处理售后等问题。请问有什么可以帮您的？',
        timestamp: Date.now(),
        isWelcome: true,
      },
    ]);
  }, []);

  const processSSEStream = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessageAdded = false;
      let hasValidResponse = false;
      const messageGroups: Map<string, ChatMessage> = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const payload = JSON.parse(jsonStr) as SSEEvent;

            if (payload.type === 'done') {
              // If no valid response was received, show fallback
              if (!hasValidResponse && !assistantMessageAdded) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    role: 'assistant',
                    content: '抱歉，服务暂时不可用，请稍后再试。',
                    timestamp: Date.now(),
                    isError: true,
                  },
                ]);
              }
              break;
            }

            if (payload.type === 'error') {
              setMessages((prev) => [
                ...prev,
                {
                  id: generateId(),
                  role: 'assistant',
                  content: `抱歉，出现了一些问题：${payload.message || '未知错误'}`,
                  timestamp: Date.now(),
                  isError: true,
                },
              ]);
              hasValidResponse = true;
              break;
            }

            if (payload.type === 'coze_event') {
              const eventData = payload.data as Record<string, unknown>;
              const event = payload.event as string;

              if (event === 'Message') {
                // Check if this is an error message from the workflow
                const errorCode = eventData.error_code as number | undefined;
                const errorMessage = eventData.error_message as string | undefined;

                if (errorCode && errorMessage) {
                  // Workflow returned an error
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: generateId(),
                      role: 'assistant',
                      content: `抱歉，服务出错（${errorCode}）：${errorMessage}`,
                      timestamp: Date.now(),
                      isError: true,
                    },
                  ]);
                  hasValidResponse = true;
                  continue;
                }

                const nodeTitle = (eventData.node_title as string) || '输出';
                const content = (eventData.content as string) || '';
                const loopIndex = eventData.loop_index as number | undefined;
                const groupKey = `${nodeTitle}-${loopIndex ?? 0}`;

                if (content) {
                  hasValidResponse = true;

                  if (messageGroups.has(groupKey)) {
                    // Append to existing group
                    const existing = messageGroups.get(groupKey)!;
                    const updatedContent = existing.content + content;
                    messageGroups.set(groupKey, {
                      ...existing,
                      content: updatedContent,
                    });
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === existing.id
                          ? { ...m, content: updatedContent }
                          : m
                      )
                    );
                  } else {
                    // New message group
                    const newMsg: ChatMessage = {
                      id: generateId(),
                      role: 'assistant',
                      content,
                      timestamp: Date.now(),
                      nodeTitle,
                      loopIndex,
                    };
                    messageGroups.set(groupKey, newMsg);

                    if (!assistantMessageAdded) {
                      assistantMessageAdded = true;
                    }
                    setMessages((prev) => [...prev, newMsg]);
                  }
                }
              } else if (event === 'Interrupt') {
                // Parse interrupt data structure
                const interruptData = eventData.interrupt_data as Record<string, unknown> | undefined;

                if (interruptData) {
                  const eventId = interruptData.event_id as string;
                  const interruptType = interruptData.type as number;

                  setPendingResume({
                    eventId,
                    interruptType,
                  });

                  // Extract content from interrupt data
                  let interruptContent = '请提供更多信息';
                  const rawData = interruptData.data as string | undefined;
                  if (rawData) {
                    try {
                      const parsed = JSON.parse(rawData) as Record<string, unknown>;
                      interruptContent = (parsed.content as string) || interruptContent;
                    } catch {
                      interruptContent = rawData;
                    }
                  }

                  if (!assistantMessageAdded) {
                    assistantMessageAdded = true;
                  }
                  hasValidResponse = true;

                  setMessages((prev) => [
                    ...prev,
                    {
                      id: generateId(),
                      role: 'assistant',
                      content: interruptContent,
                      timestamp: Date.now(),
                      isInterrupt: true,
                    },
                  ]);
                }
              } else if (event === 'Error') {
                const errorMsg =
                  (eventData.error_message as string) || '工作流执行出错';
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    role: 'assistant',
                    content: `抱歉，${errorMsg}`,
                    timestamp: Date.now(),
                    isError: true,
                  },
                ]);
                hasValidResponse = true;
              }
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      // Build request body
      const requestBody: Record<string, unknown> = {
        message: text.trim(),
      };

      if (pendingResume) {
        requestBody.eventId = pendingResume.eventId;
        requestBody.interruptType = pendingResume.interruptType;
        setPendingResume(null);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || `请求失败 (${response.status})`);
        }

        if (!response.body) {
          throw new Error('无响应流');
        }

        const reader = response.body.getReader();
        await processSSEStream(reader);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const errorMsg =
          err instanceof Error ? err.message : '网络请求失败';
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: `抱歉，连接失败：${errorMsg}`,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, pendingResume, processSSEStream]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <ChatHeader />
      <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isStreaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start animate-message-in">
              <div className="rounded-2xl rounded-bl-md bg-card px-4 py-3 bento-shadow">
                <div className="flex items-center gap-1.5">
                  <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        pendingResume={pendingResume}
      />
    </div>
  );
}
