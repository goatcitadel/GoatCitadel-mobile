/**
 * GoatCitadel Mobile — Bookmarks Screen
 * Save, organize, and quickly access favorite sessions and resources.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCButton, GCStatusChip, FadeIn, GCCard } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';

type BookmarkFilter = 'all' | 'pinned' | 'recent';

export default function BookmarksScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState<BookmarkFilter>('all');

    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 30000 },
    );

    const allSessions = sessions.data?.items ?? [];
    const pinnedSessions = allSessions.filter(s => s.pinned);

    // Recent = last 7 days
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentSessions = allSessions.filter(s =>
        new Date(s.lastActivityAt).getTime() > recentCutoff
    );

    const displaySessions = filter === 'pinned' ? pinnedSessions
        : filter === 'recent' ? recentSessions : allSessions;

    const sorted = [...displaySessions].sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );

    const filters: { label: string; value: BookmarkFilter; count: number }[] = [
        { label: 'All', value: 'all', count: allSessions.length },
        { label: 'Pinned', value: 'pinned', count: pinnedSessions.length },
        { label: 'Recent', value: 'recent', count: recentSessions.length },
    ];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader
                eyebrow="Quick Access"
                title="Bookmarks"
                subtitle={`${pinnedSessions.length} pinned · ${allSessions.length} total`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            {/* Filter tabs */}
            <View style={s.filterRow}>
                {filters.map(f => (
                    <Pressable
                        key={f.value}
                        style={[s.filterTab, filter === f.value && s.filterTabActive]}
                        onPress={() => setFilter(f.value)}
                    >
                        <Text style={[s.filterText, filter === f.value && s.filterTextActive]}>
                            {f.label}
                        </Text>
                        <View style={[s.filterBadge, filter === f.value && s.filterBadgeActive]}>
                            <Text style={[s.filterBadgeText, filter === f.value && s.filterBadgeTextActive]}>
                                {f.count}
                            </Text>
                        </View>
                    </Pressable>
                ))}
            </View>

            <View style={{ flex: 1 }}>
                <FlashList
                    data={sorted}
                    keyExtractor={item => item.sessionId}
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                            onPress={() => router.push(`/(tabs)/chat/${item.sessionId}`)}
                        >
                            <View style={s.bookmarkIcon}>
                                <Ionicons
                                    name={item.pinned ? 'bookmark' : 'bookmark-outline'}
                                    size={18}
                                    color={item.pinned ? colors.ember : colors.textDim}
                                />
                            </View>
                            <View style={s.rowContent}>
                                <Text style={s.rowTitle} numberOfLines={1}>
                                    {item.title || 'Untitled Session'}
                                </Text>
                                <View style={s.rowMeta}>
                                    {item.projectName && (
                                        <Text style={s.rowProject}>{item.projectName}</Text>
                                    )}
                                    <Text style={s.rowCost}>${item.costUsdTotal.toFixed(4)}</Text>
                                    <Text style={s.rowTime}>
                                        {getRelativeTime(item.lastActivityAt)}
                                    </Text>
                                </View>
                            </View>
                            {item.pinned && (
                                <Ionicons name="pin" size={12} color={colors.ember} style={{ marginRight: 4 }} />
                            )}
                            <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                        </Pressable>
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={sessions.refreshing}
                            onRefresh={sessions.refresh}
                            tintColor={colors.cyan}
                            colors={[colors.cyan]}
                            progressBackgroundColor={colors.bgCard}
                        />
                    }
                    contentContainerStyle={s.list}
                    ListEmptyComponent={
                        <View style={s.empty}>
                            <Ionicons name="bookmarks-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>No bookmarks found</Text>
                            <Text style={s.emptySubtext}>
                                Pin sessions in Chat to see them here
                            </Text>
                        </View>
                    }
                />
            </View>
        </SafeAreaView>
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

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    filterRow: {
        flexDirection: 'row', gap: spacing.sm,
        paddingHorizontal: spacing.xl, marginBottom: spacing.md,
    },
    filterTab: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radii.sm, borderWidth: 1,
        borderColor: colors.borderQuiet, backgroundColor: colors.bgCard,
    },
    filterTabActive: {
        borderColor: colors.cyan, backgroundColor: colors.cyanMuted,
    },
    filterText: { ...typography.bodySm, color: colors.textDim },
    filterTextActive: { color: colors.cyan, fontWeight: '600' },
    filterBadge: {
        backgroundColor: colors.bgInset, borderRadius: radii.pill,
        paddingHorizontal: 6, paddingVertical: 1,
    },
    filterBadgeActive: { backgroundColor: colors.cyan },
    filterBadgeText: { ...typography.caption, color: colors.textDim, fontSize: 10 },
    filterBadgeTextActive: { color: colors.bgCore },
    list: { paddingBottom: 32 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    bookmarkIcon: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.bgInset,
        alignItems: 'center', justifyContent: 'center',
    },
    rowContent: { flex: 1 },
    rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
    rowProject: { ...typography.caption, color: colors.cyan, opacity: 0.7 },
    rowCost: { ...typography.caption, color: colors.ember },
    rowTime: { ...typography.caption, color: colors.textDim },
    empty: {
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 80, gap: spacing.sm,
    },
    emptyText: { ...typography.displaySm, color: colors.textMuted },
    emptySubtext: { ...typography.bodySm, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
});
