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
    accentColor?: string;
    accent?: boolean;
}

export function GCCard({
    children,
    style,
    elevated,
    variant = 'default',
    accentColor = colors.cyan,
    accent = false,
}: Props) {
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
            {accent || variant !== 'default' ? (
                <View
                    style={[
                        styles.accentLine,
                        { backgroundColor: accentColor },
                        variant === 'warning' && styles.accentWarning,
                        variant === 'critical' && styles.accentCritical,
                    ]}
                />
            ) : null}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bgCard,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        padding: spacing.md,
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
        width: '34%',
        height: 2,
        backgroundColor: colors.cyan,
        opacity: 0.78,
    },
    accentWarning: {
        backgroundColor: colors.ember,
    },
    accentCritical: {
        backgroundColor: colors.crimson,
    },
});
