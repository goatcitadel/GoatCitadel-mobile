/**
 * GoatCitadel Mobile — MCP Servers Screen
 * Real connect/disconnect controls matching desktop McpPage.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    AdaptiveContainer,
    ContextPane,
    MasterDetailShell,
} from '../../src/components/layout';
import { GCHeader, GCStatusChip, GCButton } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useApiData } from '../../src/hooks/useApiData';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { connectMcpServer, disconnectMcpServer, fetchMcpServers } from '../../src/api/client';
import type { McpServerRecord } from '../../src/api/types';

export default function McpScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [selectedServerId, setSelectedServerId] = useState<string | undefined>(undefined);
    const mcp = useApiData<{ items: McpServerRecord[] }>(
        useCallback(() => fetchMcpServers(), []),
    );
    const items = mcp.data?.items ?? [];
    const connected = items.filter((server) => server.status === 'connected');
    const selectedServer = items.find((server) => server.serverId === selectedServerId) ?? items[0];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (items.length > 0 && !selectedServerId) {
            setSelectedServerId(items[0].serverId);
        } else if (selectedServerId && !items.some((server) => server.serverId === selectedServerId)) {
            setSelectedServerId(items[0]?.serverId);
        }
    }, [items, layout.dualPane, selectedServerId]);

    const toggleConnection = async (server: McpServerRecord) => {
        setBusyId(server.serverId);
        try {
            if (server.status === 'connected') {
                await disconnectMcpServer(server.serverId);
            } else {
                await connectMcpServer(server.serverId);
            }
            await mcp.refresh();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setBusyId(null);
        }
    };

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlatList
                data={items}
                keyExtractor={(item) => item.serverId}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && item.serverId === selectedServer?.serverId;
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
                            onPress={() => {
                                if (layout.dualPane) {
                                    setSelectedServerId(item.serverId);
                                    return;
                                }
                                void toggleConnection(item);
                            }}
                            disabled={busyId === item.serverId}
                        >
                            <View style={[styles.icon, item.status !== 'connected' && styles.iconOff]}>
                                <Ionicons
                                    name={busyId === item.serverId ? 'sync' : item.status === 'connected' ? 'radio-button-on' : 'radio-button-off'}
                                    size={16}
                                    color={item.status === 'connected' ? '#f472b6' : colors.textDim}
                                />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={styles.rowLabel}>{item.label}</Text>
                                <Text style={styles.rowTransport}>
                                    {item.transport} · {item.authType} auth
                                    {item.trustTier ? ` · ${item.trustTier}` : ''}
                                    {item.category ? ` · ${item.category}` : ''}
                                </Text>
                                {item.lastError ? (
                                    <Text style={styles.errorText} numberOfLines={1}>{item.lastError}</Text>
                                ) : null}
                            </View>
                            <GCStatusChip tone={item.status === 'connected' ? 'success' : item.status === 'error' ? 'critical' : 'muted'}>
                                {item.status.toUpperCase()}
                            </GCStatusChip>
                        </Pressable>
                    );
                }}
                refreshControl={(
                    <RefreshControl
                        refreshing={mcp.refreshing}
                        onRefresh={mcp.refresh}
                        tintColor={colors.cyan}
                        colors={[colors.cyan]}
                        progressBackgroundColor={colors.bgCard}
                    />
                )}
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={(
                    <View style={styles.empty}>
                        <Ionicons name="server-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>{mcp.error || 'No MCP servers configured.'}</Text>
                        <Text style={styles.emptySubtext}>Add MCP servers from Mission Control on desktop.</Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Tool Gateways"
                title="MCP Servers"
                subtitle={`${connected.length} connected · ${items.length} total`}
                right={<GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />}
            />

            <AdaptiveContainer style={styles.content}>
                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <ContextPane style={styles.detailPane}>
                                <View style={styles.detailHeader}>
                                    <Text style={styles.sectionTitle}>SERVER DETAIL</Text>
                                    {selectedServer ? (
                                        <GCStatusChip tone={selectedServer.status === 'connected' ? 'success' : selectedServer.status === 'error' ? 'critical' : 'muted'}>
                                            {selectedServer.status.toUpperCase()}
                                        </GCStatusChip>
                                    ) : null}
                                </View>
                                {selectedServer ? (
                                    <>
                                        <Text style={styles.detailTitle}>{selectedServer.label}</Text>
                                        <View style={styles.metaGrid}>
                                            <MetaStat label="Transport" value={selectedServer.transport} />
                                            <MetaStat label="Auth" value={selectedServer.authType} />
                                            <MetaStat label="Trust" value={selectedServer.trustTier || 'n/a'} />
                                            <MetaStat label="Category" value={selectedServer.category || 'n/a'} />
                                        </View>
                                        {selectedServer.lastError ? (
                                            <Text style={styles.errorDetail}>{selectedServer.lastError}</Text>
                                        ) : (
                                            <Text style={styles.detailCopy}>
                                                Connection state, trust, and auth stay visible here while the full MCP roster remains in view.
                                            </Text>
                                        )}
                                        <GCButton
                                            title={busyId === selectedServer.serverId
                                                ? 'Working…'
                                                : selectedServer.status === 'connected'
                                                    ? 'Disconnect'
                                                    : 'Connect'}
                                            onPress={() => void toggleConnection(selectedServer)}
                                            variant={selectedServer.status === 'connected' ? 'secondary' : 'primary'}
                                            size="sm"
                                            disabled={busyId === selectedServer.serverId}
                                        />
                                    </>
                                ) : (
                                    <View style={styles.emptyDetail}>
                                        <Ionicons name="server-outline" size={34} color={colors.textDim} />
                                        <Text style={styles.emptyDetailTitle}>Select a server</Text>
                                        <Text style={styles.emptyDetailText}>
                                            Tablet keeps connection state and trust context visible while you scan the full server list.
                                        </Text>
                                    </View>
                                )}
                            </ContextPane>
                        )}
                    />
                ) : listComponent}
            </AdaptiveContainer>
        </View>
    );
}

function MetaStat({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.metaStat}>
            <Text style={styles.metaStatLabel}>{label}</Text>
            <Text style={styles.metaStatValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
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
    icon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(244,114,182,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconOff: { backgroundColor: colors.statusMutedBg },
    rowContent: { flex: 1, minWidth: 0 },
    rowLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
    rowTransport: { ...typography.caption, color: colors.textDim, fontFamily: 'monospace' },
    errorText: { ...typography.caption, color: colors.crimson, marginTop: 2 },
    detailPane: { gap: spacing.lg },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
    },
    sectionTitle: { ...typography.eyebrow, color: colors.textPrimary },
    detailTitle: { ...typography.displayMd, color: colors.textPrimary },
    detailCopy: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 22 },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metaStat: {
        minWidth: 120,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.sm,
        gap: 2,
    },
    metaStatLabel: { ...typography.caption, color: colors.textDim },
    metaStatValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
    errorDetail: { ...typography.bodySm, color: colors.crimson },
    empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
    emptyText: { ...typography.bodyMd, color: colors.textDim },
    emptySubtext: { ...typography.caption, color: colors.textDim, textAlign: 'center', maxWidth: 240 },
    emptyDetail: {
        minHeight: 220,
        backgroundColor: colors.bgInset,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    emptyDetailTitle: { ...typography.displaySm, color: colors.textPrimary, textAlign: 'center' },
    emptyDetailText: { ...typography.bodySm, color: colors.textDim, textAlign: 'center' },
});
