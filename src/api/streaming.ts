/**
 * GoatCitadel Mobile — SSE Streaming Client for Chat
 */
import type { ChatStreamChunk } from './types';
import { getGatewayUrl } from './client';

export interface StreamCallbacks {
    onDelta?: (delta: string, turnId: string) => void;
    onMessageStart?: (turnId: string, messageId: string) => void;
    onMessageDone?: (turnId: string, messageId: string, content: string) => void;
    onToolStart?: (turnId: string, toolRun: ChatStreamChunk & { type: 'tool_start' }) => void;
    onToolResult?: (turnId: string, toolRun: ChatStreamChunk & { type: 'tool_result' }) => void;
    onTraceUpdate?: (turnId: string, trace: any) => void;
    onError?: (error: string) => void;
    onDone?: (turnId: string, messageId: string) => void;
}

/**
 * Opens an SSE connection and streams chat responses.
 * Returns an abort function to stop the stream.
 */
export function streamChatResponse(
    sessionId: string,
    messageContent: string,
    callbacks: StreamCallbacks,
    options?: { mode?: string; providerId?: string; model?: string },
): () => void {
    const abortController = new AbortController();
    const baseUrl = getGatewayUrl();

    const body = JSON.stringify({
        content: messageContent,
        stream: true,
        ...(options?.mode ? { mode: options.mode } : {}),
        ...(options?.providerId ? { providerId: options.providerId } : {}),
        ...(options?.model ? { model: options.model } : {}),
    });

    (async () => {
        try {
            const res = await fetch(
                `${baseUrl}/api/chat/sessions/${sessionId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'text/event-stream',
                    },
                    body,
                    signal: abortController.signal,
                },
            );

            if (!res.ok) {
                const text = await res.text();
                callbacks.onError?.(`Stream error ${res.status}: ${text.slice(0, 200)}`);
                return;
            }

            if (!res.body) {
                callbacks.onError?.('No response body for stream');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === '[DONE]') continue;

                    try {
                        const chunk: ChatStreamChunk = JSON.parse(jsonStr);
                        switch (chunk.type) {
                            case 'message_start':
                                callbacks.onMessageStart?.(chunk.turnId, chunk.messageId);
                                break;
                            case 'delta':
                                callbacks.onDelta?.(chunk.delta, chunk.turnId);
                                break;
                            case 'message_done':
                                callbacks.onMessageDone?.(chunk.turnId, chunk.messageId, chunk.content);
                                break;
                            case 'tool_start':
                                callbacks.onToolStart?.(chunk.turnId, chunk as any);
                                break;
                            case 'tool_result':
                                callbacks.onToolResult?.(chunk.turnId, chunk as any);
                                break;
                            case 'trace_update':
                                callbacks.onTraceUpdate?.(chunk.turnId, (chunk as any).trace);
                                break;
                            case 'error':
                                callbacks.onError?.(chunk.error);
                                break;
                            case 'done':
                                callbacks.onDone?.(chunk.turnId, chunk.messageId);
                                break;
                        }
                    } catch {
                        // Skip malformed chunks
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                callbacks.onError?.(err.message ?? 'Stream failed');
            }
        }
    })();

    return () => abortController.abort();
}
