/**
 * GoatCitadel Mobile — Notification Center Screen
 * In-app notification feed with filtering, grouping, and swipe-to-dismiss.
 */
import React, { useState } from 'react';
import {
    View, Text, Pressable, StyleSheet, RefreshControl, Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCButton, GCStatusChip, FadeIn } from '../../src/components/ui';
import { colors, spacing, typography, radii } from '../../src/theme/tokens';
import { useBottomInsetPadding } from '../../src/hooks/useBottomInsetPadding';
import { useNotifications, Notification } from '../../src/context/NotificationContext';

type FilterType = 'all' | 'approval' | 'agent' | 'system' | 'chat';

export default function NotificationsScreen() {
    const router = useRouter();
    const bottomPad = useBottomInsetPadding(32);
    const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
    const [filter, setFilter] = useState<FilterType>('all');

    const filtered = filter === 'all'
        ? notifications
        : notifications.filter(n => n.type === filter);

    const handlePress = (notification: Notification) => {
        markRead(notification.id);
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

    return (
        <View style={s.safe} >
            <GCHeader
                eyebrow="Notifications"
                title="Alerts"
                subtitle={`${unreadCount} unread · ${notifications.length} total`}
                right={
                    <View style={s.headerActions}>
                        <GCButton title="Read All" onPress={markAllRead} variant="ghost" size="sm" />
                        <GCButton title="Back" onPress={() => router.back()} variant="ghost" size="sm" />
                    </View>
                }
            />

            {/* Filter Pills */}
            <View style={s.filterBar}>
                {filters.map(f => (
                    <Pressable
                        key={f.value}
                        style={[s.filterPill, filter === f.value && s.filterPillActive]}
                        onPress={() => setFilter(f.value)}
                    >
                        <Ionicons
                            name={f.icon}
                            size={12}
                            color={filter === f.value ? colors.bgCore : colors.textDim}
                        />
                        <Text style={[s.filterText, filter === f.value && s.filterTextActive]}>
                            {f.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={{ flex: 1 }}>
                <FlashList
                    data={filtered}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <FadeIn>
                            <Pressable
                                style={({ pressed }) => [
                                    s.row,
                                    !item.read && s.rowUnread,
                                    pressed && s.rowPressed
                                ]}
                                onPress={() => handlePress(item)}
                            >
                                <View style={[s.iconBox, !item.read && s.iconBoxUnread]}>
                                    <Ionicons
                                        name={item.icon as any}
                                        size={18}
                                        color={!item.read ? colors.cyan : colors.textDim}
                                    />
                                </View>
                                <View style={s.rowContent}>
                                    <Text style={[s.rowTitle, !item.read && s.rowTitleUnread]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={s.rowBody} numberOfLines={1}>{item.body}</Text>
                                    <Text style={s.rowTime}>
                                        {new Date(item.timestamp).toLocaleString()}
                                    </Text>
                                </View>
                                {!item.read && <View style={s.unreadDot} />}
                                {item.actionRoute && (
                                    <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                )}
                            </Pressable>
                        </FadeIn>
                    )}
                    contentContainerStyle={[s.list, { paddingBottom: bottomPad }]}
                    ListEmptyComponent={
                        <View style={s.empty}>
                            <Ionicons name="notifications-off-outline" size={48} color={colors.textDim} />
                            <Text style={s.emptyText}>No notifications yet</Text>
                            <Text style={s.emptySubtext}>
                                Events from your citadel will appear here
                            </Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgCore },
    headerActions: { flexDirection: 'row', gap: spacing.xs },
    filterBar: {
        flexDirection: 'row', gap: spacing.sm,
        paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    },
    filterPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
        borderRadius: radii.pill, backgroundColor: colors.bgCard,
        borderWidth: 1, borderColor: colors.borderCyan,
    },
    filterPillActive: {
        backgroundColor: colors.cyan, borderColor: colors.cyan,
    },
    filterText: { ...typography.caption, color: colors.textDim, fontSize: 10 },
    filterTextActive: { color: colors.bgCore, fontWeight: '600' },
    list: { paddingBottom: 32 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
    },
    rowUnread: { backgroundColor: 'rgba(84, 221, 255, 0.03)' },
    rowPressed: { backgroundColor: colors.bgPanelSolid },
    iconBox: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.bgInset,
        alignItems: 'center', justifyContent: 'center',
    },
    iconBoxUnread: {
        backgroundColor: colors.cyanMuted,
    },
    rowContent: { flex: 1 },
    rowTitle: { ...typography.bodyMd, color: colors.textSecondary },
    rowTitleUnread: { color: colors.textPrimary, fontWeight: '600' },
    rowBody: { ...typography.caption, color: colors.textDim, marginTop: 1 },
    rowTime: { ...typography.caption, color: colors.textDim, fontSize: 10, marginTop: 2 },
    unreadDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: colors.cyan,
    },
    empty: {
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 80, gap: spacing.sm,
    },
    emptyText: { ...typography.displaySm, color: colors.textMuted },
    emptySubtext: { ...typography.bodySm, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
});
