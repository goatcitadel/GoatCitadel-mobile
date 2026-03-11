/**
 * GoatCitadel Mobile — Code Screen
 * Software workflow monitoring — plans, diffs, QA, traces.
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

export default function CodeScreen() {
    const router = useRouter();
    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 15000 },
    );
    const items = sessions.data?.items ?? [];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader
                eyebrow="Code Mode"
                title="Software Monitor"
                subtitle="Plans, diffs, QA outcomes, and trace summaries"
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl refreshing={sessions.refreshing} onRefresh={sessions.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
            >
                {/* Code Mode Overview */}
                <GCCard style={s.infoCard}>
                    <View style={s.infoIcon}>
                        <Ionicons name="code-slash" size={24} color={colors.success} />
                    </View>
                    <Text style={s.infoTitle}>SOFTWARE WORKFLOW</Text>
                    <Text style={s.infoDesc}>
                        Code mode is optimized for monitoring and steering software development workflows.
                        View plans, diff summaries, reviewer notes, QA outcomes, and execution traces.
                    </Text>
                    <View style={s.phaseGrid}>
                        <PhaseCard icon="document-text" label="Plan" desc="Structured approach" color={colors.cyan} />
                        <PhaseCard icon="git-compare" label="Diff" desc="Code changes" color={colors.ember} />
                        <PhaseCard icon="eye" label="Review" desc="Reviewer notes" color="#a78bfa" />
                        <PhaseCard icon="checkmark-done" label="QA" desc="Test outcomes" color={colors.success} />
                    </View>
                </GCCard>

                {/* Recent Code Sessions */}
                <Text style={s.sectionTitle}>RECENT SESSIONS</Text>
                {items.length === 0 ? (
                    <GCCard>
                        <Text style={s.emptyText}>
                            {sessions.error
                                ? `Connection issue: ${sessions.error}`
                                : 'No sessions. Start a Code session from Chat by switching to Code mode.'}
                        </Text>
                    </GCCard>
                ) : (
                    items.slice(0, 6).map((session) => (
                        <GCCard key={session.sessionId} style={s.sessionCard}>
                            <View style={s.sessionTop}>
                                <Text style={s.sessionTitle} numberOfLines={1}>
                                    {session.title || 'Untitled'}
                                </Text>
                                {session.projectName ? (
                                    <GCStatusChip tone="live">{session.projectName}</GCStatusChip>
                                ) : null}
                            </View>
                            <View style={s.sessionMeta}>
                                <Text style={s.sessionMetaText}>
                                    {session.tokenTotal.toLocaleString()} tokens · ${session.costUsdTotal.toFixed(4)}
                                </Text>
                            </View>
                            <GCButton title="Open" variant="ghost" size="sm"
                                onPress={() => router.push(`/(tabs)/chat/${session.sessionId}`)} />
                        </GCCard>
                    ))
                )}
                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function PhaseCard({ icon, label, desc, color }: {
    icon: keyof typeof Ionicons.glyphMap; label: string; desc: string; color: string;
}) {
    return (
        <View style={s.phase}>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={[s.phaseLabel, { color }]}>{label}</Text>
            <Text style={s.phaseDesc}>{desc}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
    infoCard: { marginBottom: spacing.lg },
    infoIcon: { marginBottom: spacing.sm },
    infoTitle: { ...typography.eyebrow, color: colors.success, marginBottom: spacing.xs },
    infoDesc: { ...typography.bodyMd, color: colors.textMuted, marginBottom: spacing.lg },
    phaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    phase: {
        width: '47%', backgroundColor: colors.bgInset, borderRadius: radii.sm,
        padding: spacing.md, alignItems: 'center', gap: 4,
    },
    phaseLabel: { ...typography.eyebrow, fontSize: 10 },
    phaseDesc: { ...typography.caption, color: colors.textDim, textAlign: 'center' },
    sectionTitle: { ...typography.eyebrow, color: colors.textMuted, marginBottom: spacing.md },
    sessionCard: { marginBottom: spacing.md },
    sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    sessionTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600', flex: 1, marginRight: spacing.sm },
    sessionMeta: { marginBottom: spacing.sm },
    sessionMetaText: { ...typography.caption, color: colors.textDim },
    emptyText: { ...typography.bodyMd, color: colors.textDim, fontStyle: 'italic' },
});
