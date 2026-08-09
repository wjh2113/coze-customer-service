export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  nodeTitle?: string;
  loopIndex?: number;
  isWelcome?: boolean;
  isError?: boolean;
  isInterrupt?: boolean;
  isFallback?: boolean;
}

export interface SSEEvent {
  type: 'meta' | 'coze_event' | 'error' | 'done';
  event?: string;
  data?: unknown;
  message?: string;
}

export interface PendingResume {
  eventId: string;
  interruptType: number;
}
