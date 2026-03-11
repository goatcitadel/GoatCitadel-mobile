/**
 * GoatCitadel Mobile — Settings Screen
 * Real governance controls matching desktop SettingsPage.
 * Supports: gateway URL config, active provider/model switching,
 * tool profile, budget mode. Honest about what requires desktop.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCButton, GCStatusChip } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchRuntimeSettings, checkGatewayHealth, patchSettings } from '../../src/api/client';
import { setGatewayUrl, getGatewayUrl } from '../../src/api/client';
import type { RuntimeSettings } from '../../src/api/types';
import { useToast } from '../../src/context/ToastContext';

const TOOL_PROFILES = ['minimal', 'standard', 'coding', 'ops', 'research', 'danger'] as const;
const BUDGET_MODES = ['saver', 'balanced', 'power'] as const;

export default function SettingsScreen() {
    const router = useRouter();
    const { showToast } = useToast();
    const [gwUrl, setGwUrl] = useState(getGatewayUrl());
    const [gwStatus, setGwStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
    const [saving, setSaving] = useState(false);

    const settings = useApiData<RuntimeSettings>(
        useCallback(() => fetchRuntimeSettings(), []),
    );

    const testConnection = async () => {
        setGatewayUrl(gwUrl);
        const ok = await checkGatewayHealth();
        setGwStatus(ok ? 'online' : 'offline');
        if (ok) {
            showToast({ message: `Connected to ${gwUrl}`, type: 'success' });
            settings.refresh();
        } else {
            Alert.alert('Unreachable', `Could not reach ${gwUrl}. Check network/firewall.`);
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

    return (
        <View style={s.safe} >
            <GCHeader eyebrow="Configuration" title="Settings"
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />} />
            <ScrollView contentContainerStyle={s.content}>

                {/* Gateway Connection */}
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>GATEWAY CONNECTION</Text>
                    <View style={s.inputRow}>
                        <TextInput style={s.input} value={gwUrl} onChangeText={setGwUrl}
                            placeholder="http://127.0.0.1:8787" placeholderTextColor={colors.textDim}
                            autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                        <GCStatusChip tone={gwStatus === 'online' ? 'success' : gwStatus === 'offline' ? 'critical' : 'muted'}>
                            {gwStatus.toUpperCase()}
                        </GCStatusChip>
                    </View>
                    <GCButton title="Test Connection" onPress={testConnection} variant="primary" size="md" />
                </GCCard>

                {/* Tool Profile */}
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

                {/* Budget Mode */}
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

                {/* Active Provider */}
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

                {/* Provider List — tappable to switch */}
                {settings.data && settings.data.llm.providers.length > 0 ? (
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>ALL PROVIDERS</Text>
                        <Text style={s.sectionDesc}>
                            Tap a provider to make it active. API keys and advanced provider
                            config require Mission Control on desktop.
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
                                </View>
                                <GCStatusChip tone={p.hasApiKey ? 'success' : 'warning'}>
                                    {p.providerId === settings.data!.llm.activeProviderId ? 'ACTIVE' : p.hasApiKey ? 'KEY SET' : 'NO KEY'}
                                </GCStatusChip>
                            </Pressable>
                        ))}
                    </GCCard>
                ) : null}

                {/* Auth Info (read-only) */}
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
                            Auth mode and network allowlist are configured from Mission Control.
                        </Text>
                    </GCCard>
                ) : null}

                {/* About */}
                <GCCard style={s.section}>
                    <Text style={s.sectionTitle}>ABOUT</Text>
                    <Text style={s.aboutText}>GoatCitadel Mobile v0.1.0</Text>
                    <Text style={s.aboutText}>Android-first · Expo + React Native</Text>
                    <Text style={s.dimText}>Operator-first AI command & control</Text>
                </GCCard>

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.md },
    sectionDesc: { ...typography.caption, color: colors.textDim, marginBottom: spacing.md },
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
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.sm,
    },
    infoLabel: { ...typography.bodySm, color: colors.textMuted },
    infoValue: { ...typography.bodySm, color: colors.textSecondary },
    dimText: { ...typography.bodySm, color: colors.textDim },
    aboutText: { ...typography.bodyMd, color: colors.textSecondary },
});
