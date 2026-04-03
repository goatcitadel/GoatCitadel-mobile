/**
 * GoatCitadel Mobile — SSE streaming client for gateway realtime events.
 */
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { RealtimeEvent } from './types';
import {
    createIdempotencyKey,
    getAndroidGatewayHttpModule,
    getGatewayAuthHeaders,
    getGatewayUrl,
} from './client';

const EVENTS_STREAM_TIMEOUT_MS = 180000;

const androidStreamEmitter: NativeEventEmitter | null = (() => {
    if (Platform.OS !== 'android') {
        return null;
    }
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

type RealtimeReplayGap = {
    error: 'replay_gap';
    requestedCursor?: number;
    oldestCursor?: number;
    newestCursor?: number;
};

export interface RealtimeEventsStreamCallbacks {
    onOpen?: () => void;
    onEvent?: (event: RealtimeEvent) => void;
    onReplayGap?: (gap: RealtimeReplayGap) => void;
    onError?: (message: string) => void;
}

export function streamRealtimeEvents(
    callbacks: RealtimeEventsStreamCallbacks,
    options?: {
        afterCursor?: string;
        replay?: number;
    },
): () => void {
    const abortController = new AbortController();
    const targetPath = buildRealtimeEventsPath(options);
    const targetUrl = `${getGatewayUrl()}${targetPath}`;
    const processor = createRealtimeEventStreamProcessor(callbacks);

    (async () => {
        try {
            if (Platform.OS === 'android') {
                const module = getAndroidGatewayHttpModule();
                if (module?.streamRequest) {
                    const streamId = createIdempotencyKey();
                    const emitter = androidStreamEmitter ?? new NativeEventEmitter(module as never);
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
                            processor.pushChunk(event.chunk);
                            return;
                        }

                        if (event.event === 'error') {
                            if (!abortController.signal.aborted) {
                                const detail = [event.errorClass, event.errorMessage].filter(Boolean).join(': ') || 'Stream failed';
                                callbacks.onError?.(`Network error: ${detail} | GET ${targetPath} timeout=${EVENTS_STREAM_TIMEOUT_MS}ms`);
                            }
                            cleanup();
                            return;
                        }

                        if (event.event === 'complete') {
                            processor.flush();
                            cleanup();
                        }
                    });

                    abortController.signal.addEventListener('abort', handleAbort, { once: true });

                    const startResult = await module.streamRequest(
                        streamId,
                        'GET',
                        targetUrl,
                        {
                            Accept: 'text/event-stream',
                            ...getGatewayAuthHeaders(),
                        },
                        null,
                        EVENTS_STREAM_TIMEOUT_MS,
                    );

                    const status = startResult.status ?? -1;
                    if (status <= 0) {
                        cleanup();
                        callbacks.onError?.(
                            `Network error: ${[startResult.errorClass, startResult.errorMessage].filter(Boolean).join(': ') || 'Native Android stream failed'} | GET ${targetPath} timeout=${EVENTS_STREAM_TIMEOUT_MS}ms`,
                        );
                        return;
                    }

                    if (status < 200 || status >= 300) {
                        cleanup();
                        callbacks.onError?.(`Stream error ${status}: ${(startResult.body ?? '').slice(0, 200)}`);
                        return;
                    }

                    callbacks.onOpen?.();
                    return;
                }
            }

            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    Accept: 'text/event-stream',
                    ...getGatewayAuthHeaders(),
                },
                signal: abortController.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                callbacks.onError?.(`Stream error ${response.status}: ${text.slice(0, 200)}`);
                return;
            }

            callbacks.onOpen?.();

            if (!response.body) {
                const responseText = await response.text();
                processor.pushChunk(responseText);
                processor.flush();
                return;
            }

            if (typeof response.body.getReader !== 'function') {
                const responseText = await response.text();
                processor.pushChunk(responseText);
                processor.flush();
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    processor.processLine(line);
                }
            }

            if (buffer.trim()) {
                processor.processLine(buffer);
            }
            processor.flush();
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                callbacks.onError?.(error?.message ?? 'Realtime events stream failed');
            }
        }
    })();

    return () => abortController.abort();
}

function buildRealtimeEventsPath(options?: {
    afterCursor?: string;
    replay?: number;
}): string {
    const params = new URLSearchParams();
    if (options?.afterCursor?.trim()) {
        params.set('afterCursor', options.afterCursor.trim());
    } else if (typeof options?.replay === 'number') {
        params.set('replay', String(options.replay));
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return `/api/v1/events/stream${suffix}`;
}

function createRealtimeEventStreamProcessor(callbacks: RealtimeEventsStreamCallbacks) {
    let buffer = '';
    let currentEventId: string | undefined;
    let currentEventName: string | undefined;
    let currentDataLines: string[] = [];

    const dispatchCurrent = () => {
        const payload = currentDataLines.join('\n').trim();
        if (!payload) {
            resetCurrent();
            return;
        }

        try {
            if (currentEventName === 'replay-gap') {
                callbacks.onReplayGap?.(JSON.parse(payload) as RealtimeReplayGap);
            } else {
                callbacks.onEvent?.(JSON.parse(payload) as RealtimeEvent);
            }
        } catch {
            callbacks.onError?.(`Malformed realtime event payload${currentEventId ? ` (${currentEventId})` : ''}.`);
        }

        resetCurrent();
    };

    const resetCurrent = () => {
        currentEventId = undefined;
        currentEventName = undefined;
        currentDataLines = [];
    };

    const processLine = (line: string) => {
        const normalized = line.replace(/\r$/, '');
        if (!normalized.length) {
            dispatchCurrent();
            return;
        }
        if (normalized.startsWith(':')) {
            return;
        }
        if (normalized.startsWith('id:')) {
            currentEventId = normalized.slice(3).trim();
            return;
        }
        if (normalized.startsWith('event:')) {
            currentEventName = normalized.slice(6).trim();
            return;
        }
        if (normalized.startsWith('data:')) {
            currentDataLines.push(normalized.slice(5).trimStart());
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

    const flush = () => {
        if (buffer.trim()) {
            processLine(buffer);
            buffer = '';
        }
        dispatchCurrent();
    };

    return {
        processLine,
        pushChunk,
        flush,
    };
}
