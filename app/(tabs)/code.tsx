/**
 * GoatCitadel Mobile — Code Screen
 * Shows recent chat sessions. Honest about scope — this is a session
 * list filtered for context, not a full code review surface.
 */
import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCCard, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme/tokens';
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
    // Show sessions that have project context (likely code-related)
    const projectSessions = items.filter(s => s.projectName);
    const displayItems = projectSessions.length > 0 ? projectSessions : items;

    return (
        <View style={s.safe} >
            <GCHeader
                eyebrow="Sessions"
                title="Code Sessions"
                subtitle={sessions.data
                    ? `${projectSessions.length} with projects · ${items.length} total`
                    : 'Loading…'}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />
            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={
                    <RefreshControl refreshing={sessions.refreshing} onRefresh={sessions.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
            >
                {/* Session list */}
                {sessions.error ? (
                    <GCCard>
                        <Text style={s.errorText}>Connection issue: {sessions.error}</Text>
                    </GCCard>
                ) : displayItems.length === 0 && !sessions.loading ? (
                    <GCCard>
                        <View style={s.emptyState}>
                            <Ionicons name="code-slash-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>No code sessions found.</Text>
                            <Text style={s.emptySubtext}>
                                Start a Code-mode session from Chat to see it here.
                            </Text>
                        </View>
                    </GCCard>
                ) : (
                    displayItems.slice(0, 10).map((session) => (
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
                                <Text style={s.sessionTime}>
                                    {new Date(session.lastActivityAt).toLocaleString()}
                                </Text>
                            </View>
                            <GCButton title="Open" variant="ghost" size="sm"
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
    sessionCard: { marginBottom: spacing.md },
    sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    sessionTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600', flex: 1, marginRight: spacing.sm },
    sessionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    sessionMetaText: { ...typography.caption, color: colors.textDim },
    sessionTime: { ...typography.caption, color: colors.textDim },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { ...typography.bodyMd, color: colors.textMuted },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
    errorText: { ...typography.bodySm, color: colors.crimson },
});
