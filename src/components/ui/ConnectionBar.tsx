/**
 * GoatCitadel Mobile — Connection Status Bar
 * Shows gateway connection state and provides quick reconnect.
 */
import React, { useCallback, useEffect, useState, memo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme/tokens';
import { preflightGatewayAccess } from '../../api/client';

type ConnectionState = 'checking' | 'connected' | 'needs-auth' | 'misconfigured' | 'disconnected';

export const ConnectionBar = memo(function ConnectionBar() {
    const router = useRouter();
    const [state, setState] = useState<ConnectionState>('checking');
    const pulse = React.useRef(new Animated.Value(0.5)).current;

    const check = useCallback(async () => {
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

    useEffect(() => {
        check();
        const interval = setInterval(check, 30000);
        return () => clearInterval(interval);
    }, [check]);

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
                state === 'needs-auth' && s.barWarning,
                state === 'misconfigured' && s.barCritical,
            ]}
            onPress={() => {
                if (state === 'needs-auth') {
                    router.push('/login');
                    return;
                }
                void check();
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
        paddingVertical: spacing.sm,
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
