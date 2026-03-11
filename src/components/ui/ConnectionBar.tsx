/**
 * GoatCitadel Mobile — Connection Status Bar
 * Shows gateway connection state and provides quick reconnect.
 */
import React, { useCallback, useEffect, useState, memo } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { checkGatewayHealth, getGatewayUrl } from '../../api/client';

type ConnectionState = 'checking' | 'connected' | 'disconnected';

export const ConnectionBar = memo(function ConnectionBar() {
    const [state, setState] = useState<ConnectionState>('checking');
    const pulse = React.useRef(new Animated.Value(0.5)).current;

    const check = useCallback(async () => {
        setState('checking');
        const ok = await checkGatewayHealth();
        setState(ok ? 'connected' : 'disconnected');
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

    if (state === 'connected') return null; // hide when connected

    const isChecking = state === 'checking';

    return (
        <Pressable style={s.bar} onPress={check} disabled={isChecking}>
            <View style={[s.dot, isChecking ? s.dotChecking : s.dotOff]} />
            <Text style={s.text}>
                {isChecking ? 'Connecting to gateway…' : 'Gateway unreachable'}
            </Text>
            {!isChecking ? (
                <Text style={s.retry}>TAP TO RETRY</Text>
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
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotChecking: { backgroundColor: colors.ember },
    dotOff: { backgroundColor: colors.crimson },
    text: { ...typography.bodySm, color: colors.textMuted, flex: 1 },
    retry: { ...typography.eyebrow, color: colors.crimson, fontSize: 9 },
});
