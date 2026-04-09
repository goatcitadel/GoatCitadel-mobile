/**
 * GoatCitadel Mobile — Connection Status Bar
 * Shows gateway connection state and provides quick reconnect.
 */
import React, { useEffect, memo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../../hooks/useLayout';
import { colors, spacing, typography } from '../../theme/tokens';
import { useGatewayAccess } from '../../context/GatewayAccessContext';

export const ConnectionBar = memo(function ConnectionBar() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const layout = useLayout();
    const { shellState, busy, refreshAccess } = useGatewayAccess();
    const pulse = React.useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const shouldPoll = shellState.status !== 'ready';
        if (!shouldPoll) {
            return undefined;
        }
        const interval = setInterval(() => {
            void refreshAccess({ preserveVisibleState: true });
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshAccess, shellState.status]);

    useEffect(() => {
        if (shellState.status === 'checking' || busy) {
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
                ]),
            );
            anim.start();
            return () => anim.stop();
        }
        return undefined;
    }, [busy, shellState.status, pulse]);

    if (shellState.status === 'ready') return null;

    const isChecking = shellState.status === 'checking' || busy;
    const isWarning = shellState.tone === 'warning';
    const isCritical = shellState.tone === 'critical';
    const actionLabel = shellState.canOpenLogin
        ? 'OPEN LOGIN'
        : shellState.status === 'degraded-live-updates'
            ? 'RETRY LIVE'
            : 'TAP TO RETRY';

    return (
        <Pressable
            style={[
                s.bar,
                {
                    paddingTop: insets.top + spacing.xs,
                    paddingHorizontal: layout.gutter,
                },
                isWarning && s.barWarning,
                isCritical && s.barCritical,
            ]}
            onPress={() => {
                if (shellState.canOpenLogin) {
                    router.push('/login');
                    return;
                }
                void refreshAccess();
            }}
            disabled={isChecking}
        >
            <View
                style={[
                    s.dot,
                    isChecking ? s.dotChecking : isWarning ? s.dotWarn : s.dotOff,
                ]}
            />
            <Text style={s.text}>
                {shellState.message}
            </Text>
            {!isChecking ? (
                <Text style={[s.retry, shellState.canOpenLogin && s.retryWarn]}>
                    {actionLabel}
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
