/**
 * GoatCitadel Mobile — Health Monitor Screen
 * Real-time system health dashboard with vitals, uptime, and connectivity.
 */
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    GCHeader, GCCard, GCStatusChip, GCButton, FadeIn, PulseDot,
} from '../../src/components/ui';
import { AdaptiveContainer, SectionGrid } from '../../src/components/layout';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { fetchSystemVitals } from '../../src/api/client';
import type { SystemVitals } from '../../src/api/types';
import { useGatewayAccess } from '../../src/context/GatewayAccessContext';
import { gatewayShellAccessToneToChipTone } from '../../src/features/gateway/accessState';

/** Animated ring gauge component */
function GaugeRing({ value, max, label, color, unit }: {
    value: number; max: number; label: string; color: string; unit: string;
}) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const tone = pct > 90 ? colors.crimson : pct > 70 ? colors.ember : color;

    return (
        <View style={s.gauge}>
            <View style={[s.gaugeCircle, { borderColor: tone + '44' }]}>
                <View style={[s.gaugeInner, { borderColor: tone }]}>
                    <Text style={[s.gaugePct, { color: tone }]}>{pct.toFixed(0)}%</Text>
                </View>
            </View>
            <Text style={s.gaugeLabel}>{label}</Text>
            <Text style={s.gaugeValue}>{formatBytes(value)} {unit}</Text>
        </View>
    );
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    return `${hours}h ${mins}m`;
}

export default function HealthScreen() {
    const router = useRouter();
    const bottomPad = useBottomInsetPadding(32);
    const { shellState, refreshAccess, busy } = useGatewayAccess();
    const statusPulseColor = shellState.tone === 'success'
        ? colors.success
        : shellState.tone === 'warning'
            ? colors.ember
            : shellState.tone === 'muted'
                ? colors.textDim
                : colors.crimson;

    const vitals = useApiData<SystemVitals>(
        useCallback(() => fetchSystemVitals(), []),
        { pollMs: 10000 },
    );

    const v = vitals.data;
    return (
        <View style={s.safe} >
            <GCHeader
                eyebrow="Infrastructure"
                title="Health Monitor"
                subtitle="System vitals, memory, and connectivity"
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}
                refreshControl={
                    <RefreshControl
                        refreshing={vitals.refreshing} onRefresh={vitals.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                }
            >
                <AdaptiveContainer>
                {/* Overall Status */}
                <FadeIn delay={100}>
                    <GCCard style={s.section}>
                        <View style={s.statusRow}>
                            <PulseDot
                                color={statusPulseColor}
                                size={8}
                            />
                            <View style={s.statusInfo}>
                                <Text style={s.statusTitle}>Gateway Connection</Text>
                                <Text style={s.statusSubtitle}>
                                    {shellState.message}
                                </Text>
                            </View>
                            <GCStatusChip
                                tone={gatewayShellAccessToneToChipTone(shellState.tone)}
                            >
                                {shellState.status === 'degraded-live-updates' ? 'LIVE DEGRADED' : shellState.label.toUpperCase()}
                            </GCStatusChip>
                        </View>
                        <Text style={s.statusSubtitle}>Next: {shellState.nextStep}</Text>
                        <View style={s.statusActions}>
                            <GCButton
                                title={shellState.canOpenLogin ? 'Open Login Gate' : busy ? 'Checking...' : 'Retry Gateway Check'}
                                onPress={() => shellState.canOpenLogin ? router.push('/login') : void refreshAccess()}
                                variant={shellState.canOpenLogin ? 'secondary' : 'ghost'}
                                size="sm"
                            />
                        </View>
                    </GCCard>
                </FadeIn>

                {v ? (
                    <>
                        {/* Host Info */}
                        <FadeIn delay={200}>
                            <GCCard style={s.section}>
                                <Text style={s.sectionTitle}>HOST INFORMATION</Text>
                                <SectionGrid style={s.infoGrid} minItemWidthPhone={220} minItemWidthTablet={260}>
                                    <InfoRow label="Hostname" value={v.hostname} />
                                    <InfoRow label="Platform" value={v.platform} />
                                    <InfoRow label="Release" value={v.release} />
                                    <InfoRow label="CPU Cores" value={String(v.cpuCount)} />
                                    <InfoRow label="Uptime" value={formatUptime(v.uptimeSeconds)} />
                                </SectionGrid>
                            </GCCard>
                        </FadeIn>

                        {/* Memory Gauges */}
                        <FadeIn delay={300}>
                            <GCCard style={s.section}>
                                <Text style={s.sectionTitle}>MEMORY UTILIZATION</Text>
                                <SectionGrid style={s.gaugeGrid} minItemWidthPhone={120} minItemWidthTablet={220}>
                                    <GaugeRing
                                        value={v.memoryUsedBytes}
                                        max={v.memoryTotalBytes}
                                        label="System Memory"
                                        color={colors.cyan}
                                        unit=""
                                    />
                                    <GaugeRing
                                        value={v.processRssBytes}
                                        max={v.memoryTotalBytes}
                                        label="Process RSS"
                                        color={colors.ember}
                                        unit=""
                                    />
                                    <GaugeRing
                                        value={v.processHeapUsedBytes}
                                        max={v.processRssBytes || v.memoryTotalBytes}
                                        label="Heap Used"
                                        color={colors.success}
                                        unit=""
                                    />
                                </SectionGrid>
                            </GCCard>
                        </FadeIn>

                        {/* Detailed Memory */}
                        <FadeIn delay={400}>
                            <GCCard style={s.section}>
                                <Text style={s.sectionTitle}>MEMORY BREAKDOWN</Text>
                                <MemoryBar
                                    label="Used"
                                    value={v.memoryUsedBytes}
                                    total={v.memoryTotalBytes}
                                    color={colors.cyan}
                                />
                                <MemoryBar
                                    label="Free"
                                    value={v.memoryFreeBytes}
                                    total={v.memoryTotalBytes}
                                    color={colors.success}
                                />
                                <MemoryBar
                                    label="Process RSS"
                                    value={v.processRssBytes}
                                    total={v.memoryTotalBytes}
                                    color={colors.ember}
                                />
                                <MemoryBar
                                    label="Heap Used"
                                    value={v.processHeapUsedBytes}
                                    total={v.memoryTotalBytes}
                                    color='#a78bfa'
                                />
                            </GCCard>
                        </FadeIn>
                    </>
                ) : (
                    <FadeIn>
                        <GCCard>
                            <Text style={s.emptyText}>
                                {vitals.error || 'Loading vitals...'}
                            </Text>
                        </GCCard>
                    </FadeIn>
                )}

                <View style={{ height: 32 }} />
                </AdaptiveContainer>
            </ScrollView>
        </View>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.infoRow}>
            <Text style={s.infoLabel}>{label}</Text>
            <Text style={s.infoValue}>{value}</Text>
        </View>
    );
}

function MemoryBar({ label, value, total, color }: {
    label: string; value: number; total: number; color: string;
}) {
    const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
    return (
        <View style={s.memRow}>
            <View style={s.memHeader}>
                <Text style={s.memLabel}>{label}</Text>
                <Text style={s.memValue}>{formatBytes(value)} / {formatBytes(total)}</Text>
            </View>
            <View style={s.memTrack}>
                <View style={[s.memFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingBottom: 32 },
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim, fontStyle: 'italic' },

    statusRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    },
    statusInfo: { flex: 1 },
    statusTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    statusSubtitle: { ...typography.caption, color: colors.textDim },
    statusActions: { marginTop: spacing.sm },

    infoGrid: { gap: spacing.sm },
    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
        borderColor: colors.borderQuiet,
        backgroundColor: colors.bgInset,
    },
    infoLabel: { ...typography.bodySm, color: colors.textMuted },
    infoValue: { ...typography.bodySm, color: colors.textPrimary, fontFamily: 'monospace' },

    gaugeGrid: { marginTop: spacing.sm },
    gauge: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
    gaugeCircle: {
        width: 68, height: 68, borderRadius: 34, borderWidth: 3,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.bgInset,
    },
    gaugeInner: {
        width: 54, height: 54, borderRadius: 27, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.bgCore,
    },
    gaugePct: { ...typography.displaySm, fontSize: 13 },
    gaugeLabel: { ...typography.caption, color: colors.textDim, fontSize: 9 },
    gaugeValue: { ...typography.caption, color: colors.textMuted, fontFamily: 'monospace', fontSize: 9 },

    memRow: { marginBottom: spacing.md },
    memHeader: {
        flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs,
    },
    memLabel: { ...typography.bodySm, color: colors.textSecondary },
    memValue: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    memTrack: {
        height: 6, backgroundColor: colors.bgInset, borderRadius: 3,
        overflow: 'hidden',
    },
    memFill: { height: '100%', borderRadius: 3 },
});
