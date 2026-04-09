/**
 * GoatCitadel Mobile — Code Screen
 * Shows project-aware sessions in a tablet-friendly list/detail shell.
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
import { colors, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';
import { SessionDetailPane } from '../../src/features/chat/SessionDetailPane';

export default function CodeScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 15000 },
    );

    const items = sessions.data?.items ?? [];
    const projectSessions = useMemo(
        () => [...items]
            .filter((session) => session.projectName)
            .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()),
        [items],
    );
    const displayItems = projectSessions.length > 0 ? projectSessions : [...items].sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
    );
    const selectedSession = displayItems.find((session) => session.sessionId === selectedSessionId) ?? displayItems[0];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (displayItems.length > 0 && !selectedSessionId) {
            setSelectedSessionId(displayItems[0].sessionId);
        } else if (selectedSessionId && !displayItems.some((session) => session.sessionId === selectedSessionId)) {
            setSelectedSessionId(displayItems[0]?.sessionId);
        }
    }, [displayItems, layout.dualPane, selectedSessionId]);

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlatList
                data={displayItems}
                keyExtractor={(item) => item.sessionId}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && selectedSession?.sessionId === item.sessionId;
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                            onPress={() => {
                                if (layout.dualPane) {
                                    setSelectedSessionId(item.sessionId);
                                    return;
                                }
                                router.push(`/(tabs)/chat/${item.sessionId}`);
                            }}
                        >
                            <View style={styles.rowContent}>
                                <View style={styles.rowHeader}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>
                                        {item.title || 'Untitled'}
                                    </Text>
                                    {item.projectName ? (
                                        <GCStatusChip tone="live">{item.projectName}</GCStatusChip>
                                    ) : null}
                                </View>
                                <View style={styles.rowMeta}>
                                    <Text style={styles.rowMetaText}>{item.tokenTotal.toLocaleString()} tokens</Text>
                                    <Text style={styles.rowMetaText}>${item.costUsdTotal.toFixed(4)}</Text>
                                    <Text style={styles.rowMetaText}>{new Date(item.lastActivityAt).toLocaleString()}</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={selected ? colors.cyan : colors.textDim} />
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
                        <Ionicons name="code-slash-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>No code sessions found.</Text>
                        <Text style={styles.emptySubtext}>
                            Start a Code-mode session from Chat to keep project context within reach.
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
                title="Code Sessions"
                subtitle={sessions.data ? `${projectSessions.length} with projects · ${items.length} total` : 'Loading…'}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                <SectionGrid style={styles.kpiGrid} minItemWidthPhone={140} minItemWidthTablet={220}>
                    <GCStatCard label="Project sessions" value={String(projectSessions.length)} tone="default" />
                    <GCStatCard
                        label="Spend"
                        value={`$${displayItems.reduce((sum, session) => sum + session.costUsdTotal, 0).toFixed(4)}`}
                        tone="default"
                    />
                    <GCStatCard
                        label="Tokens"
                        value={displayItems.reduce((sum, session) => sum + session.tokenTotal, 0).toLocaleString()}
                        tone="default"
                    />
                </SectionGrid>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <SessionDetailPane
                                heading="Code session"
                                session={selectedSession}
                                primaryLabel="Open code thread"
                                emptyBody="Tablet keeps the project, cost, and last activity visible so you can triage which coding thread to enter."
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
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowSelected: { backgroundColor: colors.cyanMuted },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
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
    rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    rowMetaText: { ...typography.caption, color: colors.textDim },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { ...typography.bodyMd, color: colors.textMuted },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
});
