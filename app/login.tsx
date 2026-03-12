/**
 * GoatCitadel Mobile — Login / Gateway Connect Screen
 * Supports direct token entry and one-time device approval handoff.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, TextInput, Pressable, StyleSheet, Animated,
    Easing, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../src/utils/storage';
import { colors, spacing, typography, radii } from '../src/theme/tokens';
import {
    createDeviceAccessRequest,
    pollGatewayDeviceAccessRequestStatus,
    preflightGatewayAccess,
    setAuthToken,
    setGatewayUrl,
} from '../src/api/client';
import type {
    DeviceAccessDeviceType,
    DeviceAccessRequestCreateResponse,
    DeviceAccessRequestStatus,
    GatewayAccessPreflightResult,
    GatewayAuthMode,
} from '../src/api/types';
import { useGatewayAccess } from '../src/context/GatewayAccessContext';
import { deriveGatewayShellAccessState } from '../src/features/gateway/accessState';

const STORE_KEY_URL = 'gc_gateway_url';
const STORE_KEY_TOKEN = 'gc_auth_token';

type AccessView = GatewayAccessPreflightResult | {
    status: 'idle' | 'checking';
    message: string;
    healthDetail?: string;
    authMode?: GatewayAuthMode;
    checks?: GatewayAccessPreflightResult['checks'];
};

type PendingDeviceApprovalRequest = DeviceAccessRequestCreateResponse & {
    status: DeviceAccessRequestStatus;
};

export default function LoginScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { setAccessResult, reportAuthExpired } = useGatewayAccess();
    const [url, setUrl] = useState('http://127.0.0.1:8787');
    const [token, setToken] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [access, setAccess] = useState<AccessView>({
        status: 'idle',
        message: 'Enter your gateway URL, then verify access or request approval from another signed-in GoatCitadel session.',
    });
    const [formError, setFormError] = useState<string | null>(null);
    const [deviceApprovalError, setDeviceApprovalError] = useState<string | null>(null);
    const [deviceApprovalBusy, setDeviceApprovalBusy] = useState(false);
    const [deviceLabel, setDeviceLabel] = useState(inferPendingDeviceLabel());
    const [pendingDeviceApproval, setPendingDeviceApproval] = useState<PendingDeviceApprovalRequest | null>(null);

    const logoScale = useRef(new Animated.Value(0.7)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const formY = useRef(new Animated.Value(30)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;

    const approvalPending = pendingDeviceApproval?.status === 'pending';
    const shellAccess = useMemo(() => deriveGatewayShellAccessState(access), [access]);
    const authHint = useMemo(() => {
        if (access.status !== 'needs-auth') {
            return 'Direct token access still works, but device approval is the safest way to connect this phone without copying long-lived credentials.';
        }
        if (access.authMode === 'basic') {
            return 'This gateway uses browser-style basic auth. On mobile, the recommended path is to request approval from another authenticated GoatCitadel session.';
        }
        if (access.authMode === 'token') {
            return 'This gateway requires a valid bearer token or a one-time device approval from another authenticated GoatCitadel session.';
        }
        return 'This gateway needs additional access setup before the mobile app can continue.';
    }, [access.authMode, access.status]);

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(logoScale, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(formY, {
                    toValue: 0,
                    duration: 400,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(formOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]),
        ]).start();

        void (async () => {
            const savedUrl = await getSecureItem(STORE_KEY_URL);
            const savedToken = await getSecureItem(STORE_KEY_TOKEN);
            const nextUrl = savedUrl || 'http://127.0.0.1:8787';
            const nextToken = savedToken || '';
            setUrl(nextUrl);
            setToken(nextToken);
            await runPreflight(nextUrl, nextToken, true);
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (pendingDeviceApproval?.status !== 'pending') {
            return;
        }

        let cancelled = false;
        const poll = async () => {
            try {
                const status = await pollGatewayDeviceAccessRequestStatus(
                    pendingDeviceApproval.requestId,
                    pendingDeviceApproval.requestSecret,
                );
                if (cancelled) {
                    return;
                }

                setPendingDeviceApproval((current) => current ? {
                    ...current,
                    status: status.status,
                    expiresAt: status.expiresAt,
                    message: status.message,
                } : current);

                if (status.status === 'approved') {
                    if (status.deviceToken) {
                        setToken(status.deviceToken);
                        await completeSuccessfulConnect(url, status.deviceToken);
                        return;
                    }
                    setDeviceApprovalError('Approval completed, but the one-time device token is no longer available. Reset the request and try again.');
                    return;
                }

                if (status.status === 'rejected' || status.status === 'expired') {
                    setDeviceApprovalError(status.message);
                    await deleteSecureItem(STORE_KEY_TOKEN);
                    setAuthToken(undefined);
                }
            } catch (error) {
                if (!cancelled) {
                    setDeviceApprovalError((error as Error).message);
                }
            }
        };

        void poll();
        const intervalId = setInterval(() => {
            void poll();
        }, Math.max(1500, pendingDeviceApproval.pollAfterMs));

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [pendingDeviceApproval?.status, pendingDeviceApproval?.requestId, pendingDeviceApproval?.requestSecret, pendingDeviceApproval?.pollAfterMs, url]);

    const persistConnection = useCallback(async (nextUrl: string, nextToken?: string) => {
        await setSecureItem(STORE_KEY_URL, nextUrl);
        if (nextToken?.trim()) {
            await setSecureItem(STORE_KEY_TOKEN, nextToken.trim());
        } else {
            await deleteSecureItem(STORE_KEY_TOKEN);
        }
    }, []);

    const completeSuccessfulConnect = useCallback(async (nextUrl: string, nextToken?: string) => {
        const trimmedUrl = nextUrl.trim();
        const trimmedToken = nextToken?.trim();
        setGatewayUrl(trimmedUrl);
        setAuthToken(trimmedToken);
        await persistConnection(trimmedUrl, trimmedToken);
        setPendingDeviceApproval(null);
        setDeviceApprovalError(null);
        setFormError(null);
        setAccess({
            status: 'ready',
            message: 'Gateway access verified. Launching Mission Control Mobile…',
        });
        if (Platform.OS !== 'web') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.replace('/(tabs)');
    }, [persistConnection, router]);

    const runPreflight = useCallback(async (
        nextUrl = url,
        nextToken = token,
        navigateOnReady = false,
    ) => {
        const trimmedUrl = nextUrl.trim();
        const trimmedToken = nextToken.trim();

        if (!trimmedUrl) {
            setFormError('Enter the gateway URL before continuing.');
            return;
        }

        setFormError(null);
        setDeviceApprovalError(null);
        setGatewayUrl(trimmedUrl);
        setAuthToken(trimmedToken || undefined);
        setAccess({
            status: 'checking',
            message: 'Contacting the gateway and validating access…',
        });

        const result = await preflightGatewayAccess();
        setAccess(result);
        setAccessResult(result);

        if (result.status === 'ready' && navigateOnReady) {
            await completeSuccessfulConnect(trimmedUrl, trimmedToken);
            return;
        }

        if (result.status !== 'ready' && Platform.OS !== 'web') {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [completeSuccessfulConnect, token, url]);

    const handleConnect = async () => {
        if (Platform.OS !== 'web') {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        await runPreflight(url, token, true);
    };

    const handleRequestApproval = async () => {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            setFormError('Enter the gateway URL before requesting approval.');
            return;
        }

        setFormError(null);
        setDeviceApprovalError(null);
        setGatewayUrl(trimmedUrl);
        setAuthToken(undefined);
        setDeviceApprovalBusy(true);

        try {
            const created = await createDeviceAccessRequest({
                deviceLabel: deviceLabel.trim() || undefined,
                deviceType: inferPendingDeviceType(),
                platform: inferPendingDevicePlatform(),
            });
            setPendingDeviceApproval({
                ...created,
                status: created.status,
            });
            setAccess({
                status: 'needs-auth',
                authMode: access.authMode,
                message: 'Device approval requested. Open Gatehouse on another authenticated GoatCitadel session to approve this phone.',
            });
            reportAuthExpired('Device approval requested. Open Gatehouse on another authenticated GoatCitadel session to approve this phone.');
            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            setDeviceApprovalError((error as Error).message);
            if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } finally {
            setDeviceApprovalBusy(false);
        }
    };

    return (
        <ImageBackground source={require('../assets/login_bg.png')} style={s.bgImage} resizeMode="cover">
            <LinearGradient colors={['rgba(9, 10, 15, 0.4)', 'rgba(9, 10, 15, 0.95)']} style={StyleSheet.absoluteFillObject} />
            <View style={s.safe}>
                <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView
                        contentContainerStyle={[
                            s.scroll,
                            {
                                paddingTop: insets.top + spacing.xl,
                                paddingBottom: insets.bottom + spacing.xl,
                            },
                        ]}
                        keyboardShouldPersistTaps="handled"
                    >
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

                        <Animated.View style={[s.formSection, { opacity: formOpacity, transform: [{ translateY: formY }] }]}>
                            <BlurView intensity={30} tint="dark" style={s.glassCard}>
                                <Text style={s.formTitle}>CONNECT TO GATEWAY</Text>

                                <View style={s.statusCard}>
                                    <View style={s.statusHeader}>
                                        <Text style={s.statusLabel}>{shellAccess.label}</Text>
                                        <Ionicons
                                            name={resolveStatusIcon(shellAccess.status)}
                                            size={16}
                                            color={resolveStatusColor(shellAccess.status)}
                                        />
                                    </View>
                                    <Text style={s.statusMessage}>{shellAccess.message}</Text>
                                    <Text style={s.statusDetail}>Next: {shellAccess.nextStep}</Text>
                                    {access.checks?.length ? (
                                        <View style={s.checkList}>
                                            {access.checks.map((check) => (
                                                <View key={check.id} style={s.checkCard}>
                                                    <View style={s.checkHeader}>
                                                        <View style={s.checkHeaderLeft}>
                                                            <Ionicons
                                                                name={resolveCheckIcon(check.status)}
                                                                size={14}
                                                                color={resolveCheckColor(check.status)}
                                                            />
                                                            <Text style={s.checkLabel}>{check.label}</Text>
                                                        </View>
                                                        <Text style={[s.checkStatus, { color: resolveCheckColor(check.status) }]}>
                                                            {check.status.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                    <Text style={s.checkPath}>{check.path}</Text>
                                                    <Text style={s.checkDetail}>{check.detail}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : access.healthDetail ? (
                                        <Text style={s.statusDetail}>{access.healthDetail}</Text>
                                    ) : null}
                                </View>

                                <View style={s.fieldGroup}>
                                    <Text style={s.fieldLabel}>GATEWAY URL</Text>
                                    <View style={s.inputRow}>
                                        <Ionicons name="globe" size={16} color={colors.textDim} />
                                        <TextInput
                                            style={s.input}
                                            value={url}
                                            onChangeText={setUrl}
                                            editable={!approvalPending}
                                            placeholder="http://127.0.0.1:8787"
                                            placeholderTextColor={colors.textDim}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            keyboardType="url"
                                        />
                                    </View>
                                </View>

                                <View style={s.fieldGroup}>
                                    <Text style={s.fieldLabel}>ACCESS TOKEN (optional)</Text>
                                    <View style={s.inputRow}>
                                        <Ionicons name="key" size={16} color={colors.textDim} />
                                        <TextInput
                                            style={s.input}
                                            value={token}
                                            onChangeText={setToken}
                                            editable={!approvalPending}
                                            placeholder="Bearer token or approved device token"
                                            placeholderTextColor={colors.textDim}
                                            secureTextEntry={!showToken}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <Pressable onPress={() => setShowToken((current) => !current)}>
                                            <Ionicons name={showToken ? 'eye-off' : 'eye'} size={18} color={colors.textDim} />
                                        </Pressable>
                                    </View>
                                </View>

                                <View style={s.fieldGroup}>
                                    <Text style={s.fieldLabel}>DEVICE LABEL</Text>
                                    <View style={s.inputRow}>
                                        <Ionicons name="phone-portrait" size={16} color={colors.textDim} />
                                        <TextInput
                                            style={s.input}
                                            value={deviceLabel}
                                            onChangeText={setDeviceLabel}
                                            editable={!approvalPending}
                                            placeholder="How this device should appear in Gatehouse"
                                            placeholderTextColor={colors.textDim}
                                            autoCapitalize="words"
                                            autoCorrect={false}
                                        />
                                    </View>
                                </View>

                                <Text style={s.hintText}>{authHint}</Text>

                                {formError ? (
                                    <View style={s.errorRow}>
                                        <Ionicons name="warning" size={14} color={colors.crimson} />
                                        <Text style={s.errorText}>{formError}</Text>
                                    </View>
                                ) : null}

                                {deviceApprovalError ? (
                                    <View style={s.errorRow}>
                                        <Ionicons name="warning" size={14} color={colors.crimson} />
                                        <Text style={s.errorText}>{deviceApprovalError}</Text>
                                    </View>
                                ) : null}

                                {pendingDeviceApproval ? (
                                    <View style={s.requestCard}>
                                        <View style={s.requestHeader}>
                                            <Text style={s.requestTitle}>Device request {pendingDeviceApproval.status.toUpperCase()}</Text>
                                            <Text style={s.requestCode}>#{pendingDeviceApproval.approvalId.slice(0, 8)}</Text>
                                        </View>
                                        <Text style={s.requestMessage}>{pendingDeviceApproval.message}</Text>
                                        <Text style={s.requestMeta}>
                                            Expires {new Date(pendingDeviceApproval.expiresAt).toLocaleTimeString()}.
                                        </Text>
                                    </View>
                                ) : null}

                                <Pressable
                                    style={({ pressed }) => [
                                        s.connectBtn,
                                        access.status === 'checking' && s.connectBtnDisabled,
                                        pressed && s.connectBtnPressed,
                                    ]}
                                    onPress={() => { void handleConnect(); }}
                                    disabled={access.status === 'checking' || deviceApprovalBusy}
                                >
                                    <Ionicons
                                        name={access.status === 'checking' ? 'sync' : 'flash'}
                                        size={20}
                                        color={colors.bgCore}
                                    />
                                    <Text style={s.connectBtnText}>
                                        {access.status === 'checking' ? 'VERIFYING…' : 'VERIFY ACCESS'}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [
                                        s.secondaryBtn,
                                        (deviceApprovalBusy || approvalPending) && s.secondaryBtnDisabled,
                                        pressed && s.secondaryBtnPressed,
                                    ]}
                                    onPress={() => { void handleRequestApproval(); }}
                                    disabled={deviceApprovalBusy || approvalPending}
                                >
                                    <Ionicons name="phone-portrait" size={18} color={colors.cyan} />
                                    <Text style={s.secondaryBtnText}>
                                        {deviceApprovalBusy
                                            ? 'REQUESTING…'
                                            : approvalPending
                                                ? 'WAITING FOR APPROVAL…'
                                                : 'REQUEST APPROVAL FROM ANOTHER DEVICE'}
                                    </Text>
                                </Pressable>

                                {pendingDeviceApproval ? (
                                    <Pressable
                                        style={s.resetBtn}
                                        onPress={() => {
                                            setPendingDeviceApproval(null);
                                            setDeviceApprovalError(null);
                                        }}
                                    >
                                        <Text style={s.resetText}>RESET DEVICE REQUEST</Text>
                                    </Pressable>
                                ) : null}
                            </BlurView>
                        </Animated.View>

                        <Text style={s.version}>GoatCitadel Mobile v0.2.1 · Device approval enabled</Text>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </ImageBackground>
    );
}

function resolveStatusLabel(status: AccessView['status'] | 'degraded-live-updates'): string {
    if (status === 'checking') {
        return 'Checking gateway';
    }
    if (status === 'ready') {
        return 'Gateway ready';
    }
    if (status === 'needs-auth') {
        return 'Auth required';
    }
    if (status === 'degraded-live-updates') {
        return 'Live updates degraded';
    }
    if (status === 'misconfigured') {
        return 'Gateway misconfigured';
    }
    if (status === 'unreachable') {
        return 'Gateway unreachable';
    }
    return 'Waiting for setup';
}

function resolveStatusIcon(status: AccessView['status'] | 'degraded-live-updates'): keyof typeof Ionicons.glyphMap {
    if (status === 'ready') {
        return 'checkmark-circle';
    }
    if (status === 'needs-auth') {
        return 'lock-closed';
    }
    if (status === 'degraded-live-updates') {
        return 'sync';
    }
    if (status === 'misconfigured') {
        return 'warning';
    }
    if (status === 'unreachable') {
        return 'cloud-offline';
    }
    if (status === 'checking') {
        return 'sync';
    }
    return 'information-circle';
}

function resolveStatusColor(status: AccessView['status'] | 'degraded-live-updates'): string {
    if (status === 'ready') {
        return colors.success;
    }
    if (status === 'needs-auth') {
        return colors.ember;
    }
    if (status === 'degraded-live-updates') {
        return colors.ember;
    }
    if (status === 'misconfigured' || status === 'unreachable') {
        return colors.crimson;
    }
    return colors.textDim;
}

function resolveCheckIcon(status: NonNullable<GatewayAccessPreflightResult['checks']>[number]['status']): keyof typeof Ionicons.glyphMap {
    if (status === 'success') {
        return 'checkmark-circle';
    }
    if (status === '401') {
        return 'lock-closed';
    }
    if (status === 'timeout') {
        return 'time';
    }
    if (status === 'transport-blocked') {
        return 'shield-checkmark';
    }
    return 'warning';
}

function resolveCheckColor(status: NonNullable<GatewayAccessPreflightResult['checks']>[number]['status']): string {
    if (status === 'success') {
        return colors.success;
    }
    if (status === '401') {
        return colors.ember;
    }
    if (status === 'timeout') {
        return '#f59e0b';
    }
    if (status === 'transport-blocked') {
        return colors.crimson;
    }
    return colors.crimson;
}

function inferPendingDeviceType(): DeviceAccessDeviceType {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const { width, height } = Dimensions.get('window');
        const shortestSide = Math.min(width, height);
        return shortestSide >= 720 ? 'tablet' : 'mobile';
    }
    if (Platform.OS === 'web') {
        return 'browser';
    }
    return 'unknown';
}

function inferPendingDevicePlatform(): string | undefined {
    if (Platform.OS === 'android') {
        return 'Android';
    }
    if (Platform.OS === 'ios') {
        return 'iPhone';
    }
    if (Platform.OS === 'web') {
        return 'Web';
    }
    return undefined;
}

function inferPendingDeviceLabel(): string {
    const platform = inferPendingDevicePlatform();
    const type = inferPendingDeviceType();
    if (platform && type === 'tablet') {
        return `${platform} tablet`;
    }
    if (platform && type === 'mobile') {
        return `${platform} phone`;
    }
    return platform || 'New device';
}

const s = StyleSheet.create({
    bgImage: { flex: 1, backgroundColor: colors.bgCore },
    safe: { flex: 1 },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },

    brandSection: { alignItems: 'center', marginBottom: 40 },
    logoContainer: { position: 'relative', marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'center' },
    logoRing: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(84, 221, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    logoGlow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: colors.cyanGlow,
        opacity: 0.15,
        zIndex: -1,
    },
    brandName: {
        fontFamily: typography.displayFont,
        fontSize: 32,
        letterSpacing: 4,
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
    statusCard: {
        marginBottom: spacing.lg,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: 'rgba(84, 221, 255, 0.14)',
        backgroundColor: 'rgba(3, 8, 14, 0.55)',
        padding: spacing.md,
        gap: spacing.xs,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusLabel: {
        ...typography.eyebrow,
        color: colors.textSecondary,
        fontSize: 10,
    },
    statusMessage: {
        ...typography.bodySm,
        color: colors.textPrimary,
        lineHeight: 20,
    },
    statusDetail: {
        ...typography.caption,
        color: colors.textDim,
        fontFamily: 'monospace',
    },
    checkList: {
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    checkCard: {
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        backgroundColor: 'rgba(0, 0, 0, 0.22)',
        padding: spacing.sm,
        gap: 4,
    },
    checkHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    checkHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
    },
    checkLabel: {
        ...typography.eyebrow,
        color: colors.textSecondary,
        fontSize: 9,
    },
    checkStatus: {
        ...typography.eyebrow,
        fontSize: 9,
    },
    checkPath: {
        ...typography.caption,
        color: colors.textDim,
        fontFamily: 'monospace',
    },
    checkDetail: {
        ...typography.caption,
        color: colors.textPrimary,
        lineHeight: 18,
    },
    fieldGroup: { marginBottom: spacing.lg },
    fieldLabel: { ...typography.eyebrow, color: colors.cyan, marginBottom: spacing.sm, fontSize: 9, opacity: 0.8 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: 'rgba(84, 221, 255, 0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: Platform.OS === 'android' ? spacing.sm : spacing.md,
    },
    input: { flex: 1, color: colors.textPrimary, ...typography.bodyMd, fontFamily: 'monospace' },
    hintText: { ...typography.bodySm, color: colors.textDim, marginBottom: spacing.md, lineHeight: 20 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    errorText: { ...typography.bodySm, color: colors.crimson, flex: 1 },
    requestCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: 'rgba(84, 221, 255, 0.18)',
        backgroundColor: 'rgba(2, 8, 14, 0.5)',
        gap: spacing.xs,
    },
    requestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    requestTitle: {
        ...typography.eyebrow,
        color: colors.textSecondary,
        fontSize: 10,
    },
    requestCode: {
        ...typography.caption,
        color: colors.cyan,
        fontFamily: 'monospace',
    },
    requestMessage: { ...typography.bodySm, color: colors.textPrimary, lineHeight: 20 },
    requestMeta: { ...typography.caption, color: colors.textDim },
    connectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.cyan,
        borderRadius: radii.md,
        paddingVertical: spacing.md + 2,
        marginBottom: spacing.md,
    },
    connectBtnPressed: { opacity: 0.8 },
    connectBtnDisabled: { backgroundColor: colors.textDim },
    connectBtnText: {
        fontFamily: typography.displayFont,
        fontSize: 15,
        letterSpacing: 1.5,
        color: colors.bgCore,
        fontWeight: '700',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: 'rgba(84, 221, 255, 0.25)',
        backgroundColor: 'rgba(5, 12, 20, 0.55)',
        paddingVertical: spacing.md,
    },
    secondaryBtnPressed: { opacity: 0.86 },
    secondaryBtnDisabled: { opacity: 0.55 },
    secondaryBtnText: {
        fontFamily: typography.displayFont,
        fontSize: 12,
        letterSpacing: 1.1,
        color: colors.cyan,
        textAlign: 'center',
    },
    resetBtn: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
    resetText: { ...typography.eyebrow, color: colors.textDim, fontSize: 10 },
    version: { ...typography.caption, color: colors.textDim, textAlign: 'center', marginTop: 24 },
});
