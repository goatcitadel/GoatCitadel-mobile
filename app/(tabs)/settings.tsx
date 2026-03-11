/**
 * GoatCitadel Mobile — Settings Screen
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCButton, GCStatusChip } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchRuntimeSettings, checkGatewayHealth } from '../../src/api/client';
import { setGatewayUrl, getGatewayUrl } from '../../src/api/client';
import type { RuntimeSettings } from '../../src/api/types';

export default function SettingsScreen() {
    const router = useRouter();
    const [gwUrl, setGwUrl] = useState(getGatewayUrl());
    const [gwStatus, setGwStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

    const settings = useApiData<RuntimeSettings>(
        useCallback(() => fetchRuntimeSettings(), []),
    );

    const testConnection = async () => {
        setGatewayUrl(gwUrl);
        const ok = await checkGatewayHealth();
        setGwStatus(ok ? 'online' : 'offline');
        Alert.alert(ok ? 'Connected' : 'Unreachable', ok
            ? `Gateway at ${gwUrl} is responding.`
            : `Could not reach ${gwUrl}. Check network/firewall.`);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
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
                            <Text style={s.providerCount}>
                                {settings.data.llm.providers.length} provider{settings.data.llm.providers.length !== 1 ? 's' : ''} configured
                            </Text>
                        </>
                    ) : (
                        <Text style={s.dimText}>{settings.error || 'Loading…'}</Text>
                    )}
                </GCCard>

                {/* Provider List */}
                {settings.data && settings.data.llm.providers.length > 0 ? (
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>ALL PROVIDERS</Text>
                        {settings.data.llm.providers.map((p) => (
                            <View key={p.providerId} style={s.providerRow}>
                                <View style={[s.providerDot, p.providerId === settings.data!.llm.activeProviderId && { backgroundColor: colors.cyan }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.providerRowLabel}>{p.label}</Text>
                                    <Text style={s.providerRowModel}>{p.defaultModel}</Text>
                                </View>
                                <GCStatusChip tone={p.hasApiKey ? 'success' : 'warning'}>
                                    {p.hasApiKey ? 'KEY SET' : 'NO KEY'}
                                </GCStatusChip>
                            </View>
                        ))}
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
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.md },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    input: {
        flex: 1, backgroundColor: colors.bgInput, borderRadius: radii.sm, borderWidth: 1,
        borderColor: colors.borderCyan, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        color: colors.textPrimary, ...typography.bodyMd, fontFamily: 'monospace',
    },
    providerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    providerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
    providerLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    providerModel: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    providerCount: { ...typography.caption, color: colors.textDim },
    providerRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    providerRowLabel: { ...typography.bodySm, color: colors.textPrimary },
    providerRowModel: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    dimText: { ...typography.bodySm, color: colors.textDim },
    aboutText: { ...typography.bodyMd, color: colors.textSecondary },
});
