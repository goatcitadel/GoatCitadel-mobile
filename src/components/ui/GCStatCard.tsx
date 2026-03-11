/**
 * GoatCitadel Mobile — GCStatCard
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface Props {
    label: string;
    value: string | number;
    note?: string;
    tone?: 'default' | 'accent' | 'warning' | 'critical';
}

export function GCStatCard({ label, value, note, tone = 'default' }: Props) {
    const valueColor =
        tone === 'warning' ? colors.ember :
            tone === 'critical' ? colors.crimson :
                tone === 'accent' ? colors.cyan :
                    colors.textPrimary;

    return (
        <View style={styles.card}>
            <View style={[styles.accentLine, tone === 'warning' && { backgroundColor: colors.ember }, tone === 'critical' && { backgroundColor: colors.crimson }]} />
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
            {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bgCard,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderCyan,
        padding: spacing.lg,
        overflow: 'hidden',
        flex: 1,
        minWidth: 140,
    },
    accentLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '42%',
        height: 2,
        backgroundColor: colors.cyan,
        opacity: 0.7,
    },
    label: {
        ...typography.eyebrow,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    value: {
        ...typography.displayLg,
        color: colors.textPrimary,
    },
    note: {
        ...typography.caption,
        color: colors.textDim,
        marginTop: spacing.xs,
    },
});
