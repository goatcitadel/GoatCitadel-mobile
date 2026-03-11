/**
 * GoatCitadel Mobile — MCP Servers Screen
 */
import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { fetchMcpServers } from '../../src/api/client';
import type { McpServerRecord } from '../../src/api/types';

export default function McpScreen() {
    const router = useRouter();
    const mcp = useApiData<{ items: McpServerRecord[] }>(
        useCallback(() => fetchMcpServers(), []),
    );
    const items = mcp.data?.items ?? [];
    const connected = items.filter(s => s.status === 'connected');

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <GCHeader eyebrow="Tool Gateways" title="MCP Servers"
                subtitle={`${connected.length} connected · ${items.length} total`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />} />
            <FlatList data={items} keyExtractor={i => i.serverId}
                renderItem={({ item }) => (
                    <View style={s.row}>
                        <View style={[s.icon, item.status !== 'connected' && s.iconErr]}>
                            <Ionicons name="server" size={16}
                                color={item.status === 'connected' ? '#f472b6' : colors.textDim} />
                        </View>
                        <View style={s.rowContent}>
                            <Text style={s.rowLabel}>{item.label}</Text>
                            <Text style={s.rowTransport}>{item.transport} · {item.toolCount} tools</Text>
                        </View>
                        <GCStatusChip
                            tone={item.status === 'connected' ? 'success' : item.status === 'error' ? 'critical' : 'muted'}>
                            {item.status.toUpperCase()}
                        </GCStatusChip>
                    </View>
                )}
                refreshControl={
                    <RefreshControl refreshing={mcp.refreshing} onRefresh={mcp.refresh}
                        tintColor={colors.cyan} colors={[colors.cyan]} progressBackgroundColor={colors.bgCard} />
                }
                contentContainerStyle={s.list}
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Ionicons name="server-outline" size={48} color={colors.textDim} />
                        <Text style={s.emptyText}>{mcp.error || 'No MCP servers configured.'}</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    list: { paddingBottom: 32 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderQuiet,
    },
    icon: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(244,114,182,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    iconErr: { backgroundColor: colors.statusMutedBg },
    rowContent: { flex: 1 },
    rowLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowTransport: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
});
