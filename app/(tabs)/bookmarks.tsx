/**
 * GoatCitadel Mobile — Bookmarks Screen
 * Save, organize, and quickly access favorite sessions and resources.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    AdaptiveContainer,
    ContextPane,
    MasterDetailShell,
    SectionGrid,
} from '../../src/components/layout';
import { GCHeader, GCButton, GCStatCard } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';
import { SessionDetailPane } from '../../src/features/chat/SessionDetailPane';

type BookmarkFilter = 'all' | 'pinned' | 'recent';

export default function BookmarksScreen() {
    const router = useRouter();
    const layout = useLayout();
    const [filter, setFilter] = useState<BookmarkFilter>('all');
    const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
    const bottomPad = useBottomInsetPadding(32);

    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 30000 },
    );

    const allSessions = sessions.data?.items ?? [];
    const pinnedSessions = useMemo(
        () => allSessions.filter((session) => session.pinned),
        [allSessions],
    );
    const recentSessions = useMemo(() => {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return allSessions.filter((session) => new Date(session.lastActivityAt).getTime() > cutoff);
    }, [allSessions]);

    const sorted = useMemo(() => {
        const displaySessions = filter === 'pinned'
            ? pinnedSessions
            : filter === 'recent'
                ? recentSessions
                : allSessions;

        return [...displaySessions].sort(
            (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
        );
    }, [allSessions, filter, pinnedSessions, recentSessions]);

    const selectedSession = sorted.find((session) => session.sessionId === selectedSessionId) ?? sorted[0];
    const filters: { label: string; value: BookmarkFilter; count: number }[] = [
        { label: 'All', value: 'all', count: allSessions.length },
        { label: 'Pinned', value: 'pinned', count: pinnedSessions.length },
        { label: 'Recent', value: 'recent', count: recentSessions.length },
    ];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (sorted.length > 0 && !selectedSessionId) {
            setSelectedSessionId(sorted[0].sessionId);
        } else if (selectedSessionId && !sorted.some((item) => item.sessionId === selectedSessionId)) {
            setSelectedSessionId(sorted[0]?.sessionId);
        }
    }, [layout.dualPane, selectedSessionId, sorted]);

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlashList
                data={sorted}
                keyExtractor={(item) => item.sessionId}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && item.sessionId === selectedSession?.sessionId;
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
                            <View style={styles.bookmarkIcon}>
                                <Ionicons
                                    name={item.pinned ? 'bookmark' : 'bookmark-outline'}
                                    size={18}
                                    color={item.pinned ? colors.ember : colors.textDim}
                                />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={styles.rowTitle} numberOfLines={1}>
                                    {item.title || 'Untitled Session'}
                                </Text>
                                <View style={styles.rowMeta}>
                                    {item.projectName ? (
                                        <Text style={styles.rowProject}>{item.projectName}</Text>
                                    ) : null}
                                    <Text style={styles.rowCost}>${item.costUsdTotal.toFixed(4)}</Text>
                                    <Text style={styles.rowTime}>{getRelativeTime(item.lastActivityAt)}</Text>
                                </View>
                            </View>
                            {item.pinned ? (
                                <Ionicons name="pin" size={12} color={colors.ember} style={styles.pinIcon} />
                            ) : null}
                            <Ionicons name="chevron-forward" size={14} color={selected ? colors.cyan : colors.textDim} />
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
                removeClippedSubviews
                ListEmptyComponent={(
                    <View style={styles.empty}>
                        <Ionicons name="bookmarks-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>No bookmarks found</Text>
                        <Text style={styles.emptySubtext}>
                            Pin sessions in Chat to keep them close.
                        </Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Quick Access"
                title="Bookmarks"
                subtitle={`${pinnedSessions.length} pinned · ${allSessions.length} total`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                <SectionGrid style={styles.kpiGrid} minItemWidthPhone={140} minItemWidthTablet={220}>
                    <GCStatCard label="Pinned" value={String(pinnedSessions.length)} tone="default" />
                    <GCStatCard label="Recent" value={String(recentSessions.length)} tone="default" />
                    <GCStatCard label="All sessions" value={String(allSessions.length)} tone="default" />
                </SectionGrid>

                <View style={styles.filterRow}>
                    {filters.map((item) => (
                        <Pressable
                            key={item.value}
                            style={[styles.filterTab, filter === item.value && styles.filterTabActive]}
                            onPress={() => setFilter(item.value)}
                        >
                            <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
                                {item.label}
                            </Text>
                            <View style={[styles.filterBadge, filter === item.value && styles.filterBadgeActive]}>
                                <Text style={[styles.filterBadgeText, filter === item.value && styles.filterBadgeTextActive]}>
                                    {item.count}
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                </View>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <SessionDetailPane
                                heading="Saved session"
                                session={selectedSession}
                                emptyTitle="Choose a bookmark"
                                emptyBody="Pinned sessions stay visible on tablet so you can compare cost, timing, and scope before you jump in."
                                onOpen={(session) => router.push(`/(tabs)/chat/${session.sessionId}`)}
                            />
                        )}
                    />
                ) : listComponent}
            </AdaptiveContainer>
        </View>
    );
}

function getRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
    kpiGrid: { marginBottom: spacing.md },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        backgroundColor: colors.bgCard,
    },
    filterTabActive: {
        borderColor: colors.cyan,
        backgroundColor: colors.cyanMuted,
    },
    filterText: { ...typography.bodySm, color: colors.textDim },
    filterTextActive: { color: colors.cyan, fontWeight: '600' },
    filterBadge: {
        backgroundColor: colors.bgInset,
        borderRadius: radii.pill,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    filterBadgeActive: { backgroundColor: colors.cyan },
    filterBadgeText: { ...typography.caption, color: colors.textDim, fontSize: 10 },
    filterBadgeTextActive: { color: colors.bgCore },
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
    bookmarkIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.bgInset,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContent: { flex: 1, minWidth: 0 },
    rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: 2, flexWrap: 'wrap' },
    rowProject: { ...typography.caption, color: colors.cyan, opacity: 0.7 },
    rowCost: { ...typography.caption, color: colors.ember },
    rowTime: { ...typography.caption, color: colors.textDim },
    pinIcon: { marginRight: 4 },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: spacing.sm,
    },
    emptyText: { ...typography.displaySm, color: colors.textMuted },
    emptySubtext: { ...typography.bodySm, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
});
