/**
 * GoatCitadel Mobile — Cowork Screen
 * Filters mission sessions into a tablet-friendly operational board.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    AdaptiveContainer,
    ContextPane,
    MasterDetailShell,
    SectionGrid,
} from '../../src/components/layout';
import { GCHeader, GCStatusChip, GCButton, GCStatCard } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';
import { SessionDetailPane } from '../../src/features/chat/SessionDetailPane';

export default function CoworkScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 10000 },
    );

    const allSessions = sessions.data?.items ?? [];
    const missionSessions = useMemo(
        () => [...allSessions]
            .filter((session) => session.scope === 'mission')
            .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()),
        [allSessions],
    );
    const activeMissionSessions = missionSessions.filter((session) => {
        const minutes = (Date.now() - new Date(session.lastActivityAt).getTime()) / 60000;
        return minutes < 60;
    });
    const selectedSession = missionSessions.find((session) => session.sessionId === selectedSessionId) ?? missionSessions[0];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (missionSessions.length > 0 && !selectedSessionId) {
            setSelectedSessionId(missionSessions[0].sessionId);
        } else if (selectedSessionId && !missionSessions.some((session) => session.sessionId === selectedSessionId)) {
            setSelectedSessionId(missionSessions[0]?.sessionId);
        }
    }, [layout.dualPane, missionSessions, selectedSessionId]);

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlatList
                data={missionSessions}
                keyExtractor={(item) => item.sessionId}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && selectedSession?.sessionId === item.sessionId;
                    return (
                        <Pressable
                            style={({ pressed }) => [
                                styles.row,
                                selected && styles.rowSelected,
                                pressed && styles.rowPressed,
                            ]}
                            onPress={() => {
                                if (layout.dualPane) {
                                    setSelectedSessionId(item.sessionId);
                                    return;
                                }
                                router.push(`/(tabs)/chat/${item.sessionId}`);
                            }}
                        >
                            <View style={styles.rowIcon}>
                                <Ionicons name="git-branch-outline" size={18} color={colors.cyan} />
                            </View>
                            <View style={styles.rowContent}>
                                <View style={styles.rowHeader}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>
                                        {item.title || 'Untitled mission'}
                                    </Text>
                                    <GCStatusChip tone="warning">MISSION</GCStatusChip>
                                </View>
                                {item.projectName ? (
                                    <Text style={styles.rowProject}>{item.projectName}</Text>
                                ) : null}
                                <View style={styles.rowMeta}>
                                    <Text style={styles.rowMetaText}>{item.tokenTotal.toLocaleString()} tokens</Text>
                                    <Text style={styles.rowMetaText}>${item.costUsdTotal.toFixed(4)}</Text>
                                    <Text style={styles.rowMetaText}>{new Date(item.lastActivityAt).toLocaleString()}</Text>
                                </View>
                            </View>
                        </Pressable>
                    );
                }}
                refreshControl={(
                    <RefreshControl
                        refreshing={sessions.refreshing}
                        onRefresh={sessions.refresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                )}
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={(
                    <View style={styles.emptyState}>
                        <Ionicons name="git-branch-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>No mission-scope sessions found.</Text>
                        <Text style={styles.emptySubtext}>
                            Start a Cowork session from Chat to stage multi-step work here.
                        </Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Sessions"
                title="Mission Sessions"
                subtitle={sessions.data ? `${missionSessions.length} mission · ${allSessions.length} total` : 'Loading…'}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                <SectionGrid style={styles.kpiGrid} minItemWidthPhone={140} minItemWidthTablet={220}>
                    <GCStatCard label="Mission" value={String(missionSessions.length)} tone="default" />
                    <GCStatCard label="Active hour" value={String(activeMissionSessions.length)} tone="default" />
                    <GCStatCard
                        label="Spend"
                        value={`$${missionSessions.reduce((sum, session) => sum + session.costUsdTotal, 0).toFixed(4)}`}
                        tone="default"
                    />
                </SectionGrid>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <SessionDetailPane
                                heading="Mission detail"
                                session={selectedSession}
                                primaryLabel="Open mission thread"
                                emptyBody="Pick a mission session to keep cost, context, and project scope visible while you coordinate."
                                onOpen={(session) => router.push(`/(tabs)/chat/${session.sessionId}`)}
                            />
                        )}
                    />
                ) : listComponent}
            </AdaptiveContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
    kpiGrid: { marginBottom: spacing.md },
    shell: { flex: 1 },
    listPane: { flex: 1, padding: 0, overflow: 'hidden' },
    list: { paddingVertical: spacing.sm },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowSelected: { backgroundColor: colors.cyanMuted },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    rowIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgInset,
    },
    rowContent: { flex: 1, minWidth: 0 },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginBottom: 4,
    },
    rowTitle: {
        ...typography.bodyMd,
        color: colors.textPrimary,
        fontWeight: '600',
        flex: 1,
    },
    rowProject: { ...typography.caption, color: colors.cyan, marginBottom: 4 },
    rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    rowMetaText: { ...typography.caption, color: colors.textDim },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { ...typography.bodyMd, color: colors.textMuted },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
});
