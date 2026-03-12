/**
 * GoatCitadel Mobile — Connection Status Bar
 * Shows gateway connection state and provides quick reconnect.
 */
import React, { useCallback, useEffect, useState, memo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme/tokens';
import { preflightGatewayAccess, checkGatewayHealth } from '../../api/client';

type ConnectionState = 'checking' | 'connected' | 'needs-auth' | 'misconfigured' | 'disconnected';

export const ConnectionBar = memo(function ConnectionBar() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [state, setState] = useState<ConnectionState>('checking');
    const pulse = React.useRef(new Animated.Value(0.5)).current;

    // Full preflight — used on mount and manual retry.
    const fullCheck = useCallback(async () => {
        setState('checking');
        const result = await preflightGatewayAccess();
        if (result.status === 'ready') {
            setState('connected');
            return;
        }
        if (result.status === 'needs-auth') {
            setState('needs-auth');
            return;
        }
        if (result.status === 'misconfigured') {
            setState('misconfigured');
            return;
        }
        setState('disconnected');
    }, []);

    // P2-2: Lightweight health-only ping for periodic re-checks to avoid
    // the visible "Connecting..." flash from two full preflight requests.
    // Only use the fast path when already connected — otherwise always do
    // a full preflight so auth/misconfigured states are detected correctly.
    const quickCheck = useCallback(async () => {
        try {
            const healthy = await checkGatewayHealth();
            if (healthy) {
                // Only skip the full preflight if we were already connected.
                // A healthy /health doesn't guarantee valid auth.
                setState((prev) => {
                    if (prev === 'connected') return prev;
                    // Not yet confirmed — schedule a full check to validate auth.
                    void fullCheck();
                    return prev;
                });
            } else {
                await fullCheck();
            }
        } catch {
            await fullCheck();
        }
    }, [fullCheck]);

    useEffect(() => {
        fullCheck();
        const interval = setInterval(quickCheck, 30000);
        return () => clearInterval(interval);
    }, [fullCheck, quickCheck]);

    useEffect(() => {
        if (state === 'checking') {
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
                ]),
            );
            anim.start();
            return () => anim.stop();
        }
    }, [state, pulse]);

    if (state === 'connected') return null;

    const isChecking = state === 'checking';
    const message = state === 'needs-auth'
        ? 'Gateway auth expired — tap to reopen the login gate'
        : state === 'misconfigured'
            ? 'Gateway auth is misconfigured'
            : isChecking
                ? 'Connecting to gateway…'
                : 'Gateway unreachable';

    return (
        <Pressable
            style={[
                s.bar,
                { paddingTop: insets.top + spacing.xs },
                state === 'needs-auth' && s.barWarning,
                state === 'misconfigured' && s.barCritical,
            ]}
            onPress={() => {
                if (state === 'needs-auth') {
                    router.push('/login');
                    return;
                }
                void fullCheck();
            }}
            disabled={isChecking}
        >
            <View
                style={[
                    s.dot,
                    isChecking ? s.dotChecking : state === 'needs-auth' ? s.dotWarn : s.dotOff,
                ]}
            />
            <Text style={s.text}>
                {message}
            </Text>
            {!isChecking ? (
                <Text style={[s.retry, state === 'needs-auth' && s.retryWarn]}>
                    {state === 'needs-auth' ? 'OPEN LOGIN' : 'TAP TO RETRY'}
                </Text>
            ) : (
                <Animated.View style={{ opacity: pulse }}>
                    <Ionicons name="sync" size={14} color={colors.textDim} />
                </Animated.View>
            )}
        </Pressable>
    );
});

const s = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.sm,
        backgroundColor: 'rgba(255, 86, 120, 0.08)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 86, 120, 0.2)',
    },
    barWarning: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderBottomColor: 'rgba(245, 158, 11, 0.2)',
    },
    barCritical: {
        backgroundColor: 'rgba(255, 86, 120, 0.14)',
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotChecking: { backgroundColor: colors.ember },
    dotWarn: { backgroundColor: colors.ember },
    dotOff: { backgroundColor: colors.crimson },
    text: { ...typography.bodySm, color: colors.textMuted, flex: 1 },
    retry: { ...typography.eyebrow, color: colors.crimson, fontSize: 9 },
    retryWarn: { color: colors.ember },
});
