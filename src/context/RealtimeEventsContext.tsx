import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../utils/storage';
import { fetchRealtimeEvents, isGatewayAuthFailure } from '../api/client';
import { streamRealtimeEvents } from '../api/realtime-events-stream';
import type { RealtimeEvent } from '../api/types';
import { useGatewayAccess } from './GatewayAccessContext';

type RealtimeEventsStatus = 'idle' | 'connecting' | 'live' | 'degraded';

interface RealtimeEventsContextValue {
    events: RealtimeEvent[];
    status: RealtimeEventsStatus;
    error?: string;
    refreshSnapshot: () => Promise<void>;
}

const STORE_KEY_LAST_CURSOR = 'gc_realtime_events_last_cursor';
const DEFAULT_SNAPSHOT_LIMIT = 100;
const STREAM_RECONNECT_DELAY_MS = 5000;

const RealtimeEventsContext = createContext<RealtimeEventsContextValue>({
    events: [],
    status: 'idle',
    refreshSnapshot: async () => { },
});

export function RealtimeEventsProvider({ children }: { children: React.ReactNode }) {
    const [events, setEvents] = useState<RealtimeEvent[]>([]);
    const [status, setStatus] = useState<RealtimeEventsStatus>('idle');
    const [error, setError] = useState<string | undefined>(undefined);
    const lastCursorRef = useRef<string | undefined>(undefined);
    const streamAbortRef = useRef<(() => void) | undefined>(undefined);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const appStateRef = useRef(AppState.currentState);
    const mountedRef = useRef(true);
    const { reportAuthExpired, reportLiveUpdatesDegraded, reportLiveUpdatesHealthy } = useGatewayAccess();

    const persistCursor = useCallback(async (cursor: string | undefined) => {
        lastCursorRef.current = cursor;
        if (!cursor) {
            await deleteSecureItem(STORE_KEY_LAST_CURSOR);
            return;
        }
        await setSecureItem(STORE_KEY_LAST_CURSOR, cursor);
    }, []);

    const applySnapshot = useCallback((items: RealtimeEvent[]) => {
        const sorted = [...items]
            .sort((left, right) => readRealtimeSequence(right) - readRealtimeSequence(left))
            .slice(0, DEFAULT_SNAPSHOT_LIMIT);
        setEvents(sorted);
        const newest = sorted[0];
        const newestSequence = newest ? readRealtimeSequence(newest) : undefined;
        if (newestSequence) {
            void persistCursor(String(newestSequence));
        }
    }, [persistCursor]);

    const appendEvent = useCallback((event: RealtimeEvent) => {
        setEvents((current) => {
            if (current.some((entry) => entry.eventId === event.eventId)) {
                return current;
            }
            const next = [event, ...current]
                .sort((left, right) => readRealtimeSequence(right) - readRealtimeSequence(left))
                .slice(0, DEFAULT_SNAPSHOT_LIMIT);
            return next;
        });
        const nextSequence = readRealtimeSequence(event);
        if (nextSequence) {
            void persistCursor(String(nextSequence));
        }
    }, [persistCursor]);

    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = undefined;
        }
    }, []);

    const stopStream = useCallback(() => {
        clearReconnectTimer();
        streamAbortRef.current?.();
        streamAbortRef.current = undefined;
    }, [clearReconnectTimer]);

    const refreshSnapshot = useCallback(async () => {
        try {
            const result = await fetchRealtimeEvents({ limit: DEFAULT_SNAPSHOT_LIMIT });
            applySnapshot(result.items);
            setStatus((current) => current === 'idle' ? 'idle' : 'live');
            setError(undefined);
            reportLiveUpdatesHealthy();
        } catch (nextError) {
            if (isGatewayAuthFailure(nextError)) {
                const message = (nextError as Error).message || 'Gateway access expired while refreshing realtime events.';
                setStatus('degraded');
                setError(message);
                reportAuthExpired('Gateway access expired while refreshing realtime events.');
                return;
            }
            const message = (nextError as Error).message || 'Realtime snapshot failed.';
            setStatus('degraded');
            setError(message);
            reportLiveUpdatesDegraded(message);
            throw nextError;
        }
    }, [applySnapshot, reportAuthExpired, reportLiveUpdatesDegraded, reportLiveUpdatesHealthy]);

    const scheduleReconnect = useCallback(() => {
        clearReconnectTimer();
        if (!mountedRef.current || appStateRef.current !== 'active') {
            return;
        }
        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = undefined;
            openStream();
        }, STREAM_RECONNECT_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearReconnectTimer]);

    const openStream = useCallback(() => {
        stopStream();
        if (!mountedRef.current || appStateRef.current !== 'active') {
            return;
        }

        setStatus((current) => current === 'idle' ? 'connecting' : current === 'live' ? 'connecting' : current);
        setError(undefined);

        streamAbortRef.current = streamRealtimeEvents({
            onOpen: () => {
                if (!mountedRef.current) {
                    return;
                }
                setStatus('live');
                setError(undefined);
                reportLiveUpdatesHealthy();
            },
            onEvent: (event) => {
                if (!mountedRef.current) {
                    return;
                }
                appendEvent(event);
                setStatus('live');
                setError(undefined);
                reportLiveUpdatesHealthy();
            },
            onReplayGap: async () => {
                try {
                    await refreshSnapshot();
                } catch {
                    // refreshSnapshot already reports the degraded state.
                } finally {
                    scheduleReconnect();
                }
            },
            onError: (message) => {
                if (!mountedRef.current) {
                    return;
                }
                if (isGatewayAuthFailure(new Error(message))) {
                    setStatus('degraded');
                    setError(message);
                    reportAuthExpired('Gateway access expired while streaming realtime events.');
                    return;
                }
                setStatus('degraded');
                setError(message);
                reportLiveUpdatesDegraded(message);
                scheduleReconnect();
            },
        }, {
            afterCursor: lastCursorRef.current,
            replay: lastCursorRef.current ? undefined : 50,
        });
    }, [
        appendEvent,
        refreshSnapshot,
        reportAuthExpired,
        reportLiveUpdatesDegraded,
        reportLiveUpdatesHealthy,
        scheduleReconnect,
        stopStream,
    ]);

    useEffect(() => {
        mountedRef.current = true;
        void (async () => {
            const storedCursor = await getSecureItem(STORE_KEY_LAST_CURSOR);
            lastCursorRef.current = storedCursor?.trim() || undefined;
            try {
                await refreshSnapshot();
            } catch {
                // refreshSnapshot already tracks the visible error state.
            } finally {
                if (mountedRef.current) {
                    openStream();
                }
            }
        })();

        return () => {
            mountedRef.current = false;
            stopStream();
        };
    }, [openStream, refreshSnapshot, stopStream]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;
            if (previousState !== 'active' && nextState === 'active') {
                openStream();
                return;
            }
            if (previousState === 'active' && nextState !== 'active') {
                stopStream();
            }
        });
        return () => subscription.remove();
    }, [openStream, stopStream]);

    const value = useMemo<RealtimeEventsContextValue>(() => ({
        events,
        status,
        error,
        refreshSnapshot,
    }), [error, events, refreshSnapshot, status]);

    return (
        <RealtimeEventsContext.Provider value={value}>
            {children}
        </RealtimeEventsContext.Provider>
    );
}

export function useRealtimeEvents() {
    return useContext(RealtimeEventsContext);
}

function readRealtimeSequence(event: RealtimeEvent): number {
    const value = (event as RealtimeEvent & { sequence?: unknown }).sequence;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
