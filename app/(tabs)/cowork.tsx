/**
 * GoatCitadel Mobile — Cowork Screen
 * Filters chat sessions to those with scope=mission and orchestration runs.
 * Honest about what this surface shows — it's session-filtered, not a
 * full orchestration dashboard.
 */
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';

export default function CoworkScreen() {
    const router = useRouter();
    const bottomPad = useBottomInsetPadding(32);
    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 10000 },
    );

    // Filter to mission-scope sessions that likely involve orchestration
    const all = sessions.data?.items ?? [];
    const missionSessions = all.filter(s => s.scope === 'mission');

    return (
        <View style={s.safe} >
            <GCHeader
                eyebrow="Sessions"
                title="Mission Sessions"
                subtitle={sessions.data
                    ? `${missionSessions.length} mission · ${all.length} total`
                    : 'Loading…'}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}
                refreshControl={
                    <RefreshControl refreshing={sessions.refreshing} onRefresh={sessions.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
            >
                {/* Stats */}
                {sessions.data ? (
                    <GCCard style={s.statsCard}>
                        <View style={s.statRow}>
                            <View style={s.stat}>
                                <Text style={s.statValue}>{missionSessions.length}</Text>
                                <Text style={s.statLabel}>Mission</Text>
                            </View>
                            <View style={s.stat}>
                                <Text style={[s.statValue, { color: colors.cyan }]}>{all.length}</Text>
                                <Text style={s.statLabel}>Total</Text>
                            </View>
                        </View>
                    </GCCard>
                ) : null}

                {/* Session list */}
                {sessions.error ? (
                    <GCCard>
                        <Text style={s.errorText}>Connection issue: {sessions.error}</Text>
                    </GCCard>
                ) : missionSessions.length === 0 && !sessions.loading ? (
                    <GCCard>
                        <View style={s.emptyState}>
                            <Ionicons name="git-branch-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>No mission-scope sessions found.</Text>
                            <Text style={s.emptySubtext}>
                                Start a session with Cowork mode from Chat.
                            </Text>
                        </View>
                    </GCCard>
                ) : (
                    missionSessions.slice(0, 10).map((session) => (
                        <GCCard key={session.sessionId} style={s.sessionCard}>
                            <View style={s.sessionTop}>
                                <Text style={s.sessionTitle} numberOfLines={1}>{session.title || 'Untitled'}</Text>
                                <GCStatusChip tone="live">{session.scope.toUpperCase()}</GCStatusChip>
                            </View>
                            {session.projectName ? (
                                <Text style={s.sessionProject}>{session.projectName}</Text>
                            ) : null}
                            <View style={s.sessionMeta}>
                                <Text style={s.sessionMetaText}>
                                    {session.tokenTotal.toLocaleString()} tokens · ${session.costUsdTotal.toFixed(4)}
                                </Text>
                                <Text style={s.sessionTime}>
                                    {new Date(session.lastActivityAt).toLocaleString()}
                                </Text>
                            </View>
                            <GCButton title="Open in Chat" variant="ghost" size="sm"
                                onPress={() => router.push(`/(tabs)/chat/${session.sessionId}`)} />
                        </GCCard>
                    ))
                )}

                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    statsCard: { marginBottom: spacing.lg },
    statRow: { flexDirection: 'row', gap: spacing.xl },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { ...typography.displayLg, color: colors.textPrimary },
    statLabel: { ...typography.caption, color: colors.textDim },
    sessionCard: { marginBottom: spacing.md },
    sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    sessionTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600', flex: 1, marginRight: spacing.sm },
    sessionProject: { ...typography.caption, color: colors.cyan, opacity: 0.7, marginBottom: 4 },
    sessionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    sessionMetaText: { ...typography.caption, color: colors.textDim },
    sessionTime: { ...typography.caption, color: colors.textDim },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { ...typography.bodyMd, color: colors.textMuted },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
    errorText: { ...typography.bodySm, color: colors.crimson },
});
