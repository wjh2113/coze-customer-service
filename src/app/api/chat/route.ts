import { NextRequest } from 'next/server';

const COZE_API_BASE = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
const WORKFLOW_ID = process.env.COZE_WORKFLOW_ID || '';
const API_TOKEN = process.env.COZE_WORKFLOW_PAT || process.env.COZE_WORKLOAD_API_TOKEN || '';

interface ChatRequestBody {
  message: string;
  eventId?: string;
  interruptType?: number;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const extra = process.env.COZE_EXTRA_HEADERS || '';
  for (const pair of extra.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return headers;
}

/**
 * Parse SSE stream from Coze workflow and forward a friendly protocol to frontend.
 * Protocol:
 *   { type: 'meta', workflowId: string }
 *   { type: 'coze_event', event: string, data: unknown }
 *   { type: 'error', message: string }
 *   { type: 'done' }
 */
async function proxyWorkflowStream(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<ReadableStream> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Coze API error ${response.status}: ${errorText}`);
  }

  const upstream = response.body;
  if (!upstream) {
    throw new Error('No response body from Coze API');
  }

  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'Message'; // Default SSE event type

  const stream = new ReadableStream({
    async pull(controller) {
      const encoder = new TextEncoder();
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          // Capture SSE event type
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
            continue;
          }
          
          // Skip id: lines
          if (trimmed.startsWith('id:')) {
            continue;
          }
          
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

            const forwardPayload = {
              type: 'coze_event',
              event: currentEvent,
              data: parsed,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(forwardPayload)}\n\n`)
            );
          } catch {
            // Skip malformed JSON lines
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return stream;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const { message, eventId, interruptType } = body;

    if (!API_TOKEN) {
      return Response.json(
        { error: 'API token not configured' },
        { status: 500 }
      );
    }

    if (!WORKFLOW_ID) {
      return Response.json(
        { error: 'Workflow ID not configured' },
        { status: 500 }
      );
    }

    const headers = buildHeaders();
    let url: string;
    let requestBody: Record<string, unknown>;

    if (eventId) {
      // Resume interrupted workflow
      url = `${COZE_API_BASE}/v1/workflow/stream_resume`;
      requestBody = {
        workflow_id: WORKFLOW_ID,
        event_id: eventId,
        interrupt_type: interruptType ?? 1,
        resume_data: message,
      };
    } else {
      // Start new workflow run
      url = `${COZE_API_BASE}/v1/workflow/stream_run`;
      requestBody = {
        workflow_id: WORKFLOW_ID,
        parameters: {
          USER_INPUT: message,
          CONVERSATION_NAME: 'default',
        },
      };
    }

    const stream = await proxyWorkflowStream(url, requestBody, headers);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
