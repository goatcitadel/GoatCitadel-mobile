import { useCallback, useEffect, useRef, useState } from 'react';

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

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else if (!data) setLoading(true);
        try {
            const result = await fetcher();
            if (mountedRef.current) {
                setData(result);
                setError(null);
            }
        } catch (err: any) {
            if (mountedRef.current) {
                setError(err.message ?? 'Request failed');
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [fetcher]);

    useEffect(() => {
        mountedRef.current = true;
        if (options?.enabled !== false) {
            load();
        }
        return () => { mountedRef.current = false; };
    }, [load, options?.enabled]);

    // Polling
    useEffect(() => {
        if (!options?.pollMs || options?.enabled === false) return;
        const interval = setInterval(() => load(), options.pollMs);
        return () => clearInterval(interval);
    }, [load, options?.pollMs, options?.enabled]);

    const refresh = useCallback(() => load(true), [load]);

    return { data, error, loading, refreshing, refresh, reload: load };
}
