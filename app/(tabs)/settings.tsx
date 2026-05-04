/**
 * GoatCitadel Mobile — Settings Screen
 * Real governance controls matching desktop SettingsPage.
 * Supports: gateway URL config, active provider/model switching,
 * tool profile, budget mode. Honest about what requires desktop.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { GCHeader, GCCard, GCButton, GCStatusChip } from '../../src/components/ui';
import { AdaptiveContainer, ContextPane, MasterDetailShell } from '../../src/components/layout';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import {
    deleteOpenAICodexOAuthCredential,
    fetchOpenAICodexOAuthStatus,
    fetchRuntimeSettings,
    patchSettings,
    pollOpenAICodexOAuthDeviceFlow,
    startOpenAICodexOAuthDeviceFlow,
    type OpenAICodexDeviceStartResponse,
} from '../../src/api/client';
import { setGatewayUrl, getGatewayUrl, setAuthToken, getAuthToken } from '../../src/api/client';
import { deleteSecureItem, setSecureItem } from '../../src/utils/storage';
import type { RuntimeSettings } from '../../src/api/types';
import { useToast } from '../../src/context/ToastContext';
import { useGatewayAccess } from '../../src/context/GatewayAccessContext';
import { MISSION_AREAS, getMissionRoutesByArea } from '../../src/navigation/missionRoutes';
import {
    deriveGatewayShellAccessState,
    formatGatewayAccessDiagnostics,
    gatewayShellAccessToneToChipTone,
} from '../../src/features/gateway/accessState';
import { triggerPhoneAssistPanicOff } from '../../src/features/phoneAssist';

const TOOL_PROFILES = ['minimal', 'standard', 'coding', 'ops', 'research', 'danger'] as const;
const BUDGET_MODES = ['saver', 'balanced', 'power'] as const;

export default function SettingsScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const { showToast } = useToast();
    const { shellState, refreshAccess } = useGatewayAccess();
    const [gwUrl, setGwUrl] = useState(getGatewayUrl());
    const [token, setToken] = useState(getAuthToken() || '');
    const [saving, setSaving] = useState(false);
    const [codexFlow, setCodexFlow] = useState<OpenAICodexDeviceStartResponse | null>(null);
    const appVersion = Constants.expoConfig?.version ?? 'dev';

    const settings = useApiData<RuntimeSettings>(
        useCallback(() => fetchRuntimeSettings(), []),
    );
    const codexOAuth = useApiData(
        useCallback(() => fetchOpenAICodexOAuthStatus(), []),
        { enabled: Boolean(gwUrl.trim()) },
    );

    const handleGatewayUrlChange = useCallback((nextUrl: string) => {
        setGwUrl(nextUrl);
        setGatewayUrl(nextUrl);
    }, []);

    const testConnection = async () => {
        const trimmedUrl = gwUrl.trim();
        const trimmedToken = token.trim();
        setGatewayUrl(trimmedUrl);
        setAuthToken(trimmedToken || undefined);
        const result = await refreshAccess();
        const nextShellState = deriveGatewayShellAccessState(result);
        const ok = result.status === 'ready';
        if (ok) {
            await setSecureItem('gc_gateway_url', gwUrl);
            if (trimmedToken) {
                await setSecureItem('gc_auth_token', trimmedToken);
            } else {
                await deleteSecureItem('gc_auth_token');
            }
            showToast({ message: `Connected to ${gwUrl}`, type: 'success' });
            settings.refresh();
        } else {
            const diagnostics = formatGatewayAccessDiagnostics(result);
            const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [
                { text: 'Stay Here', style: 'cancel' },
            ];
            if (diagnostics) {
                buttons.push({
                    text: 'Show Diagnostics',
                    onPress: () => Alert.alert('Gateway diagnostics', diagnostics),
                });
            }
            if (nextShellState.canOpenLogin) {
                buttons.push({ text: 'Open Login Gate', onPress: () => router.push('/login') });
            }
            Alert.alert(
                nextShellState.label,
                `${nextShellState.message}\n\nNext: ${nextShellState.nextStep}`,
                buttons,
            );
        }
    };

    const changeToolProfile = async (profile: string) => {
        setSaving(true);
        try {
            await patchSettings({ defaultToolProfile: profile });
            await settings.refresh();
            showToast({ message: `Tool profile → ${profile}`, type: 'success' });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const changeBudgetMode = async (mode: string) => {
        setSaving(true);
        try {
            await patchSettings({ budgetMode: mode });
            await settings.refresh();
            showToast({ message: `Budget mode → ${mode}`, type: 'success' });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const openPrivacyCenter = useCallback(() => {
        router.push('/(tabs)/privacy' as any);
    }, [router]);

    const handleEmergencyDisable = useCallback(() => {
        Alert.alert(
            'Emergency disable',
            'This turns off cloud sync defaults, revokes any active phone-assist consents, and records an audit receipt on this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable now',
                    style: 'destructive',
                    onPress: async () => {
                        await triggerPhoneAssistPanicOff();
                        showToast({ message: 'Phone-assist panic-off triggered', type: 'warning' });
                    },
                },
            ],
        );
    }, [showToast]);

    const switchProvider = async (providerId: string) => {
        const provider = settings.data?.llm.providers.find(p => p.providerId === providerId);
        if (!provider) return;
        setSaving(true);
        try {
            await patchSettings({
                llm: {
                    activeProviderId: providerId,
                    activeModel: provider.defaultModel,
                },
            });
            await settings.refresh();
            showToast({ message: `Switched to ${provider.label}`, type: 'success' });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const startCodexOAuth = useCallback(async () => {
        setSaving(true);
        try {
            const flow = await startOpenAICodexOAuthDeviceFlow();
            setCodexFlow(flow);
            await Linking.openURL(flow.verificationUrl);
            showToast({
                message: flow.userCode
                    ? `Codex OAuth started. Use code ${flow.userCode}.`
                    : 'Codex OAuth started in your browser.',
                type: 'info',
            });
        } catch (error) {
            Alert.alert('Codex OAuth', (error as Error).message || 'Could not start the OAuth device flow.');
        } finally {
            setSaving(false);
        }
    }, [showToast]);

    const pollCodexOAuth = useCallback(async () => {
        if (!codexFlow) {
            return;
        }
        setSaving(true);
        try {
            const result = await pollOpenAICodexOAuthDeviceFlow(codexFlow.flowId);
            if (result.status === 'connected') {
                setCodexFlow(null);
                await Promise.allSettled([codexOAuth.refresh(), settings.refresh()]);
                showToast({ message: 'OpenAI Codex OAuth connected.', type: 'success' });
                return;
            }
            if (result.status === 'expired' || result.status === 'failed') {
                setCodexFlow(null);
                showToast({ message: result.error || `Codex OAuth ${result.status}.`, type: 'warning' });
                return;
            }
            showToast({ message: 'Codex OAuth is still pending.', type: 'info' });
        } catch (error) {
            Alert.alert('Codex OAuth', (error as Error).message || 'Could not poll the OAuth flow.');
        } finally {
            setSaving(false);
        }
    }, [codexFlow, codexOAuth, settings, showToast]);

    const disconnectCodexOAuth = useCallback(async () => {
        setSaving(true);
        try {
            await deleteOpenAICodexOAuthCredential();
            setCodexFlow(null);
            await Promise.allSettled([codexOAuth.refresh(), settings.refresh()]);
            showToast({ message: 'OpenAI Codex OAuth disconnected.', type: 'info' });
        } catch (error) {
            Alert.alert('Codex OAuth', (error as Error).message || 'Could not disconnect Codex OAuth.');
        } finally {
            setSaving(false);
        }
    }, [codexOAuth, settings, showToast]);

    const settingsContent = (
        <View style={s.formColumn}>
            <GCCard style={s.section} accent accentColor={MISSION_AREAS.settings.color}>
                <Text style={s.sectionTitle}>SETTINGS SECTIONS</Text>
                <Text style={s.sectionDesc}>
                    Mobile mirrors the Mission Control Next settings rail. Direct controls stay here; summary lanes open
                    through the Mission Directory when desktop owns deeper editors.
                </Text>
                <View style={s.routeGrid}>
                    {getMissionRoutesByArea('settings').map((route) => (
                        <Pressable
                            key={route.id}
                            style={s.routePill}
                            onPress={() => router.push((route.availableRoute ?? route.mobileRoute) as any)}
                        >
                            <Text style={s.routePillText}>{route.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </GCCard>

            {/* Gateway Connection */}
            <GCCard style={s.section}>
                <Text style={s.sectionTitle}>GATEWAY URL</Text>
                <View style={s.inputRow}>
                    <TextInput style={s.input} value={gwUrl} onChangeText={handleGatewayUrlChange}
                        placeholder="http://192.168.0.10:8787" placeholderTextColor={colors.textDim}
                        autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                    <GCStatusChip tone={gatewayShellAccessToneToChipTone(shellState.tone)}>
                        {shellState.status === 'degraded-live-updates' ? 'LIVE DEGRADED' : shellState.label.toUpperCase()}
                    </GCStatusChip>
                </View>

                <Text style={[s.sectionTitle, { marginTop: spacing.sm }]}>AUTH TOKEN</Text>
                <View style={s.inputRow}>
                    <TextInput style={s.input} value={token} onChangeText={setToken}
                        placeholder="Bearer token (optional)" placeholderTextColor={colors.textDim}
                        secureTextEntry autoCapitalize="none" autoCorrect={false} />
                </View>

                <GCButton title="Save & Test Connection" onPress={testConnection} variant="primary" size="md" />
            </GCCard>

            {settings.data ? (
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>TOOL PROFILE</Text>
                    <Text style={s.sectionDesc}>
                        Controls which tool categories GoatCitadel can use. Higher profiles increase capability
                        but also risk.
                    </Text>
                    <View style={s.chipRow}>
                        {TOOL_PROFILES.map(profile => (
                            <Pressable
                                key={profile}
                                style={[
                                    s.chip,
                                    settings.data?.defaultToolProfile === profile && s.chipActive,
                                    profile === 'danger' && s.chipDanger,
                                ]}
                                onPress={() => changeToolProfile(profile)}
                                disabled={saving}
                            >
                                <Text style={[
                                    s.chipText,
                                    settings.data?.defaultToolProfile === profile && s.chipTextActive,
                                ]}>
                                    {profile}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </GCCard>
            ) : null}

            {settings.data ? (
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>BUDGET MODE</Text>
                    <View style={s.chipRow}>
                        {BUDGET_MODES.map(mode => (
                            <Pressable
                                key={mode}
                                style={[
                                    s.chip,
                                    settings.data?.budgetMode === mode && s.chipActive,
                                ]}
                                onPress={() => changeBudgetMode(mode)}
                                disabled={saving}
                            >
                                <Text style={[
                                    s.chipText,
                                    settings.data?.budgetMode === mode && s.chipTextActive,
                                ]}>
                                    {mode}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </GCCard>
            ) : null}

            <GCCard style={s.section}>
                <Text style={s.sectionTitle}>ACTIVE PROVIDER</Text>
                {settings.data ? (
                    <>
                        <View style={s.providerInfo}>
                            <View style={s.providerDot} />
                            <View>
                                <Text style={s.providerLabel}>{settings.data.llm.activeProviderId}</Text>
                                <Text style={s.providerModel}>{settings.data.llm.activeModel}</Text>
                            </View>
                        </View>
                    </>
                ) : (
                    <Text style={s.dimText}>{settings.error || 'Loading…'}</Text>
                )}
            </GCCard>

            {settings.data && settings.data.llm.providers.length > 0 ? (
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>ALL PROVIDERS</Text>
                    <Text style={s.sectionDesc}>
                        Tap a provider to make it active. Mobile now mirrors the gateway route contract:
                        API style, auth mode, secret source, and OAuth state are shown before you send.
                    </Text>
                    {settings.data.llm.providers.map((p) => (
                        <Pressable
                            key={p.providerId}
                            style={s.providerRow}
                            onPress={() => switchProvider(p.providerId)}
                            disabled={saving || p.providerId === settings.data!.llm.activeProviderId}
                        >
                            <View style={[s.providerDot,
                                p.providerId === settings.data!.llm.activeProviderId && { backgroundColor: colors.cyan }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.providerRowLabel}>{p.label}</Text>
                                <Text style={s.providerRowModel}>{p.defaultModel}</Text>
                                <Text style={s.providerRowMeta}>
                                    {p.apiStyle} · {p.authMode || 'api-key'} · {p.apiKeySource}
                                </Text>
                                {p.oauthStatus?.connected ? (
                                    <Text style={s.providerRowMeta}>
                                        OAuth {p.oauthStatus.accountLabel ? `· ${p.oauthStatus.accountLabel}` : 'connected'}
                                    </Text>
                                ) : null}
                            </View>
                            <GCStatusChip tone={(p.hasApiKey || p.oauthStatus?.connected) ? 'success' : 'warning'}>
                                {p.providerId === settings.data!.llm.activeProviderId
                                    ? 'ACTIVE'
                                    : p.oauthStatus?.connected
                                        ? 'OAUTH'
                                        : p.hasApiKey ? 'KEY SET' : 'NO KEY'}
                            </GCStatusChip>
                        </Pressable>
                    ))}
                </GCCard>
            ) : null}

            {settings.data ? (
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>OPENAI CODEX OAUTH</Text>
                    <Text style={s.sectionDesc}>
                        Codex OAuth is managed by the gateway. Mobile can start the device flow and
                        poll the result, while the credential stays on the gateway.
                    </Text>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Status</Text>
                        <GCStatusChip tone={codexOAuth.data?.connected ? 'success' : 'warning'}>
                            {codexOAuth.data?.connected ? 'CONNECTED' : codexOAuth.error ? 'UNAVAILABLE' : 'NOT CONNECTED'}
                        </GCStatusChip>
                    </View>
                    {codexOAuth.data?.accountLabel ? (
                        <View style={s.infoRow}>
                            <Text style={s.infoLabel}>Account</Text>
                            <Text style={s.infoValue}>{codexOAuth.data.accountLabel}</Text>
                        </View>
                    ) : null}
                    {codexFlow ? (
                        <View style={s.oauthFlowCard}>
                            <Text style={s.providerRowLabel}>Device flow pending</Text>
                            <Text style={s.providerRowModel}>{codexFlow.verificationUrl}</Text>
                            {codexFlow.userCode ? (
                                <Text style={s.oauthCode}>{codexFlow.userCode}</Text>
                            ) : null}
                        </View>
                    ) : null}
                    <View style={s.actionRow}>
                        <GCButton title="Start OAuth" onPress={startCodexOAuth} variant="secondary" size="sm" />
                        {codexFlow ? (
                            <GCButton title="Poll" onPress={pollCodexOAuth} variant="primary" size="sm" />
                        ) : null}
                        {codexOAuth.data?.connected ? (
                            <GCButton title="Disconnect" onPress={disconnectCodexOAuth} variant="danger" size="sm" />
                        ) : null}
                    </View>
                </GCCard>
            ) : null}

            {settings.data ? (
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>RUNTIME POSTURE</Text>
                    <RuntimePostureGrid settings={settings.data} />
                </GCCard>
            ) : null}

            {settings.data ? (
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>SECURITY</Text>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Auth mode</Text>
                        <GCStatusChip tone={settings.data.auth.mode === 'none' ? 'warning' : 'success'}>
                            {settings.data.auth.mode.toUpperCase()}
                        </GCStatusChip>
                    </View>
                    <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Loopback bypass</Text>
                        <Text style={s.infoValue}>{settings.data.auth.allowLoopbackBypass ? 'allowed' : 'blocked'}</Text>
                    </View>
                    <Text style={s.sectionDesc}>
                        Auth mode and network allowlist are configured from Mission Control. If this device loses access,
                        reopen the login gate and request approval from another trusted session.
                    </Text>
                    <View style={s.actionRow}>
                        <GCButton title="Privacy Center" onPress={openPrivacyCenter} variant="secondary" size="sm" />
                        <GCButton title="Emergency Disable" onPress={handleEmergencyDisable} variant="danger" size="sm" />
                    </View>
                </GCCard>
            ) : null}

            <GCCard style={s.section}>
                <Text style={s.sectionTitle}>ABOUT</Text>
                <Text style={s.aboutText}>GoatCitadel Mobile v{appVersion}</Text>
                <Text style={s.aboutText}>Android-first · Expo + React Native</Text>
                <Text style={s.dimText}>Operator-first AI command & control</Text>
            </GCCard>
        </View>
    );

    const summaryPane = (
        <ContextPane style={s.summaryPane}>
            <Text style={s.summaryTitle}>SYSTEM STATUS</Text>
            <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Gateway</Text>
                <Text style={s.summaryValue}>{shellState.label}</Text>
                <Text style={s.summaryHint}>{shellState.message}</Text>
            </View>
            <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Gateway URL</Text>
                <Text style={s.summaryMono}>{gwUrl || 'Not set'}</Text>
            </View>
            <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Provider</Text>
                <Text style={s.summaryValue}>{settings.data?.llm.activeProviderId || 'Loading…'}</Text>
                <Text style={s.summaryMono}>{settings.data?.llm.activeModel || '—'}</Text>
            </View>
            <View style={s.summaryCard}>
                <Text style={s.summaryLabel}>Security</Text>
                <Text style={s.summaryValue}>{settings.data?.auth.mode.toUpperCase() || 'UNKNOWN'}</Text>
                <Text style={s.summaryHint}>App v{appVersion}</Text>
            </View>
        </ContextPane>
    );

    return (
        <View style={s.safe} >
            <GCHeader eyebrow="Configuration" title="Settings"
                subtitle="Providers, access, runtime, workspaces, integrations, channels, tools, and add-ons."
                accentColor={colors.areaSettings}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />} />
            <AdaptiveContainer style={s.adaptiveRoot}>
                {layout.dualPane ? (
                    <MasterDetailShell
                        style={s.shell}
                        master={(
                            <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}>
                                {settingsContent}
                                <View style={{ height: 32 }} />
                            </ScrollView>
                        )}
                        detail={summaryPane}
                    />
                ) : (
                    <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}>
                        {settingsContent}
                        <View style={{ height: 32 }} />
                    </ScrollView>
                )}
            </AdaptiveContainer>
        </View>
    );
}

function RuntimePostureGrid({ settings }: { settings: RuntimeSettings }) {
    const featureCount = Object.values(settings.features ?? {}).filter(Boolean).length;
    const firecrawl = settings.web?.firecrawl;
    return (
        <View style={s.postureGrid}>
            <PostureTile label="Profile" value={settings.deploymentProfile ?? settings.environment ?? 'unknown'} />
            <PostureTile label="Read access" value={settings.readAccessMode ?? 'roots_only'} />
            <PostureTile label="Memory QMD" value={settings.memory?.qmd.enabled ? 'enabled' : 'off'} />
            <PostureTile label="Firecrawl" value={firecrawl?.enabled ? firecrawl.defaultReadBackend : 'off'} />
            <PostureTile label="llama.cpp" value={settings.llamaCpp?.status?.processState ?? (settings.llamaCpp?.enabled ? 'enabled' : 'off')} />
            <PostureTile label="NPU" value={settings.npu?.status?.processState ?? (settings.npu?.enabled ? 'enabled' : 'off')} />
            <PostureTile label="Mesh" value={settings.mesh?.enabled ? settings.mesh.mode : 'off'} />
            <PostureTile label="Features" value={`${featureCount} enabled`} />
        </View>
    );
}

function PostureTile({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.postureTile}>
            <Text style={s.postureLabel}>{label}</Text>
            <Text style={s.postureValue} numberOfLines={2}>{value}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    adaptiveRoot: { flex: 1 },
    shell: { flex: 1 },
    content: { paddingBottom: 32 },
    formColumn: { gap: spacing.lg },
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.md },
    sectionDesc: { ...typography.caption, color: colors.textDim, marginBottom: spacing.md },
    routeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    routePill: {
        minHeight: 32,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        borderRadius: radii.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.bgPanelElevated,
    },
    routePillText: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    input: {
        flex: 1, backgroundColor: colors.bgInput, borderRadius: radii.sm, borderWidth: 1,
        borderColor: colors.borderCyan, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        color: colors.textPrimary, ...typography.bodyMd, fontFamily: 'monospace',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radii.sm, borderWidth: 1, borderColor: colors.borderQuiet,
        backgroundColor: colors.bgCard,
    },
    chipActive: { borderColor: colors.cyan, backgroundColor: colors.cyanMuted },
    chipDanger: { borderColor: colors.crimson + '66' },
    chipText: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600' },
    chipTextActive: { color: colors.cyan },
    providerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    providerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
    providerLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    providerModel: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    providerRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    providerRowLabel: { ...typography.bodySm, color: colors.textPrimary },
    providerRowModel: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    providerRowMeta: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
    oauthFlowCard: {
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.sm,
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    oauthCode: {
        ...typography.displaySm,
        color: colors.cyan,
        fontFamily: 'monospace',
        letterSpacing: 1,
    },
    postureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    postureTile: {
        width: '48%',
        minWidth: 132,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.sm,
        gap: spacing.xs,
    },
    postureLabel: { ...typography.caption, color: colors.textDim, textTransform: 'uppercase' },
    postureValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.sm,
    },
    infoLabel: { ...typography.bodySm, color: colors.textMuted },
    infoValue: { ...typography.bodySm, color: colors.textSecondary },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    dimText: { ...typography.bodySm, color: colors.textDim },
    aboutText: { ...typography.bodyMd, color: colors.textSecondary },
    summaryPane: { gap: spacing.md },
    summaryTitle: { ...typography.eyebrow, color: colors.textPrimary },
    summaryCard: {
        backgroundColor: colors.bgInset,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.md,
        gap: spacing.xs,
    },
    summaryLabel: { ...typography.caption, color: colors.textDim },
    summaryValue: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    summaryMono: { ...typography.caption, color: colors.textSecondary, fontFamily: 'monospace' },
    summaryHint: { ...typography.bodySm, color: colors.textDim },
});
