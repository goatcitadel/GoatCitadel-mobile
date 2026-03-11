/**
 * GoatCitadel Mobile — Login / Gateway Connect Screen
 * Secure authentication flow with gateway URL setup.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, Pressable, StyleSheet, Animated,
    Easing, KeyboardAvoidingView, Platform, ScrollView, ImageBackground
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getSecureItem, setSecureItem } from '../src/utils/storage';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import { setGatewayUrl, setAuthToken, checkGatewayHealth } from '../src/api/client';

const STORE_KEY_URL = 'gc_gateway_url';
const STORE_KEY_TOKEN = 'gc_auth_token';

export default function LoginScreen() {
    const router = useRouter();
    const [url, setUrl] = useState('http://127.0.0.1:8787');
    const [token, setToken] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Animated logo
    const logoScale = useRef(new Animated.Value(0.7)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const formY = useRef(new Animated.Value(30)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entrance animation
        Animated.sequence([
            Animated.parallel([
                Animated.timing(logoScale, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
                Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(formY, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.timing(formOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]),
        ]).start();

        // Load saved credentials
        (async () => {
            const savedUrl = await getSecureItem(STORE_KEY_URL);
            const savedToken = await getSecureItem(STORE_KEY_TOKEN);
            if (savedUrl) setUrl(savedUrl);
            if (savedToken) setToken(savedToken);
        })();
    }, []);

    const handleConnect = async () => {
        setStatus('checking');
        setErrorMsg('');

        setGatewayUrl(url);
        if (token) setAuthToken(token);

        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        const ok = await checkGatewayHealth();
        if (ok) {
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setStatus('success');
            // Save to secure store
            await setSecureItem(STORE_KEY_URL, url);
            if (token) await setSecureItem(STORE_KEY_TOKEN, token);
            // Navigate to app
            setTimeout(() => router.replace('/(tabs)'), 600);
        } else {
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            setStatus('error');
            setErrorMsg('Could not reach the gateway. Check the URL and your network.');
        }
    };

    const handleSkip = () => {
        setGatewayUrl(url);
        if (token) setAuthToken(token);
        router.replace('/(tabs)');
    };

    return (
        <ImageBackground source={require('../assets/login_bg.png')} style={s.bgImage} resizeMode="cover">
            <LinearGradient colors={['rgba(9, 10, 15, 0.4)', 'rgba(9, 10, 15, 0.95)']} style={StyleSheet.absoluteFillObject} />
            <View style={s.safe}>
                <KeyboardAvoidingView style={s.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

                        {/* Logo / Brand */}
                        <Animated.View style={[s.brandSection, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
                            <View style={s.logoContainer}>
                                <View style={s.logoRing}>
                                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
                                    <Ionicons name="shield-checkmark" size={48} color={colors.cyan} style={{ zIndex: 1 }} />
                                </View>
                                <View style={s.logoGlow} />
                            </View>
                            <Text style={s.brandName}>GOATCITADEL</Text>
                            <Text style={s.brandTagline}>Operator-first AI command & control</Text>
                        </Animated.View>

                        {/* Connect Form wrapped in Blur */}
                        <Animated.View style={[s.formSection, { opacity: formOpacity, transform: [{ translateY: formY }] }]}>
                            <BlurView intensity={30} tint="dark" style={s.glassCard}>
                                <Text style={s.formTitle}>CONNECT TO GATEWAY</Text>

                                {/* URL Field */}
                                <View style={s.fieldGroup}>
                                    <Text style={s.fieldLabel}>GATEWAY URL</Text>
                                    <View style={s.inputRow}>
                                        <Ionicons name="globe" size={16} color={colors.textDim} />
                                        <TextInput style={s.input} value={url} onChangeText={setUrl}
                                            placeholder="http://127.0.0.1:8787" placeholderTextColor={colors.textDim}
                                            autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                                    </View>
                                </View>

                                {/* Token Field */}
                                <View style={s.fieldGroup}>
                                    <Text style={s.fieldLabel}>AUTH TOKEN (optional)</Text>
                                    <View style={s.inputRow}>
                                        <Ionicons name="key" size={16} color={colors.textDim} />
                                        <TextInput style={s.input} value={token} onChangeText={setToken}
                                            placeholder="Bearer token" placeholderTextColor={colors.textDim}
                                            secureTextEntry={!showToken} autoCapitalize="none" autoCorrect={false} />
                                        <Pressable onPress={() => {
                                            if (Platform.OS !== 'web') Haptics.selectionAsync();
                                            setShowToken(!showToken);
                                        }}>
                                            <Ionicons name={showToken ? 'eye-off' : 'eye'} size={18} color={colors.textDim} />
                                        </Pressable>
                                    </View>
                                </View>

                                {/* Error */}
                                {errorMsg ? (
                                    <View style={s.errorRow}>
                                        <Ionicons name="warning" size={14} color={colors.crimson} />
                                        <Text style={s.errorText}>{errorMsg}</Text>
                                    </View>
                                ) : null}

                                {/* Connect Button */}
                                <Pressable
                                    style={({ pressed }) => [
                                        s.connectBtn,
                                        status === 'checking' && s.connectBtnDisabled,
                                        status === 'success' && s.connectBtnSuccess,
                                        pressed && s.connectBtnPressed,
                                    ]}
                                    onPress={handleConnect}
                                    disabled={status === 'checking' || status === 'success'}
                                >
                                    {status === 'checking' ? (
                                        <Ionicons name="sync" size={20} color={colors.bgCore} />
                                    ) : status === 'success' ? (
                                        <Ionicons name="checkmark-circle" size={20} color={colors.bgCore} />
                                    ) : (
                                        <Ionicons name="flash" size={20} color={colors.bgCore} />
                                    )}
                                    <Text style={s.connectBtnText}>
                                        {status === 'checking' ? 'CONNECTING…'
                                            : status === 'success' ? 'CONNECTED'
                                                : 'CONNECT'}
                                    </Text>
                                </Pressable>

                                {/* Skip */}
                                <Pressable style={s.skipBtn} onPress={() => {
                                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    handleSkip();
                                }}>
                                    <Text style={s.skipText}>SKIP — USE DEFAULTS</Text>
                                </Pressable>
                            </BlurView>
                        </Animated.View>

                        {/* Version */}
                        <Text style={s.version}>GoatCitadel Mobile v0.2.1 · Built with Gemini</Text>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </ImageBackground>
    );
}

const s = StyleSheet.create({
    bgImage: { flex: 1, backgroundColor: colors.bgCore },
    safe: { flex: 1 },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },

    brandSection: { alignItems: 'center', marginBottom: 40 },
    logoContainer: { position: 'relative', marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'center' },
    logoRing: {
        width: 104, height: 104, borderRadius: 52,
        borderWidth: 1, borderColor: 'rgba(84, 221, 255, 0.3)',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    logoGlow: {
        position: 'absolute', width: 140, height: 140, borderRadius: 70,
        backgroundColor: colors.cyanGlow, opacity: 0.15,
        zIndex: -1,
    },
    brandName: {
        fontFamily: typography.displayFont, fontSize: 32, letterSpacing: 4,
        color: colors.textPrimary,
    },
    brandTagline: { ...typography.bodySm, color: colors.textDim, marginTop: 4 },

    formSection: { marginBottom: 32 },
    glassCard: {
        padding: spacing.xl,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(15, 20, 30, 0.3)',
        overflow: 'hidden',
    },
    formTitle: { ...typography.eyebrow, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
    fieldGroup: { marginBottom: spacing.lg },
    fieldLabel: { ...typography.eyebrow, color: colors.cyan, marginBottom: spacing.sm, fontSize: 9, opacity: 0.8 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: 'rgba(0, 0, 0, 0.4)', borderRadius: radii.sm,
        borderWidth: 1, borderColor: 'rgba(84, 221, 255, 0.2)',
        paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'android' ? spacing.sm : spacing.md,
    },
    input: { flex: 1, color: colors.textPrimary, ...typography.bodyMd, fontFamily: 'monospace' },

    errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    errorText: { ...typography.bodySm, color: colors.crimson, flex: 1 },

    connectBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        backgroundColor: colors.cyan, borderRadius: radii.md,
        paddingVertical: spacing.md + 2, marginBottom: spacing.md,
    },
    connectBtnPressed: { opacity: 0.8 },
    connectBtnDisabled: { backgroundColor: colors.textDim },
    connectBtnSuccess: { backgroundColor: colors.success },
    connectBtnText: {
        fontFamily: typography.displayFont, fontSize: 15, letterSpacing: 1.5,
        color: colors.bgCore, fontWeight: '700',
    },

    skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
    skipText: { ...typography.eyebrow, color: colors.textDim, fontSize: 10 },

    version: { ...typography.caption, color: colors.textDim, textAlign: 'center', marginTop: 24 },
});
