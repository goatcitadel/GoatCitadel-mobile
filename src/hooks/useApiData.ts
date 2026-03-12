import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Hook for polling API data with pull-to-refresh support.
 */
export function useApiData<T>(
    fetcher: () => Promise<T>,
    options?: { enabled?: boolean; pollMs?: number },
) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const mountedRef = useRef(true);
    const inFlightRef = useRef<Promise<T> | null>(null);
    // P1-3: Use a ref to track data so `load` never has a stale closure over `data`.
    const dataRef = useRef<T | null>(null);

    const load = useCallback(async (isRefresh = false) => {
        if (inFlightRef.current) {
            if (isRefresh) {
                setRefreshing(true);
            }
            return inFlightRef.current;
        }

        if (isRefresh) setRefreshing(true);
        else if (!dataRef.current) setLoading(true);

        let task: Promise<T> | null = null;
        task = (async () => {
            try {
                const result = await fetcher();
                if (mountedRef.current) {
                    dataRef.current = result;
                    setData(result);
                    setError(null);
                }
                return result;
            } catch (err: any) {
                if (mountedRef.current) {
                    setError(err.message ?? 'Request failed');
                }
                throw err;
            } finally {
                if (mountedRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
                if (inFlightRef.current === task) {
                    inFlightRef.current = null;
                }
            }
        })();

        inFlightRef.current = task;
        return task;
    }, [fetcher]);

    useEffect(() => {
        mountedRef.current = true;
        if (options?.enabled !== false) {
            void load().catch(() => undefined);
        }
        return () => { mountedRef.current = false; };
    }, [load, options?.enabled]);

    // Polling — P2-3: Pause when app is backgrounded.
    useEffect(() => {
        if (!options?.pollMs || options?.enabled === false) return;

        let interval: ReturnType<typeof setInterval> | null = null;

        const start = () => {
            if (interval) return;
            interval = setInterval(() => {
                void load().catch(() => undefined);
            }, options.pollMs!);
        };

        const stop = () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        };

        start();

        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                start();
            } else {
                stop();
            }
        });

        return () => {
            stop();
            sub.remove();
        };
    }, [load, options?.pollMs, options?.enabled]);

    const refresh = useCallback(async () => {
        try {
            await load(true);
        } catch {
            // Error state is already tracked in the hook.
        }
    }, [load]);

    const reload = useCallback(async () => {
        try {
            await load(false);
        } catch {
            // Error state is already tracked in the hook.
        }
    }, [load]);

    return { data, error, loading, refreshing, refresh, reload };
}
