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
    live: { bg: colors.statusLiveBg, border: 'rgba(84, 221, 255, 0.34)', text: '#c9f8ff', dot: colors.cyan },
    success: { bg: colors.statusSuccessBg, border: 'rgba(110, 245, 165, 0.28)', text: '#d8ffe8', dot: colors.success },
    warning: { bg: colors.statusWarningBg, border: 'rgba(255, 154, 69, 0.32)', text: '#ffd7b4', dot: colors.ember },
    critical: { bg: colors.statusCriticalBg, border: 'rgba(255, 86, 120, 0.34)', text: '#ffd7e0', dot: colors.crimson },
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
        paddingHorizontal: 10,
        paddingVertical: 4,
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
