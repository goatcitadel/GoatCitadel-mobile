/**
 * GoatCitadel Mobile — Cowork Screen
 * Collaborative delegation monitoring — shows active orchestration runs.
 */
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';

export default function CoworkScreen() {
    const router = useRouter();
    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 10000 },
    );

    // Filter to cowork-relevant sessions (scope: mission, with active delegations)
    const items = sessions.data?.items ?? [];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader
                eyebrow="Cowork Mode"
                title="Delegations"
                subtitle="Active collaborative AI workflows and orchestration runs"
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl refreshing={sessions.refreshing} onRefresh={sessions.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
            >
                {/* Overview Card */}
                <GCCard style={s.overview}>
                    <View style={s.overviewRow}>
                        <View style={s.overviewStat}>
                            <Text style={s.overviewValue}>{items.length}</Text>
                            <Text style={s.overviewLabel}>Total Sessions</Text>
                        </View>
                        <View style={s.overviewStat}>
                            <Text style={[s.overviewValue, { color: colors.cyan }]}>
                                {items.filter(i => i.scope === 'mission').length}
                            </Text>
                            <Text style={s.overviewLabel}>Mission Scope</Text>
                        </View>
                    </View>
                </GCCard>

                {/* How Cowork Works */}
                <GCCard style={s.infoCard}>
                    <View style={s.infoIcon}>
                        <Ionicons name="git-branch" size={24} color={colors.ember} />
                    </View>
                    <Text style={s.infoTitle}>COLLABORATIVE DELEGATION</Text>
                    <Text style={s.infoDesc}>
                        In Cowork mode, GoatCitadel orchestrates multi-step workflows by delegating tasks to
                        specialized agent roles. Each step has a clear objective, role assignment, and status.
                    </Text>
                    <View style={s.infoBullets}>
                        <InfoBullet icon="construct" text="Architect plans the approach" color={colors.cyan} />
                        <InfoBullet icon="code-slash" text="Coder implements changes" color={colors.success} />
                        <InfoBullet icon="bug" text="QA validates the outcome" color={colors.ember} />
                        <InfoBullet icon="search" text="Researcher gathers context" color="#a78bfa" />
                    </View>
                </GCCard>

                {/* Active Sessions in Cowork */}
                <Text style={s.sectionTitle}>RECENT SESSIONS</Text>
                {items.length === 0 ? (
                    <GCCard>
                        <Text style={s.emptyText}>
                            {sessions.error
                                ? `Connection issue: ${sessions.error}`
                                : 'No active sessions. Start a Cowork session from Chat.'}
                        </Text>
                    </GCCard>
                ) : (
                    items.slice(0, 8).map((session) => (
                        <GCCard key={session.sessionId} style={s.sessionCard}>
                            <View style={s.sessionTop}>
                                <Text style={s.sessionTitle} numberOfLines={1}>{session.title || 'Untitled'}</Text>
                                <GCStatusChip tone="live">
                                    {session.scope.toUpperCase()}
                                </GCStatusChip>
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
        </SafeAreaView>
    );
}

function InfoBullet({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
    return (
        <View style={s.bullet}>
            <Ionicons name={icon} size={14} color={color} />
            <Text style={s.bulletText}>{text}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    overview: { marginBottom: spacing.lg },
    overviewRow: { flexDirection: 'row', gap: spacing.xl },
    overviewStat: { flex: 1, alignItems: 'center' },
    overviewValue: { ...typography.displayLg, color: colors.textPrimary },
    overviewLabel: { ...typography.caption, color: colors.textDim },
    infoCard: { marginBottom: spacing.lg },
    infoIcon: { marginBottom: spacing.sm },
    infoTitle: { ...typography.eyebrow, color: colors.ember, marginBottom: spacing.xs },
    infoDesc: { ...typography.bodyMd, color: colors.textMuted, marginBottom: spacing.md },
    infoBullets: { gap: spacing.sm },
    bullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    bulletText: { ...typography.bodySm, color: colors.textSecondary },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.md, marginTop: spacing.sm },
    sessionCard: { marginBottom: spacing.md },
    sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    sessionTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600', flex: 1, marginRight: spacing.sm },
    sessionProject: { ...typography.caption, color: colors.cyan, opacity: 0.7, marginBottom: 4 },
    sessionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    sessionMetaText: { ...typography.caption, color: colors.textDim },
    sessionTime: { ...typography.caption, color: colors.textDim },
    emptyText: { ...typography.bodyMd, color: colors.textDim, fontStyle: 'italic' },
});
