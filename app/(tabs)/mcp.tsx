/**
 * GoatCitadel Mobile — MCP Servers Screen
 * Real connect/disconnect controls matching desktop McpPage.
 * Shows trust tier, category, and allows toggling server connections.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { fetchMcpServers, connectMcpServer, disconnectMcpServer } from '../../src/api/client';
import type { McpServerRecord } from '../../src/api/types';

export default function McpScreen() {
    const router = useRouter();
    const bottomPad = useBottomInsetPadding(32);
    const [busyId, setBusyId] = useState<string | null>(null);
    const mcp = useApiData<{ items: McpServerRecord[] }>(
        useCallback(() => fetchMcpServers(), []),
    );
    const items = mcp.data?.items ?? [];
    const connected = items.filter(s => s.status === 'connected');

    const toggleConnection = async (server: McpServerRecord) => {
        setBusyId(server.serverId);
        try {
            if (server.status === 'connected') {
                await disconnectMcpServer(server.serverId);
            } else {
                await connectMcpServer(server.serverId);
            }
            await mcp.refresh();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <View style={s.safe} >
            <GCHeader eyebrow="Tool Gateways" title="MCP Servers"
                subtitle={`${connected.length} connected · ${items.length} total`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />} />
            <FlatList data={items} keyExtractor={i => i.serverId}
                renderItem={({ item }) => (
                    <View style={s.row}>
                        <Pressable
                            style={s.connectBtn}
                            onPress={() => toggleConnection(item)}
                            disabled={busyId === item.serverId}
                        >
                            <View style={[s.icon, item.status !== 'connected' && s.iconOff]}>
                                <Ionicons
                                    name={busyId === item.serverId ? 'sync' : item.status === 'connected' ? 'radio-button-on' : 'radio-button-off'}
                                    size={16}
                                    color={item.status === 'connected' ? '#f472b6' : colors.textDim}
                                />
                            </View>
                        </Pressable>
                        <View style={s.rowContent}>
                            <Text style={s.rowLabel}>{item.label}</Text>
                            <Text style={s.rowTransport}>
                                {item.transport} · {item.authType} auth
                                {item.trustTier ? ` · ${item.trustTier}` : ''}
                                {item.category ? ` · ${item.category}` : ''}
                            </Text>
                            {item.lastError ? (
                                <Text style={s.errorText} numberOfLines={1}>{item.lastError}</Text>
                            ) : null}
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
                contentContainerStyle={[s.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Ionicons name="server-outline" size={48} color={colors.textDim} />
                        <Text style={s.emptyText}>{mcp.error || 'No MCP servers configured.'}</Text>
                        <Text style={s.emptySubtext}>
                            Add MCP servers from Mission Control on desktop.
                        </Text>
                    </View>
                }
            />
        </View>
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
    connectBtn: { padding: 4 },
    icon: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(244,114,182,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    iconOff: { backgroundColor: colors.statusMutedBg },
    rowContent: { flex: 1 },
    rowLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowTransport: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    errorText: { ...typography.caption, color: colors.crimson, marginTop: 2 },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
});
