import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChatSessionRecord } from '../../api/types';
import { ContextPane } from '../../components/layout';
import { GCButton, GCStatusChip } from '../../components/ui';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export function SessionDetailPane({
    session,
    heading = 'Session detail',
    emptyTitle = 'Select a session',
    emptyBody = 'Choose a session from the list to keep work, cost, and context visible while you operate.',
    primaryLabel = 'Open in Chat',
    onOpen,
}: {
    session?: ChatSessionRecord;
    heading?: string;
    emptyTitle?: string;
    emptyBody?: string;
    primaryLabel?: string;
    onOpen?: (session: ChatSessionRecord) => void;
}) {
    if (!session) {
        return (
            <ContextPane style={styles.pane}>
                <Text style={styles.heading}>{heading}</Text>
                <View style={styles.emptyState}>
                    <Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.textDim} />
                    <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                    <Text style={styles.emptyBody}>{emptyBody}</Text>
                </View>
            </ContextPane>
        );
    }

    return (
        <ContextPane style={styles.pane}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.title}>{session.title || 'Untitled session'}</Text>
            <View style={styles.metaRow}>
                <GCStatusChip tone={session.scope === 'mission' ? 'warning' : 'live'}>
                    {session.scope.toUpperCase()}
                </GCStatusChip>
                {session.projectName ? (
                    <GCStatusChip tone="muted">{session.projectName}</GCStatusChip>
                ) : null}
            </View>
            <View style={styles.statGrid}>
                <DetailStat label="Tokens" value={session.tokenTotal.toLocaleString()} />
                <DetailStat label="Cost" value={`$${session.costUsdTotal.toFixed(4)}`} />
                <DetailStat
                    label="Last activity"
                    value={new Date(session.lastActivityAt).toLocaleString()}
                    fullWidth
                />
            </View>
            {onOpen ? (
                <GCButton
                    title={primaryLabel}
                    onPress={() => onOpen(session)}
                    variant="primary"
                    size="md"
                    style={styles.action}
                />
            ) : null}
        </ContextPane>
    );
}

function DetailStat({
    label,
    value,
    fullWidth,
}: {
    label: string;
    value: string;
    fullWidth?: boolean;
}) {
    return (
        <View style={[styles.statCard, fullWidth && styles.statCardFull]}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pane: {
        flex: 1,
        minHeight: 240,
    },
    heading: {
        ...typography.eyebrow,
        color: colors.textMuted,
        marginBottom: spacing.sm,
    },
    title: {
        ...typography.displayMd,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    statCard: {
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 120,
        backgroundColor: colors.bgInset,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        padding: spacing.md,
    },
    statCardFull: {
        minWidth: '100%',
    },
    statLabel: {
        ...typography.caption,
        color: colors.textDim,
        marginBottom: spacing.xs,
    },
    statValue: {
        ...typography.bodyMd,
        color: colors.textPrimary,
    },
    action: {
        marginTop: spacing.xl,
        alignSelf: 'flex-start',
    },
    emptyState: {
        flex: 1,
        minHeight: 220,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderQuiet,
        backgroundColor: colors.bgInset,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    emptyTitle: {
        ...typography.displaySm,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    emptyBody: {
        ...typography.bodySm,
        color: colors.textDim,
        textAlign: 'center',
    },
});
