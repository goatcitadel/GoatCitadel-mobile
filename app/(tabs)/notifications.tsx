/**
 * GoatCitadel Mobile — Notification Center Screen
 * In-app notification feed with filtering and tablet detail context.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
    Pressable,
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
} from '../../src/components/layout';
import { GCHeader, GCButton, GCStatusChip } from '../../src/components/ui';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useLayout } from '../../src/hooks/useLayout';
import { useNotifications, Notification } from '../../src/context/NotificationContext';

type FilterType = 'all' | 'approval' | 'agent' | 'system' | 'chat';

export default function NotificationsScreen() {
    const router = useRouter();
    const layout = useLayout();
    const bottomPad = useBottomInsetPadding(32);
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
    const [filter, setFilter] = useState<FilterType>('all');
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

    const filtered = useMemo(
        () => filter === 'all'
            ? notifications
            : notifications.filter((notification) => notification.type === filter),
        [filter, notifications],
    );
    const selectedNotification = filtered.find((notification) => notification.id === selectedId) ?? filtered[0];

    useEffect(() => {
        if (!layout.dualPane) {
            return;
        }
        if (filtered.length > 0 && !selectedId) {
            setSelectedId(filtered[0].id);
        } else if (selectedId && !filtered.some((item) => item.id === selectedId)) {
            setSelectedId(filtered[0]?.id);
        }
    }, [filtered, layout.dualPane, selectedId]);

    const handlePress = (notification: Notification) => {
        markRead(notification.id);
        if (layout.dualPane) {
            setSelectedId(notification.id);
            return;
        }
        if (notification.actionRoute) {
            router.push(notification.actionRoute as any);
        }
    };

    const filters: { label: string; value: FilterType; icon: keyof typeof Ionicons.glyphMap }[] = [
        { label: 'All', value: 'all', icon: 'notifications' },
        { label: 'Approvals', value: 'approval', icon: 'lock-closed' },
        { label: 'Agents', value: 'agent', icon: 'people' },
        { label: 'System', value: 'system', icon: 'pulse' },
        { label: 'Chat', value: 'chat', icon: 'chatbubble' },
    ];

    const listComponent = (
        <ContextPane style={styles.listPane}>
            <FlashList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const selected = layout.dualPane && item.id === selectedNotification?.id;
                    return (
                        <Pressable
                            style={({ pressed }) => [
                                styles.row,
                                !item.read && styles.rowUnread,
                                selected && styles.rowSelected,
                                pressed && styles.rowPressed,
                            ]}
                            onPress={() => handlePress(item)}
                        >
                            <View style={[styles.iconBox, !item.read && styles.iconBoxUnread]}>
                                <Ionicons
                                    name={item.icon as any}
                                    size={18}
                                    color={!item.read ? colors.cyan : colors.textDim}
                                />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={1}>
                                    {item.title}
                                </Text>
                                <Text style={styles.rowBody} numberOfLines={1}>{item.body}</Text>
                                <Text style={styles.rowTime}>{new Date(item.timestamp).toLocaleString()}</Text>
                            </View>
                            {!item.read ? <View style={styles.unreadDot} /> : null}
                            {item.actionRoute ? (
                                <Ionicons name="chevron-forward" size={14} color={selected ? colors.cyan : colors.textDim} />
                            ) : null}
                        </Pressable>
                    );
                }}
                contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
                ListEmptyComponent={(
                    <View style={styles.empty}>
                        <Ionicons name="notifications-off-outline" size={48} color={colors.textDim} />
                        <Text style={styles.emptyText}>No notifications yet</Text>
                        <Text style={styles.emptySubtext}>Events from your citadel will appear here.</Text>
                    </View>
                )}
            />
        </ContextPane>
    );

    return (
        <View style={styles.safe}>
            <GCHeader
                eyebrow="Notifications"
                title="Alerts"
                subtitle={`${unreadCount} unread · ${notifications.length} total`}
                right={(
                    <View style={styles.headerActions}>
                        <GCButton title="Read All" onPress={markAllRead} variant="ghost" size="sm" />
                        <GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />
                    </View>
                )}
            />

            <AdaptiveContainer style={styles.content}>
                <View style={styles.filterBar}>
                    {filters.map((item) => (
                        <Pressable
                            key={item.value}
                            style={[styles.filterPill, filter === item.value && styles.filterPillActive]}
                            onPress={() => setFilter(item.value)}
                        >
                            <Ionicons
                                name={item.icon}
                                size={12}
                                color={filter === item.value ? colors.bgCore : colors.textDim}
                            />
                            <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
                                {item.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {layout.dualPane ? (
                    <MasterDetailShell
                        style={styles.shell}
                        master={listComponent}
                        detail={(
                            <ContextPane style={styles.detailPane}>
                                <View style={styles.detailHeader}>
                                    <Text style={styles.sectionTitle}>NOTIFICATION DETAIL</Text>
                                    <GCStatusChip tone={unreadCount > 0 ? 'warning' : 'success'}>
                                        {unreadCount > 0 ? `${unreadCount} UNREAD` : 'CAUGHT UP'}
                                    </GCStatusChip>
                                </View>
                                {selectedNotification ? (
                                    <>
                                        <Text style={styles.detailTitle}>{selectedNotification.title}</Text>
                                        <Text style={styles.detailBody}>{selectedNotification.body}</Text>
                                        <View style={styles.detailMeta}>
                                            <MetaPill label="Type" value={selectedNotification.type.toUpperCase()} />
                                            <MetaPill label="Time" value={new Date(selectedNotification.timestamp).toLocaleString()} />
                                            <MetaPill label="State" value={selectedNotification.read ? 'READ' : 'UNREAD'} />
                                        </View>
                                        {selectedNotification.actionRoute ? (
                                            <GCButton
                                                title="Open destination"
                                                onPress={() => router.push(selectedNotification.actionRoute as any)}
                                                variant="primary"
                                                size="sm"
                                            />
                                        ) : null}
                                    </>
                                ) : (
                                    <View style={styles.emptyDetail}>
                                        <Ionicons name="notifications-outline" size={34} color={colors.textDim} />
                                        <Text style={styles.emptyDetailTitle}>Select a notification</Text>
                                        <Text style={styles.emptyDetailText}>
                                            Tablet keeps the feed visible while the selected alert stays expanded beside it.
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

function MetaPill({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.metaPill}>
            <Text style={styles.metaPillLabel}>{label}</Text>
            <Text style={styles.metaPillValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    content: { flex: 1, paddingBottom: spacing.lg },
    headerActions: { flexDirection: 'row', gap: spacing.xs },
    filterBar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radii.pill,
        backgroundColor: colors.bgCard,
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    filterPillActive: { backgroundColor: colors.cyan, borderColor: colors.cyan },
    filterText: { ...typography.caption, color: colors.textDim, fontSize: 10 },
    filterTextActive: { color: colors.bgCore, fontWeight: '600' },
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
    rowUnread: { backgroundColor: 'rgba(84, 221, 255, 0.03)' },
    rowSelected: { backgroundColor: colors.cyanMuted },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.bgInset,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBoxUnread: { backgroundColor: colors.cyanMuted },
    rowContent: { flex: 1, minWidth: 0 },
    rowTitle: { ...typography.bodyMd, color: colors.textSecondary },
    rowTitleUnread: { color: colors.textPrimary, fontWeight: '600' },
    rowBody: { ...typography.caption, color: colors.textDim, marginTop: 1 },
    rowTime: { ...typography.caption, color: colors.textDim, fontSize: 10, marginTop: 2 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan },
    detailPane: { gap: spacing.lg },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
    },
    sectionTitle: { ...typography.eyebrow, color: colors.textPrimary },
    detailTitle: { ...typography.displayMd, color: colors.textPrimary },
    detailBody: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 22 },
    detailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metaPill: {
        minWidth: 120,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.sm,
        gap: 2,
    },
    metaPillLabel: { ...typography.caption, color: colors.textDim },
    metaPillValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: spacing.sm,
    },
    emptyText: { ...typography.displaySm, color: colors.textMuted },
    emptySubtext: { ...typography.bodySm, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
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
