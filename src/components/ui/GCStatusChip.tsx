/**
 * GoatCitadel Mobile — GCStatusChip
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type Tone = 'live' | 'success' | 'warning' | 'critical' | 'muted';

interface Props {
    children: string;
    tone?: Tone;
}

const toneStyles: Record<Tone, { bg: string; border: string; text: string; dot: string }> = {
    live: { bg: colors.statusLiveBg, border: 'rgba(144, 196, 232, 0.30)', text: colors.textPrimary, dot: colors.cyan },
    success: { bg: colors.statusSuccessBg, border: 'rgba(116, 214, 166, 0.28)', text: colors.textPrimary, dot: colors.success },
    warning: { bg: colors.statusWarningBg, border: 'rgba(229, 196, 111, 0.30)', text: colors.textPrimary, dot: colors.ember },
    critical: { bg: colors.statusCriticalBg, border: 'rgba(228, 119, 102, 0.32)', text: colors.textPrimary, dot: colors.crimson },
    muted: { bg: colors.statusMutedBg, border: 'rgba(111, 130, 150, 0.18)', text: colors.textMuted, dot: colors.textDim },
};

export function GCStatusChip({ children, tone = 'muted' }: Props) {
    const t = toneStyles[tone];
    return (
        <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
            <View style={[styles.dot, { backgroundColor: t.dot }]} />
            <Text style={[styles.text, { color: t.text }]}>{children}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        borderWidth: 1,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    text: {
        ...typography.eyebrow,
        fontSize: 10,
    },
});
