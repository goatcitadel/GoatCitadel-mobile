/**
 * GoatCitadel Mobile — Chat Session List
 */
import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    RefreshControl,
    Animated,
    Alert,
    Platform,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { useToast } from '../../../src/context/ToastContext';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { GCHeader, GCButton } from '../../../src/components/ui';
import { colors, spacing, typography, radii } from '../../../src/theme/tokens';
import { useApiData } from '../../../src/hooks/useApiData';
import { fetchChatSessions, createChatSession, deleteChatSession } from '../../../src/api/client';
import type { ChatSessionRecord } from '../../../src/api/types';

export default function ChatSessionListScreen() {
    const router = useRouter();
    const [search, setSearch] = useState('');

    const sessions = useApiData<{ items: ChatSessionRecord[] }>(
        useCallback(() => fetchChatSessions(), []),
        { pollMs: 10000 },
    );

    const filtered = (sessions.data?.items ?? []).filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (s.title ?? '').toLowerCase().includes(q) ||
            s.sessionId.toLowerCase().includes(q) ||
            (s.projectName ?? '').toLowerCase().includes(q)
        );
    });

    const sorted = [...filtered].sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
    );

    const handleNewSession = async () => {
        try {
            const session = await createChatSession();
            router.push(`/(tabs)/chat/${session.sessionId}`);
        } catch {
            // fallback - just navigate to chat with a placeholder
        }
    };

    return (
        <View style={styles.safe} >
            <GCHeader
                eyebrow="Chat Workspace"
                title="Sessions"
                subtitle={`${sessions.data?.items.length ?? 0} sessions`}
                right={
                    <GCButton title="+ New" onPress={handleNewSession} variant="primary" size="sm" />
                }
            />

            {/* Search */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color={colors.textDim} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search sessions…"
                    placeholderTextColor={colors.textDim}
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                />
                {search ? (
                    <Pressable onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color={colors.textDim} />
                    </Pressable>
                ) : null}
            </View>

            <View style={{ flex: 1 }}>
                <FlashList
                    data={sorted}
                    keyExtractor={(item) => item.sessionId}
                    renderItem={({ item }) => (
                        <MemoizedSessionRow
                            session={item}
                            onPress={() => router.push(`/(tabs)/chat/${item.sessionId}`)}
                            onDelete={sessions.refresh}
                        />
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
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        sessions.loading ? null : (
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textDim} />
                                <Text style={styles.emptyText}>
                                    {sessions.error ? sessions.error : 'No sessions yet. Start a new chat.'}
                                </Text>
                            </View>
                        )
                    }
                />
            </View>
        </View>
    );
}

function SessionRow({
    session,
    onPress,
    onDelete,
}: {
    session: ChatSessionRecord;
    onPress: () => void;
    onDelete: () => void;
}) {
    const timeAgo = getRelativeTime(session.lastActivityAt);
    const { showToast } = useToast();

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [0, 0, 20], extrapolate: 'clamp' });
        const opacity = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [1, 1, 0], extrapolate: 'clamp' });
        return (
            <Animated.View style={[styles.actionDelete, { opacity, transform: [{ translateX: trans }] }]}>
                <Ionicons name="trash-outline" size={24} color={colors.bgCore} />
                <Text style={styles.actionText}>DELETE</Text>
            </Animated.View>
        );
    };

    const handleSwipeableOpen = async (direction: 'left' | 'right') => {
        if (direction === 'right') {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
                await deleteChatSession(session.sessionId);
                showToast({ message: 'Session deleted', type: 'success' });
                onDelete();
            } catch (err: any) {
                showToast({ message: `Failed to delete: ${err.message}`, type: 'error' });
            }
        }
    };

    return (
        <Swipeable
            renderRightActions={renderRightActions}
            onSwipeableOpen={handleSwipeableOpen}
            friction={2}
            rightThreshold={40}
        >
            <Pressable
                style={({ pressed }) => [styles.sessionRow, pressed && styles.sessionRowPressed]}
                onPress={onPress}
            >
                <View style={styles.sessionIcon}>
                    <Ionicons
                        name={session.scope === 'external' ? 'globe-outline' : 'chatbubble'}
                        size={18}
                        color={colors.cyan}
                    />
                </View>
                <View style={styles.sessionContent}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                        {session.title || 'Untitled session'}
                    </Text>
                    <View style={styles.sessionMeta}>
                        {session.projectName ? (
                            <Text style={styles.sessionProject}>{session.projectName}</Text>
                        ) : null}
                        <Text style={styles.sessionTime}>{timeAgo}</Text>
                    </View>
                </View>
                {session.pinned ? (
                    <Ionicons name="pin" size={14} color={colors.ember} style={{ marginRight: 4 }} />
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </Pressable>
        </Swipeable>
    );
}

const MemoizedSessionRow = React.memo(SessionRow, (prev, next) => {
    return prev.session.sessionId === next.session.sessionId &&
        prev.session.lastActivityAt === next.session.lastActivityAt &&
        prev.session.pinned === next.session.pinned &&
        prev.session.title === next.session.title;
});

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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.bgInput,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderCyan,
    },
    searchInput: {
        flex: 1,
        color: colors.textPrimary,
        ...typography.bodyMd,
        paddingVertical: 0,
    },
    listContent: { paddingBottom: 32 },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.borderQuiet,
        gap: spacing.md,
    },
    sessionRowPressed: { backgroundColor: colors.bgPanelSolid },
    sessionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.cyanMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sessionContent: { flex: 1 },
    sessionTitle: {
        ...typography.bodyMd,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    sessionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: 2,
    },
    sessionProject: {
        ...typography.caption,
        color: colors.cyan,
        opacity: 0.7,
    },
    sessionTime: { ...typography.caption, color: colors.textDim },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: spacing.md,
    },
    emptyText: { ...typography.bodyMd, color: colors.textDim, textAlign: 'center', maxWidth: 260 },
    actionDelete: {
        flex: 1, backgroundColor: colors.crimson, justifyContent: 'center', alignItems: 'flex-end',
        paddingRight: spacing.xl,
    },
    actionText: {
        ...typography.eyebrow, color: colors.bgCore, marginTop: 4,
    },
});
