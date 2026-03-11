/**
 * GoatCitadel Mobile — GCHeader
 * Page/section header with eyebrow and subtitle.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme/tokens';

interface Props {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    style?: ViewStyle;
}

export function GCHeader({ eyebrow, title, subtitle, right, style }: Props) {
    const insets = useSafeAreaInsets();
    const topPad = Math.max(insets.top, spacing.xl);

    return (
        <View style={[styles.container, { paddingTop: topPad + spacing.sm }, style]}>
            <View style={styles.main}>
                {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {right ? <View style={styles.right}>{right}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,
    },
    main: {
        flex: 1,
        gap: 4,
    },
    eyebrow: {
        ...typography.eyebrow,
        color: colors.cyan,
        marginBottom: 2,
    },
    title: {
        ...typography.displayLg,
        color: colors.textPrimary,
        textTransform: 'uppercase',
    },
    subtitle: {
        ...typography.bodySm,
        color: colors.textMuted,
        marginTop: 2,
    },
    right: {
        marginLeft: spacing.md,
        alignItems: 'flex-end',
    },
});
