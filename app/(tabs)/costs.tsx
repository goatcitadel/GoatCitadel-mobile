/**
 * GoatCitadel Mobile — Cost Analytics Screen
 * Detailed cost breakdowns, trends, and budget visualization.
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    GCHeader, GCCard, GCStatCard, GCButton, GCStatusChip, FadeIn, AnimatedCounter,
} from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchChatSessions, fetchDashboard } from '../../src/api/client';
import type { ChatSessionRecord, DashboardState } from '../../src/api/types';

/** Simple horizontal bar chart row */
function CostBar({ label, value, maxValue, color }: {
    label: string; value: number; maxValue: number; color: string;
}) {
    const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
    return (
        <View style={s.barRow}>
            <Text style={s.barLabel} numberOfLines={1}>{label}</Text>
            <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={s.barValue}>${value.toFixed(4)}</Text>
        </View>
    );
}

/** Simple pie-chart-like stat display */
function CostRingCard({ label, value, total, color }: {
    label: string; value: number; total: number; color: string;
}) {
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
    return (
        <View style={s.ringCard}>
            <View style={[s.ringCircle, { borderColor: color }]}>
                <Text style={[s.ringPct, { color }]}>{pct}%</Text>
            </View>
            <Text style={s.ringLabel}>{label}</Text>
            <Text style={s.ringValue}>${value.toFixed(4)}</Text>
        </View>
    );
}

export default function CostScreen() {
    const router = useRouter();

    const dashboard = useApiData<DashboardState>(
        useCallback(() => fetchDashboard(), []),
        { pollMs: 30000 },
    );

    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 30000 },
    );

    const allSessions = sessions.data?.items ?? [];
    const totalCost = allSessions.reduce((sum, s) => sum + s.costUsdTotal, 0);
    const totalTokens = allSessions.reduce((sum, s) => sum + s.tokenTotal, 0);
    const dailyCost = dashboard.data?.dailyCostUsd ?? 0;

    // Top 5 sessions by cost
    const topSessions = useMemo(() =>
        [...allSessions].sort((a, b) => b.costUsdTotal - a.costUsdTotal).slice(0, 5),
        [allSessions]
    );
    const maxCost = topSessions[0]?.costUsdTotal ?? 0;

    // Cost by scope
    const missionCost = allSessions.filter(s => s.scope === 'mission')
        .reduce((sum, s) => sum + s.costUsdTotal, 0);
    const externalCost = allSessions.filter(s => s.scope === 'external')
        .reduce((sum, s) => sum + s.costUsdTotal, 0);

    // Budget levels
    const budgetTone = dailyCost > 1 ? 'critical' : dailyCost > 0.5 ? 'warning' : 'success';
    const budgetLabel = dailyCost > 1 ? 'HIGH SPEND' : dailyCost > 0.5 ? 'MODERATE' : 'ON TRACK';

    const onRefresh = useCallback(() => {
        dashboard.refresh();
        sessions.refresh();
    }, [dashboard, sessions]);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader
                eyebrow="Financial Analytics"
                title="Cost Tracker"
                subtitle="Token usage, spend analysis, and budget tracking"
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl
                        refreshing={dashboard.refreshing || sessions.refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                }
            >
                {/* KPI Cards */}
                <FadeIn delay={100}>
                    <View style={s.kpiRow}>
                        <GCStatCard label="Total Spend" value={`$${totalCost.toFixed(4)}`} note="All time" tone="default" />
                        <GCStatCard label="Today" value={`$${dailyCost.toFixed(4)}`} note="Daily spend" tone="default" />
                    </View>
                </FadeIn>

                <FadeIn delay={200}>
                    <View style={s.kpiRow}>
                        <GCStatCard label="Total Tokens" value={totalTokens.toLocaleString()} note="Input + output" tone="default" />
                        <GCStatCard label="Sessions" value={allSessions.length.toString()} note="All sessions" tone="default" />
                    </View>
                </FadeIn>

                {/* Budget Status */}
                <FadeIn delay={300}>
                    <GCCard style={s.section}>
                        <View style={s.budgetHeader}>
                            <Text style={s.sectionTitle}>BUDGET STATUS</Text>
                            <GCStatusChip tone={budgetTone as any}>{budgetLabel}</GCStatusChip>
                        </View>
                        <View style={s.budgetBar}>
                            <View style={s.budgetTrack}>
                                <View
                                    style={[
                                        s.budgetFill,
                                        {
                                            width: `${Math.min((dailyCost / 2) * 100, 100)}%`,
                                            backgroundColor: budgetTone === 'critical' ? colors.crimson
                                                : budgetTone === 'warning' ? colors.ember : colors.success,
                                        },
                                    ]}
                                />
                            </View>
                            <View style={s.budgetLabels}>
                                <Text style={s.budgetLabelText}>$0</Text>
                                <Text style={s.budgetLabelText}>$0.50</Text>
                                <Text style={s.budgetLabelText}>$1.00</Text>
                                <Text style={s.budgetLabelText}>$2.00</Text>
                            </View>
                        </View>
                    </GCCard>
                </FadeIn>

                {/* Cost by Scope */}
                <FadeIn delay={400}>
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>COST BY SCOPE</Text>
                        <View style={s.scopeRow}>
                            <CostRingCard label="Mission" value={missionCost} total={totalCost} color={colors.cyan} />
                            <CostRingCard label="External" value={externalCost} total={totalCost} color={colors.ember} />
                        </View>
                    </GCCard>
                </FadeIn>

                {/* Top Sessions by Cost */}
                <FadeIn delay={500}>
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>TOP SESSIONS BY COST</Text>
                        <Text style={s.sectionSubtitle}>Highest spend sessions</Text>
                        {topSessions.length === 0 ? (
                            <Text style={s.emptyText}>No session data available</Text>
                        ) : (
                            topSessions.map((session) => (
                                <CostBar
                                    key={session.sessionId}
                                    label={session.title || 'Untitled'}
                                    value={session.costUsdTotal}
                                    maxValue={maxCost}
                                    color={colors.cyan}
                                />
                            ))
                        )}
                    </GCCard>
                </FadeIn>

                {/* Cost Efficiency */}
                <FadeIn delay={600}>
                    <GCCard style={s.section}>
                        <Text style={s.sectionTitle}>EFFICIENCY METRICS</Text>
                        <View style={s.effRow}>
                            <View style={s.effItem}>
                                <Text style={s.effValue}>
                                    ${allSessions.length > 0 ? (totalCost / allSessions.length).toFixed(4) : '0.00'}
                                </Text>
                                <Text style={s.effLabel}>Avg per session</Text>
                            </View>
                            <View style={s.effItem}>
                                <Text style={s.effValue}>
                                    {totalTokens > 0 ? (totalCost / (totalTokens / 1000)).toFixed(6) : '0.00'}
                                </Text>
                                <Text style={s.effLabel}>$/1K tokens</Text>
                            </View>
                            <View style={s.effItem}>
                                <Text style={s.effValue}>
                                    {allSessions.length > 0 ? Math.round(totalTokens / allSessions.length).toLocaleString() : '0'}
                                </Text>
                                <Text style={s.effLabel}>Avg tokens/session</Text>
                            </View>
                        </View>
                    </GCCard>
                </FadeIn>

                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingBottom: 32 },
    kpiRow: {
        flexDirection: 'row', gap: spacing.md,
        paddingHorizontal: spacing.xl, marginBottom: spacing.md,
    },
    section: { marginHorizontal: spacing.xl, marginBottom: spacing.lg },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.xs },
    sectionSubtitle: { ...typography.caption, color: colors.textDim, marginBottom: spacing.md },
    emptyText: { ...typography.bodySm, color: colors.textDim, fontStyle: 'italic' },

    // Budget
    budgetHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.md,
    },
    budgetBar: { marginTop: spacing.sm },
    budgetTrack: {
        height: 8, backgroundColor: colors.bgInset, borderRadius: 4,
        overflow: 'hidden',
    },
    budgetFill: { height: '100%', borderRadius: 4 },
    budgetLabels: {
        flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs,
    },
    budgetLabelText: { ...typography.caption, color: colors.textDim, fontSize: 9 },

    // Scope rings
    scopeRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md },
    ringCard: { alignItems: 'center', gap: spacing.xs },
    ringCircle: {
        width: 64, height: 64, borderRadius: 32,
        borderWidth: 3, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.bgInset,
    },
    ringPct: { ...typography.displaySm, fontSize: 14 },
    ringLabel: { ...typography.eyebrow, color: colors.textMuted },
    ringValue: { ...typography.caption, color: colors.textDim },

    // Cost bars
    barRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet,
    },
    barLabel: { ...typography.caption, color: colors.textSecondary, width: 90 },
    barTrack: {
        flex: 1, height: 6, backgroundColor: colors.bgInset, borderRadius: 3,
        overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3 },
    barValue: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace', width: 60, textAlign: 'right' },

    // Efficiency
    effRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
    effItem: { alignItems: 'center', flex: 1 },
    effValue: { ...typography.displaySm, color: colors.textPrimary, fontSize: 14 },
    effLabel: { ...typography.caption, color: colors.textDim, textAlign: 'center', marginTop: 2 },
});
