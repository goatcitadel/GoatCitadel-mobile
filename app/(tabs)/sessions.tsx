/**
 * GoatCitadel Mobile — Sessions Screen (run history & costs)
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCButton, GCStatCard } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';

export default function SessionsScreen() {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 15000 },
    );
    const all = sessions.data?.items ?? [];
    const filtered = all.filter(s => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (s.title || '').toLowerCase().includes(q) || s.sessionId.includes(q);
    });
    const sorted = [...filtered].sort((a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
    const totalCost = all.reduce((sum, s) => sum + s.costUsdTotal, 0);
    const totalTokens = all.reduce((sum, s) => sum + s.tokenTotal, 0);

    return (
        <View style={s.safe} >
            <GCHeader eyebrow="Operations" title="Sessions"
                subtitle={`${all.length} total sessions`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />} />

            {/* Cost Summary */}
            <View style={s.kpiRow}>
                <GCStatCard label="Total cost" value={`$${totalCost.toFixed(4)}`} tone="default" />
                <GCStatCard label="Total tokens" value={totalTokens.toLocaleString()} tone="default" />
            </View>

            {/* Search */}
            <View style={s.searchBar}>
                <Ionicons name="search" size={16} color={colors.textDim} />
                <TextInput style={s.searchInput} placeholder="Filter sessions…"
                    placeholderTextColor={colors.textDim} value={search} onChangeText={setSearch} />
            </View>

            <FlatList data={sorted} keyExtractor={i => i.sessionId}
                renderItem={({ item }) => (
                    <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                        onPress={() => router.push(`/(tabs)/chat/${item.sessionId}`)}>
                        <View style={s.rowContent}>
                            <Text style={s.rowTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                            <View style={s.rowMeta}>
                                <Text style={s.rowCost}>${item.costUsdTotal.toFixed(4)}</Text>
                                <Text style={s.rowTokens}>{item.tokenTotal.toLocaleString()} tok</Text>
                                <Text style={s.rowTime}>
                                    {new Date(item.lastActivityAt).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                    </Pressable>
                )}
                refreshControl={
                    <RefreshControl refreshing={sessions.refreshing} onRefresh={sessions.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
                contentContainerStyle={s.list}
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Text style={s.emptyText}>{sessions.error || 'No sessions found.'}</Text>
                    </View>
                }
            />
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    kpiRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        marginHorizontal: spacing.xl, marginBottom: spacing.md, paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm, backgroundColor: colors.bgInput, borderRadius: radii.sm,
        borderWidth: 1, borderColor: colors.borderCyan,
    },
    searchInput: { flex: 1, color: colors.textPrimary, ...typography.bodyMd, paddingVertical: 0 },
    list: { paddingBottom: 32 },
    row: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    rowContent: { flex: 1 },
    rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowMeta: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
    rowCost: { ...typography.caption, color: colors.ember },
    rowTokens: { ...typography.caption, color: colors.textDim },
    rowTime: { ...typography.caption, color: colors.textDim },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
});
