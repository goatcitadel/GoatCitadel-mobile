import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { preflightGatewayAccess } from '../api/client';
import type { GatewayAccessPreflightResult } from '../api/types';
import {
    deriveGatewayShellAccessState,
    type GatewayAccessLike,
    type GatewayShellAccessState,
} from '../features/gateway/accessState';

interface GatewayAccessContextValue {
    access: GatewayAccessLike;
    shellState: GatewayShellAccessState;
    busy: boolean;
    refreshAccess: (options?: { preserveVisibleState?: boolean }) => Promise<GatewayAccessPreflightResult>;
    setAccessResult: (result: GatewayAccessPreflightResult) => void;
    reportAuthExpired: (message?: string) => void;
    reportLiveUpdatesDegraded: (detail?: string) => void;
    reportLiveUpdatesHealthy: () => void;
}

const initialAccess: GatewayAccessLike = {
    status: 'checking',
    message: 'Checking gateway access and live updates…',
};

const GatewayAccessContext = createContext<GatewayAccessContextValue>({
    access: initialAccess,
    shellState: deriveGatewayShellAccessState(initialAccess),
    busy: true,
    refreshAccess: async () => ({
        status: 'unreachable',
        message: 'Gateway access is not ready yet.',
    }),
    setAccessResult: () => { },
    reportAuthExpired: () => { },
    reportLiveUpdatesDegraded: () => { },
    reportLiveUpdatesHealthy: () => { },
});

export function GatewayAccessProvider({ children }: { children: React.ReactNode }) {
    const [access, setAccess] = useState<GatewayAccessLike>(initialAccess);
    const [busy, setBusy] = useState(true);
    const [liveUpdatesDegraded, setLiveUpdatesDegraded] = useState(false);
    const [liveUpdatesDetail, setLiveUpdatesDetail] = useState<string | undefined>(undefined);
    const appStateRef = useRef(AppState.currentState);

    const setAccessResult = useCallback((result: GatewayAccessPreflightResult) => {
        setAccess(result);
        setBusy(false);
        if (result.status !== 'ready') {
            setLiveUpdatesDegraded(false);
            setLiveUpdatesDetail(undefined);
        }
    }, []);

    const refreshAccess = useCallback(async (options?: { preserveVisibleState?: boolean }) => {
        if (!options?.preserveVisibleState) {
            setAccess((current) => current.status === 'checking'
                ? current
                : {
                    status: 'checking',
                    message: 'Checking gateway access and live updates…',
                    healthDetail: current.healthDetail,
                    authMode: current.authMode,
                    checks: current.checks,
                });
        }
        setBusy(true);
        try {
            const result = await preflightGatewayAccess();
            setAccessResult(result);
            return result;
        } catch (error) {
            const fallback: GatewayAccessPreflightResult = {
                status: 'misconfigured',
                message: (error as Error).message || 'Gateway access preflight failed.',
            };
            setAccessResult(fallback);
            return fallback;
        }
    }, [setAccessResult]);

    const reportAuthExpired = useCallback((message?: string) => {
        setAccess({
            status: 'needs-auth',
            message: message?.trim() || 'Gateway credentials are required to continue on this device.',
        });
        setBusy(false);
        setLiveUpdatesDegraded(false);
        setLiveUpdatesDetail(undefined);
    }, []);

    const reportLiveUpdatesDegraded = useCallback((detail?: string) => {
        setLiveUpdatesDegraded(true);
        setLiveUpdatesDetail(detail?.trim() || undefined);
    }, []);

    const reportLiveUpdatesHealthy = useCallback(() => {
        setLiveUpdatesDegraded(false);
        setLiveUpdatesDetail(undefined);
    }, []);

    useEffect(() => {
        void refreshAccess();
    }, [refreshAccess]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextState;
            if (previousState !== 'active' && nextState === 'active' && access.status !== 'ready') {
                void refreshAccess({ preserveVisibleState: true });
            }
        });
        return () => subscription.remove();
    }, [access.status, refreshAccess]);

    const shellState = useMemo(
        () => deriveGatewayShellAccessState(access, {
            liveUpdatesDegraded,
            liveUpdatesDetail,
        }),
        [access, liveUpdatesDegraded, liveUpdatesDetail],
    );

    const value = useMemo<GatewayAccessContextValue>(() => ({
        access,
        shellState,
        busy,
        refreshAccess,
        setAccessResult,
        reportAuthExpired,
        reportLiveUpdatesDegraded,
        reportLiveUpdatesHealthy,
    }), [
        access,
        shellState,
        busy,
        refreshAccess,
        setAccessResult,
        reportAuthExpired,
        reportLiveUpdatesDegraded,
        reportLiveUpdatesHealthy,
    ]);

    return (
        <GatewayAccessContext.Provider value={value}>
            {children}
        </GatewayAccessContext.Provider>
    );
}

export function useGatewayAccess() {
    return useContext(GatewayAccessContext);
}
