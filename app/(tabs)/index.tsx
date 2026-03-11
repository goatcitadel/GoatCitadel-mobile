/**
 * GoatCitadel Mobile — Summit / Dashboard Screen
 * Premium animated dashboard with skeleton loading and entrance effects.
 */
import React, { useCallback, memo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    GCHeader, GCCard, GCStatCard, GCStatusChip, GCButton,
    FadeIn, SkeletonBlock, PulseDot, AnimatedCounter, GlowBorder,
} from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchDashboard, fetchSystemVitals } from '../../src/api/client';
import { useNotifications } from '../../src/context/NotificationContext';
import { useQuickCommand } from '../../src/context/QuickCommandContext';
import type { DashboardState, SystemVitals } from '../../src/api/types';
import { getRealtimeEventMeta } from '../../src/utils/realtimeEvents';

export default function SummitScreen() {
    const router = useRouter();
    const { isTablet } = useLayout();
    const { unreadCount } = useNotifications();
    const { toggle: toggleCommand } = useQuickCommand();

    const dashboard = useApiData<DashboardState>(
        useCallback(() => fetchDashboard(), []),
        { pollMs: 15000 },
    );
    const vitals = useApiData<SystemVitals>(
        useCallback(() => fetchSystemVitals(), []),
        { pollMs: 30000 },
    );

    const isRefreshing = dashboard.refreshing || vitals.refreshing;
    const onRefresh = useCallback(() => {
        dashboard.refresh();
        vitals.refresh();
    }, [dashboard, vitals]);

    const d = dashboard.data;
    const v = vitals.data;
    const isLoading = dashboard.loading && !d;

    return (
        <View style={styles.safe} >
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                }
            >
                <GCHeader
                    eyebrow="Mission Control"
                    title="Command Deck"
                    subtitle="Operator-first triage — health, workload, and what needs attention."
                    right={
                        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                            <Pressable onPress={toggleCommand} style={styles.headerBtn}>
                                <Ionicons name="search" size={18} color={colors.cyan} />
                            </Pressable>
                            <Pressable onPress={() => router.push('/(tabs)/notifications' as any)} style={styles.headerBtn}>
                                <Ionicons name="notifications" size={18} color={colors.textSecondary} />
                                {unreadCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                    </View>
                                )}
                            </Pressable>
                        </View>
                    }
                />

                {dashboard.error && !d ? (
                    <FadeIn>
                        <GCCard style={styles.errorCard} variant="critical">
                            <Text style={styles.errorText}>{dashboard.error}</Text>
                            <GCButton title="Retry" onPress={() => dashboard.reload()} variant="secondary" size="sm" />
                        </GCCard>
                    </FadeIn>
                ) : null}

                {/* KPI Grid — with skeleton loading */}
                {isLoading ? (
                    <View style={[styles.kpiGrid, isTablet && styles.kpiGridTablet]}>
                        {[0, 1, 2, 3].map((i) => (
                            <View key={i} style={styles.kpiSkeleton}>
                                <SkeletonBlock width={80} height={12} style={{ marginBottom: 8 }} />
                                <SkeletonBlock width={50} height={28} style={{ marginBottom: 4 }} />
                                <SkeletonBlock width={100} height={10} />
                            </View>
                        ))}
                    </View>
                ) : (
                    <FadeIn delay={100}>
                        <View style={[styles.kpiGrid, isTablet && styles.kpiGridTablet]}>
                            <AnimatedStatCard
                                label="Pending approvals"
                                value={d?.pendingApprovals ?? 0}
                                note="Actions waiting on you"
                                tone={(d?.pendingApprovals ?? 0) > 0 ? 'warning' : 'default'}
                            />
                            <AnimatedStatCard
                                label="Active sub-agents"
                                value={d?.activeSubagents ?? 0}
                                note="Task sessions in flight"
                                tone={(d?.activeSubagents ?? 0) > 0 ? 'accent' : 'default'}
                            />
                            <GCStatCard
                                label="Daily cost"
                                value={d ? `$${d.dailyCostUsd.toFixed(4)}` : '—'}
                                note="Today on this node"
                            />
                            <GCStatCard
                                label="Sessions"
                                value={d?.sessions?.length ?? '—'}
                                note="Tracked this node"
                            />
                        </View>
                    </FadeIn>
                )}

                {/* Attention Panel with glow */}
                <FadeIn delay={200}>
                    {d && d.pendingApprovals > 0 ? (
                        <GlowBorder color={colors.ember} intensity={0.5}
                            style={{ marginHorizontal: spacing.xl, marginBottom: spacing.lg }}>
                            <GCCard variant="warning" style={{ borderWidth: 0, margin: 0 }}>
                                <Text style={styles.sectionTitle}>WHAT NEEDS ATTENTION</Text>
                                <Text style={styles.sectionSubtitle}>
                                    Operator triage so you know what to do next.
                                </Text>
                                <Pressable
                                    style={styles.attentionRow}
                                    onPress={() => router.push('/(tabs)/approvals')}
                                >
                                    <PulseDot color={colors.ember} size={6} />
                                    <GCStatusChip tone="warning">Needs review</GCStatusChip>
                                    <Text style={styles.attentionText}>
                                        {d.pendingApprovals} approval{d.pendingApprovals !== 1 ? 's' : ''} waiting on you
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                                </Pressable>
                                {d.activeSubagents > 0 ? (
                                    <Pressable style={styles.attentionRow} onPress={() => router.push('/(tabs)/chat')}>
                                        <PulseDot color={colors.cyan} size={6} />
                                        <GCStatusChip tone="live">Live</GCStatusChip>
                                        <Text style={styles.attentionText}>
                                            {d.activeSubagents} sub-agent session{d.activeSubagents !== 1 ? 's' : ''} active
                                        </Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                                    </Pressable>
                                ) : null}
                            </GCCard>
                        </GlowBorder>
                    ) : (
                        <GCCard style={styles.section}>
                            <Text style={styles.sectionTitle}>WHAT NEEDS ATTENTION</Text>
                            <Text style={styles.sectionSubtitle}>
                                Operator triage so you know what to do next.
                            </Text>
                            <Text style={styles.noIssues}>
                                No urgent blockers detected. Use quick actions to move forward.
                            </Text>
                            {d && d.activeSubagents > 0 ? (
                                <Pressable style={styles.attentionRow} onPress={() => router.push('/(tabs)/chat')}>
                                    <PulseDot color={colors.cyan} size={6} />
                                    <GCStatusChip tone="live">Live</GCStatusChip>
                                    <Text style={styles.attentionText}>
                                        {d.activeSubagents} sub-agent session{d.activeSubagents !== 1 ? 's' : ''} active
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                                </Pressable>
                            ) : null}
                        </GCCard>
                    )}
                </FadeIn>

                {/* Quick Actions */}
                <FadeIn delay={300}>
                    <GCCard style={styles.section}>
                        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                        <View style={[styles.actionGrid, isTablet && styles.actionGridTablet]}>
                            <ActionButton icon="chatbubbles" label="Open Chat"
                                onPress={() => router.push('/(tabs)/chat')} />
                            <ActionButton icon="lock-closed" label="Approvals"
                                onPress={() => router.push('/(tabs)/approvals')} />
                            <ActionButton icon="people" label="Herd HQ"
                                onPress={() => router.push('/(tabs)/herd')} />
                            <ActionButton icon="search" label="⌘ Command"
                                onPress={toggleCommand} />
                            <ActionButton icon="wallet" label="Cost Tracker"
                                onPress={() => router.push('/(tabs)/costs' as any)} />
                            <ActionButton icon="heart-circle" label="Health"
                                onPress={() => router.push('/(tabs)/health' as any)} />
                            <ActionButton icon="settings-sharp" label="Settings"
                                onPress={() => router.push('/(tabs)/settings')} />
                        </View>
                    </GCCard>
                </FadeIn>

                {/* System Vitals */}
                {v ? (
                    <FadeIn delay={400}>
                        <GCCard style={styles.section}>
                            <View style={styles.vitalsTitleRow}>
                                <Text style={styles.sectionTitle}>CITADEL VITALS</Text>
                                <PulseDot color={colors.success} size={5} />
                            </View>
                            <Text style={styles.sectionSubtitle}>
                                {v.hostname} · {v.platform}
                            </Text>
                            <View style={styles.vitalsGrid}>
                                <VitalItem label="CPU cores" value={String(v.cpuCount)} icon="hardware-chip" />
                                <VitalItem label="Memory used" value={formatBytes(v.memoryUsedBytes)} icon="server" />
                                <VitalItem label="Process RSS" value={formatBytes(v.processRssBytes)} icon="analytics" />
                                <VitalItem label="Uptime" value={formatUptime(v.uptimeSeconds)} icon="time" />
                            </View>
                        </GCCard>
                    </FadeIn>
                ) : null}

                {/* Task Status Counts */}
                {d && d.taskStatusCounts.length > 0 ? (
                    <FadeIn delay={500}>
                        <GCCard style={styles.section}>
                            <Text style={styles.sectionTitle}>TRAILBOARD STATUS</Text>
                            <View style={styles.taskCountsGrid}>
                                {d.taskStatusCounts.map((row) => (
                                    <View key={row.status} style={styles.taskCountItem}>
                                        <AnimatedCounter value={row.count} style={styles.taskCountValue} />
                                        <Text style={styles.taskCountLabel}>{row.status}</Text>
                                    </View>
                                ))}
                            </View>
                        </GCCard>
                    </FadeIn>
                ) : null}

                {/* Recent Events */}
                {d && d.recentEvents.length > 0 ? (
                    <FadeIn delay={600}>
                        <GCCard style={styles.section}>
                            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
                            {d.recentEvents.slice(0, 5).map((event) => {
                                const meta = getRealtimeEventMeta(event);
                                return (
                                    <View key={event.eventId} style={styles.eventRow}>
                                        <View style={styles.eventDot} />
                                        <Text style={styles.eventType}>{meta.title}</Text>
                                        <Text style={styles.eventTime}>
                                            {new Date(event.timestamp).toLocaleTimeString()}
                                        </Text>
                                    </View>
                                );
                            })}
                        </GCCard>
                    </FadeIn>
                ) : null}

                <View style={{ height: 24 }} />
            </ScrollView>
        </View>
    );
}

/** Stat card with animated counter for numeric values */
const AnimatedStatCard = memo(function AnimatedStatCard({
    label, value, note, tone,
}: {
    label: string; value: number; note: string;
    tone: 'default' | 'accent' | 'warning' | 'critical';
}) {
    const valueColor =
        tone === 'warning' ? colors.ember :
            tone === 'critical' ? colors.crimson :
                tone === 'accent' ? colors.cyan :
                    colors.textPrimary;

    return (
        <View style={styles.statCard}>
            <View style={[styles.statAccent,
            tone === 'warning' && { backgroundColor: colors.ember },
            tone === 'critical' && { backgroundColor: colors.crimson },
            ]} />
            <Text style={styles.statLabel}>{label}</Text>
            <AnimatedCounter value={value} style={[styles.statValue, { color: valueColor }]} />
            <Text style={styles.statNote}>{note}</Text>
        </View>
    );
});

const ActionButton = memo(function ActionButton({
    icon, label, onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
}) {
    return (
        <Pressable style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={onPress}>
            <Ionicons name={icon} size={20} color={colors.cyan} />
            <Text style={styles.actionBtnText}>{label}</Text>
        </Pressable>
    );
});

const VitalItem = memo(function VitalItem({
    label, value, icon,
}: {
    label: string; value: string; icon: keyof typeof Ionicons.glyphMap;
}) {
    return (
        <View style={styles.vitalItem}>
            <View style={styles.vitalIcon}>
                <Ionicons name={icon} size={14} color={colors.cyan} />
            </View>
            <Text style={styles.vitalLabel}>{label}</Text>
            <Text style={styles.vitalValue}>{value}</Text>
        </View>
    );
});

function formatBytes(bytes: number): string {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}

function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${mins}m`;
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    scroll: { flex: 1 },
    content: { paddingBottom: 32 },
    errorCard: { marginHorizontal: spacing.xl, marginTop: spacing.md },
    errorText: { color: colors.crimson, ...typography.bodyMd, marginBottom: spacing.sm },

    kpiGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
        paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
    },
    kpiGridTablet: { gap: spacing.lg },
    kpiSkeleton: {
        backgroundColor: colors.bgCard, borderRadius: radii.md, borderWidth: 1,
        borderColor: colors.borderCyan, padding: spacing.lg, flex: 1, minWidth: 140,
        overflow: 'hidden',
    },

    // Animated stat card
    statCard: {
        backgroundColor: colors.bgCard, borderRadius: radii.md, borderWidth: 1,
        borderColor: colors.borderCyan, padding: spacing.lg, flex: 1, minWidth: 140,
        overflow: 'hidden',
    },
    statAccent: {
        position: 'absolute', top: 0, left: 0, width: '42%', height: 2,
        backgroundColor: colors.cyan, opacity: 0.7,
    },
    statLabel: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.xs },
    statValue: { ...typography.displayLg, color: colors.textPrimary },
    statNote: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },

    section: { marginHorizontal: spacing.xl, marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.xs },
    sectionSubtitle: { ...typography.bodySm, color: colors.textDim, marginBottom: spacing.md },

    vitalsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

    attentionRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderQuiet,
    },
    attentionText: { ...typography.bodyMd, color: colors.textSecondary, flex: 1 },
    noIssues: { ...typography.bodyMd, color: colors.textDim, fontStyle: 'italic' },

    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actionGridTablet: { gap: spacing.md },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.bgCard, borderRadius: radii.sm, borderWidth: 1,
        borderColor: colors.borderCyan, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    },
    actionBtnPressed: { opacity: 0.7, backgroundColor: colors.bgPanelSolid },
    actionBtnText: { ...typography.eyebrow, color: colors.textPrimary, fontSize: 11 },

    vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
    vitalItem: { minWidth: 100 },
    vitalIcon: { marginBottom: 2 },
    vitalLabel: { ...typography.caption, color: colors.textDim },
    vitalValue: { ...typography.displayMd, color: colors.textPrimary, fontSize: 18 },

    taskCountsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    taskCountItem: {
        backgroundColor: colors.bgInset, borderRadius: radii.sm,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 72, alignItems: 'center',
    },
    taskCountValue: { ...typography.displayMd, color: colors.textPrimary, fontSize: 20 },
    taskCountLabel: { ...typography.caption, color: colors.textDim, textTransform: 'capitalize' },

    eventRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.cyan, opacity: 0.5 },
    eventType: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
    eventTime: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },

    // Header button styles
    headerBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.bgCard, borderWidth: 1,
        borderColor: colors.borderCyan,
        alignItems: 'center' as const, justifyContent: 'center' as const,
        position: 'relative' as const,
    },
    badge: {
        position: 'absolute' as const, top: -4, right: -4,
        backgroundColor: colors.crimson, borderRadius: 10,
        minWidth: 18, height: 18, paddingHorizontal: 4,
        alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    badgeText: {
        color: '#fff', fontSize: 10, fontWeight: '700' as const,
    },
});
