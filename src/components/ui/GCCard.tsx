/**
 * GoatCitadel Mobile — GCCard component
 * Glass panel card matching Signal Noir styling.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
    elevated?: boolean;
    variant?: 'default' | 'warning' | 'critical';
}

export function GCCard({ children, style, elevated, variant = 'default' }: Props) {
    return (
        <View
            style={[
                styles.card,
                elevated && styles.elevated,
                variant === 'warning' && styles.warning,
                variant === 'critical' && styles.critical,
                style,
            ]}
        >
            <View style={[styles.accentLine, variant === 'warning' && styles.accentWarning, variant === 'critical' && styles.accentCritical]} />
            {children}
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
    },
    elevated: {
        backgroundColor: colors.bgCardElevated,
        borderColor: colors.borderDefault,
    },
    warning: {
        borderColor: colors.emberMuted,
    },
    critical: {
        borderColor: colors.crimsonMuted,
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
    accentWarning: {
        backgroundColor: colors.ember,
    },
    accentCritical: {
        backgroundColor: colors.crimson,
    },
});
