/**
 * GoatCitadel Mobile — Sessions Screen (run history & costs)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveContainer, ContextPane, MasterDetailShell, SectionGrid } from '../../src/components/layout';
import { GCHeader, GCStatCard, GCButton } from '../../src/components/ui';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { fetchChatSessions } from '../../src/api/client';
import type { ChatSessionRecord } from '../../src/api/types';
import { SessionDetailPane } from '../../src/features/chat/SessionDetailPane';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';

export default function SessionsScreen() {
    const router = useRouter();
    const layout = useLayout();
    const [search, setSearch] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
    const bottomPad = useBottomInsetPadding(32);
    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 15000 },
    );
    const all = sessions.data?.items ?? [];
    const filtered = useMemo(() => all.filter((session) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (session.title || '').toLowerCase().includes(q) || session.sessionId.includes(q);
    }), [all, search]);
    const sorted = useMemo(() => [...filtered].sort((a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()), [filtered]);
    const totalCost = all.reduce((sum, session) => sum + session.costUsdTotal, 0);
    const totalTokens = all.reduce((sum, session) => sum + session.tokenTotal, 0);
    const selectedSession = sorted.find((item) => item.sessionId === selectedSessionId) ?? sorted[0];

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

    const renderRow = ({ item }: { item: ChatSessionRecord }) => {
        const selected = selectedSession?.sessionId === item.sessionId;
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.row,
                    selected && layout.dualPane && styles.rowSelected,
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
                <View style={styles.rowContent}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                    <View style={styles.rowMeta}>
                        <Text style={styles.rowCost}>${item.costUsdTotal.toFixed(4)}</Text>
                        <Text style={styles.rowTokens}>{item.tokenTotal.toLocaleString()} tok</Text>
                        <Text style={styles.rowTime}>
                            {new Date(item.lastActivityAt).toLocaleDateString()}
                        </Text>
                    </View>
                </View>
                <Ionicons
                    name={layout.dualPane ? 'chevron-forward-circle' : 'chevron-forward'}
                    size={16}
                    color={selected ? colors.cyan : colors.textDim}
                />
            </Pressable>
        );
    };

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlatList
                data={sorted}
                keyExtractor={(item) => item.sessionId}
                renderItem={renderRow}
                refreshControl={
                    <RefreshControl
                        refreshing={sessions.refreshing}
                        onRefresh={sessions.refresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                }
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={(
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>{sessions.error || 'No sessions found.'}</Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Operations"
                title="Sessions"
                subtitle={`${all.length} total sessions`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                <SectionGrid style={styles.kpiGrid} minItemWidthPhone={120} minItemWidthTablet={220}>
                    <GCStatCard label="Total cost" value={`$${totalCost.toFixed(4)}`} tone="default" />
                    <GCStatCard label="Total tokens" value={totalTokens.toLocaleString()} tone="default" />
                </SectionGrid>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={16} color={colors.textDim} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Filter sessions…"
                        placeholderTextColor={colors.textDim}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <SessionDetailPane
                                heading="Session summary"
                                session={selectedSession}
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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.bgInput,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    searchInput: { flex: 1, color: colors.textPrimary, ...typography.bodyMd, paddingVertical: 0 },
    shell: { flex: 1 },
    listPane: { flex: 1, padding: 0, overflow: 'hidden' },
    list: { paddingVertical: spacing.sm },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowSelected: {
        backgroundColor: colors.cyanMuted,
    },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    rowContent: { flex: 1 },
    rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowMeta: { flexDirection: 'row', gap: spacing.md, marginTop: 2, flexWrap: 'wrap' },
    rowCost: { ...typography.caption, color: colors.ember },
    rowTokens: { ...typography.caption, color: colors.textDim },
    rowTime: { ...typography.caption, color: colors.textDim },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
});
