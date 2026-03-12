/**
 * GoatCitadel Mobile — SSE Streaming Client for Chat
 */
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type {
    ChatInputPart,
    ChatMemoryMode,
    ChatMode,
    ChatSendMessageRequest,
    ChatStreamChunk,
    ChatThinkingLevel,
    ChatWebMode,
} from './types';
import {
    createIdempotencyKey,
    getAndroidGatewayHttpModule,
    getGatewayAuthHeaders,
    getGatewayUrl,
} from './client';

const NATIVE_CHAT_SEND_TIMEOUT_MS = 180000;

// P1-6: Hoist NativeEventEmitter to module scope to avoid per-call reconstruction.
const _androidStreamEmitter: NativeEventEmitter | null = (() => {
    if (Platform.OS !== 'android') return null;
    const mod = NativeModules.GatewayHttp;
    return mod ? new NativeEventEmitter(mod as never) : null;
})();

type AndroidGatewayStreamEvent = {
    streamId?: string;
    event?: 'line' | 'error' | 'complete';
    chunk?: string;
    errorClass?: string;
    errorMessage?: string;
    body?: string;
    status?: number;
};

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
    options?: {
        mode?: ChatMode;
        providerId?: string;
        model?: string;
        webMode?: ChatWebMode;
        memoryMode?: ChatMemoryMode;
        thinkingLevel?: ChatThinkingLevel;
        attachments?: string[];
        parts?: ChatInputPart[];
    },
): () => void {
    const abortController = new AbortController();
    const baseUrl = getGatewayUrl();
    const input: ChatSendMessageRequest = {
        content: messageContent,
        ...(options?.parts?.length ? { parts: options.parts } : {}),
        ...(options?.attachments?.length ? { attachments: options.attachments } : {}),
        ...(options?.mode ? { mode: options.mode } : {}),
        ...(options?.providerId ? { providerId: options.providerId } : {}),
        ...(options?.model ? { model: options.model } : {}),
        ...(options?.webMode ? { webMode: options.webMode } : {}),
        ...(options?.memoryMode ? { memoryMode: options.memoryMode } : {}),
        ...(options?.thinkingLevel ? { thinkingLevel: options.thinkingLevel } : {}),
    };

    const streamProcessor = createStreamChunkProcessor(callbacks);

    (async () => {
        try {
            if (Platform.OS === 'android') {
                const module = getAndroidGatewayHttpModule();
                if (module?.streamRequest) {
                    const streamId = createIdempotencyKey();
                    const targetPath = `/api/v1/chat/sessions/${sessionId}/agent-send/stream`;
                    const targetUrl = `${baseUrl}${targetPath}`;
                    const emitter = _androidStreamEmitter ?? new NativeEventEmitter(module as never);
                    let cleanedUp = false;

                    const cleanup = () => {
                        if (cleanedUp) {
                            return;
                        }
                        cleanedUp = true;
                        subscription.remove();
                        abortController.signal.removeEventListener('abort', handleAbort);
                    };

                    const handleAbort = () => {
                        module.cancelStream?.(streamId);
                        cleanup();
                    };

                    const subscription = emitter.addListener('GatewayHttpStreamEvent', (event: AndroidGatewayStreamEvent) => {
                        if (event.streamId !== streamId) {
                            return;
                        }

                        if (event.event === 'line' && event.chunk) {
                            streamProcessor.pushChunk(event.chunk);
                            return;
                        }

                        if (event.event === 'error') {
                            if (!abortController.signal.aborted) {
                                const detail = [event.errorClass, event.errorMessage].filter(Boolean).join(': ') || 'Stream failed';
                                callbacks.onError?.(`Network error: ${detail} | POST ${targetPath} timeout=${NATIVE_CHAT_SEND_TIMEOUT_MS}ms`);
                            }
                            cleanup();
                            return;
                        }

                        if (event.event === 'complete') {
                            streamProcessor.flush();
                            cleanup();
                        }
                    });

                    abortController.signal.addEventListener('abort', handleAbort, { once: true });

                    const startResult = await module.streamRequest(
                        streamId,
                        'POST',
                        targetUrl,
                        {
                            'Content-Type': 'application/json',
                            Accept: 'text/event-stream',
                            'Idempotency-Key': createIdempotencyKey(),
                            ...getGatewayAuthHeaders(),
                        },
                        JSON.stringify(input),
                        NATIVE_CHAT_SEND_TIMEOUT_MS,
                    );

                    const status = startResult.status ?? -1;
                    if (status <= 0) {
                        cleanup();
                        callbacks.onError?.(
                            `Network error: ${[startResult.errorClass, startResult.errorMessage].filter(Boolean).join(': ') || 'Native Android stream failed'} | POST ${targetPath} timeout=${NATIVE_CHAT_SEND_TIMEOUT_MS}ms`,
                        );
                        return;
                    }

                    if (status < 200 || status >= 300) {
                        cleanup();
                        callbacks.onError?.(`Stream error ${status}: ${(startResult.body ?? '').slice(0, 200)}`);
                        return;
                    }

                    return;
                }
            }

            const res = await fetch(
                `${baseUrl}/api/v1/chat/sessions/${sessionId}/agent-send/stream`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'text/event-stream',
                        'Idempotency-Key': createIdempotencyKey(),
                        ...getGatewayAuthHeaders(),
                    },
                    body: JSON.stringify(input),
                    signal: abortController.signal,
                },
            );

            if (!res.ok) {
                const text = await res.text();
                callbacks.onError?.(`Stream error ${res.status}: ${text.slice(0, 200)}`);
                return;
            }

            if (!res.body) {
                const responseText = await res.text();
                streamProcessor.pushChunk(responseText);
                streamProcessor.flush();
                return;
            }

            if (typeof res.body.getReader !== 'function') {
                const responseText = await res.text();
                streamProcessor.pushChunk(responseText);
                streamProcessor.flush();
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
                    streamProcessor.processLine(line);
                }
            }

            // P0-3: Flush any trailing data in the buffer and ensure the
            // stream processor's done sentinel fires even on clean close.
            if (buffer.trim()) {
                streamProcessor.processLine(buffer);
            }
            streamProcessor.flush();
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                callbacks.onError?.(err.message ?? 'Stream failed');
            }
        }
    })();

    return () => abortController.abort();
}

function createStreamChunkProcessor(callbacks: StreamCallbacks) {
    let buffer = '';
    let doneDispatched = false;
    let lastTurnId = '';
    let lastMessageId = '';

    const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') return;

        try {
            const chunk: ChatStreamChunk = JSON.parse(jsonStr);

            // Track latest IDs so flush() can synthesize a done sentinel.
            if ('turnId' in chunk && chunk.turnId) lastTurnId = chunk.turnId;
            if ('messageId' in chunk && (chunk as any).messageId) lastMessageId = (chunk as any).messageId;

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
                    doneDispatched = true;
                    callbacks.onDone?.(chunk.turnId, chunk.messageId);
                    break;
            }
        } catch {
            // Skip malformed chunks
        }
    };

    const pushChunk = (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            processLine(line);
        }
    };

    /** Ensure onDone fires exactly once, even if the server closed without a done sentinel. */
    const flush = () => {
        if (buffer.trim()) {
            processLine(buffer);
            buffer = '';
        }
        if (!doneDispatched && lastTurnId) {
            doneDispatched = true;
            callbacks.onDone?.(lastTurnId, lastMessageId);
        }
    };

    return {
        processLine,
        pushChunk,
        flush,
    };
}
