/**
 * GoatCitadel Mobile — Animated Components
 * Premium micro-animations and visual effects.
 */
import React, { useEffect, useRef, memo } from 'react';
import { View, Animated, StyleSheet, Easing, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';

/** Pulsing glow dot — used for live status indicators */
export const PulseDot = memo(function PulseDot({
    color = colors.success,
    size = 8,
}: {
    color?: string;
    size?: number;
}) {
    const pulse = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.4,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [pulse]);

    return (
        <View style={{ width: size * 2.5, height: size * 2.5, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
                style={{
                    position: 'absolute',
                    width: size * 2.5,
                    height: size * 2.5,
                    borderRadius: size * 1.25,
                    backgroundColor: color,
                    opacity: pulse,
                    transform: [{ scale: pulse }],
                }}
            />
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                }}
            />
        </View>
    );
});

/** Skeleton shimmer loader — replaces loading spinners */
export const SkeletonBlock = memo(function SkeletonBlock({
    width = '100%',
    height = 20,
    borderRadius = radii.sm,
    style,
}: {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}) {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.timing(shimmer, {
                toValue: 1,
                duration: 1400,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );
        anim.start();
        return () => anim.stop();
    }, [shimmer]);

    const opacity = shimmer.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 0.6, 0.3],
    });

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: colors.bgCardElevated,
                    opacity,
                },
                style,
            ]}
        />
    );
});

/** Fade-in wrapper — smooth entrance for loaded content */
export const FadeIn = memo(function FadeIn({
    children,
    delay = 0,
    duration = 400,
    style,
}: {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    style?: ViewStyle;
}) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(12)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                delay,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [opacity, translateY, delay, duration]);

    return (
        <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
            {children}
        </Animated.View>
    );
});

/** Animated counter — counts up from 0 to target value */
export const AnimatedCounter = memo(function AnimatedCounter({
    value,
    prefix = '',
    suffix = '',
    style,
}: {
    value: number;
    prefix?: string;
    suffix?: string;
    style?: any;
}) {
    const animValue = useRef(new Animated.Value(0)).current;
    const displayRef = useRef<number>(0);
    const [display, setDisplay] = React.useState('0');

    useEffect(() => {
        animValue.setValue(0);
        const anim = Animated.timing(animValue, {
            toValue: value,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        });

        const listener = animValue.addListener(({ value: v }) => {
            const rounded = Math.round(v);
            if (rounded !== displayRef.current) {
                displayRef.current = rounded;
                setDisplay(rounded.toLocaleString());
            }
        });

        anim.start();
        return () => {
            animValue.removeListener(listener);
            anim.stop();
        };
    }, [value, animValue]);

    return (
        <Animated.Text style={style}>
            {prefix}{display}{suffix}
        </Animated.Text>
    );
});

/** Glowing border effect on a card */
export const GlowBorder = memo(function GlowBorder({
    children,
    color = colors.cyan,
    intensity = 0.3,
    style,
}: {
    children: React.ReactNode;
    color?: string;
    intensity?: number;
    style?: ViewStyle;
}) {
    const glow = useRef(new Animated.Value(intensity * 0.5)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(glow, {
                    toValue: intensity,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
                Animated.timing(glow, {
                    toValue: intensity * 0.5,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: false,
                }),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [glow, intensity]);

    const borderColor = glow.interpolate({
        inputRange: [0, intensity],
        outputRange: [`${color}22`, `${color}66`],
    });

    return (
        <Animated.View style={[{ borderWidth: 1, borderColor, borderRadius: radii.md }, style]}>
            {children}
        </Animated.View>
    );
});

/** Typing indicator — 3 bouncing dots */
export const TypingIndicator = memo(function TypingIndicator() {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const bounce = (dot: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: -6, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
                    Animated.delay(600 - delay),
                ]),
            );
        const a1 = bounce(dot1, 0);
        const a2 = bounce(dot2, 150);
        const a3 = bounce(dot3, 300);
        a1.start(); a2.start(); a3.start();
        return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, [dot1, dot2, dot3]);

    return (
        <View style={s.typingRow}>
            {[dot1, dot2, dot3].map((dot, i) => (
                <Animated.View key={i}
                    style={[s.typingDot, { transform: [{ translateY: dot }] }]}
                />
            ))}
        </View>
    );
});

/** Scan line overlay — subtle CRT-style effect */
export const ScanLines = memo(function ScanLines() {
    const opacity = useRef(new Animated.Value(0.03)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.06, duration: 3000, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.03, duration: 3000, useNativeDriver: true }),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[s.scanLines, { opacity }]}
            pointerEvents="none"
        />
    );
});

const s = StyleSheet.create({
    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.cyan,
        opacity: 0.7,
    },
    scanLines: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
        backgroundColor: 'transparent',
        // On native, this would use a repeating-gradient shader or image overlay
        // On web, this simulates via a semi-transparent overlay
        borderTopWidth: 1,
        borderTopColor: 'rgba(84, 221, 255, 0.03)',
    },
});
