import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useLayout } from '../../hooks/useLayout';
import { colors, radii, spacing } from '../../theme/tokens';

type ChildrenProp = {
    children?: React.ReactNode;
};

export function useAdaptiveContentStyle(options?: {
    padded?: boolean;
    maxWidth?: number;
    style?: ViewStyle;
}) {
    const layout = useLayout();
    return React.useMemo<ViewStyle>(() => ({
        width: '100%',
        alignSelf: 'center',
        maxWidth: options?.maxWidth ?? layout.contentMaxWidth,
        paddingHorizontal: options?.padded === false ? 0 : layout.gutter,
        ...(options?.style ?? {}),
    }), [layout.contentMaxWidth, layout.gutter, options?.maxWidth, options?.padded, options?.style]);
}

export function AdaptiveContainer({
    children,
    style,
    padded = true,
    maxWidth,
}: ChildrenProp & {
    style?: ViewStyle;
    padded?: boolean;
    maxWidth?: number;
}) {
    const contentStyle = useAdaptiveContentStyle({ padded, maxWidth, style });
    return <View style={contentStyle}>{children}</View>;
}

export function ContextPane({
    children,
    style,
}: ChildrenProp & {
    style?: ViewStyle;
}) {
    return <View style={[styles.contextPane, style]}>{children}</View>;
}

export function MasterDetailShell({
    master,
    detail,
    inspector,
    style,
    masterStyle,
    detailStyle,
    inspectorStyle,
    masterWidth,
    inspectorWidth,
}: {
    master: React.ReactNode;
    detail: React.ReactNode;
    inspector?: React.ReactNode;
    style?: ViewStyle;
    masterStyle?: ViewStyle;
    detailStyle?: ViewStyle;
    inspectorStyle?: ViewStyle;
    masterWidth?: number;
    inspectorWidth?: number;
}) {
    const layout = useLayout();

    if (!layout.dualPane) {
        return <View style={style}>{detail}</View>;
    }

    return (
        <View style={[styles.masterDetailRoot, { gap: layout.sectionGap }, style]}>
            <View
                style={[
                    styles.masterPane,
                    {
                        width: masterWidth ?? layout.masterPaneWidth,
                    },
                    masterStyle,
                ]}
            >
                {master}
            </View>
            <View style={[styles.detailPane, detailStyle]}>{detail}</View>
            {layout.triplePane && inspector ? (
                <View
                    style={[
                        styles.inspectorPane,
                        {
                            width: inspectorWidth ?? layout.inspectorPaneWidth,
                        },
                        inspectorStyle,
                    ]}
                >
                    {inspector}
                </View>
            ) : null}
        </View>
    );
}

export function SectionGrid({
    children,
    style,
    gap,
    minItemWidthPhone = 160,
    minItemWidthTablet = 220,
    minItemWidthWideTablet = 260,
}: ChildrenProp & {
    style?: ViewStyle;
    gap?: number;
    minItemWidthPhone?: number;
    minItemWidthTablet?: number;
    minItemWidthWideTablet?: number;
}) {
    const layout = useLayout();
    const itemMinWidth = layout.triplePane
        ? minItemWidthWideTablet
        : layout.isTablet
            ? minItemWidthTablet
            : minItemWidthPhone;

    return (
        <View style={[styles.grid, { gap: gap ?? layout.sectionGap }, style]}>
            {React.Children.map(children, (child, index) => (
                <View
                    key={index}
                    style={[
                        styles.gridItem,
                        !layout.isTablet && styles.gridItemPhone,
                        { minWidth: layout.isTablet ? itemMinWidth : '100%' },
                    ]}
                >
                    {child}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    contextPane: {
        backgroundColor: colors.bgCard,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderCyan,
        padding: spacing.lg,
    },
    masterDetailRoot: {
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
    },
    masterPane: {
        flexShrink: 0,
    },
    detailPane: {
        flex: 1,
        minWidth: 0,
    },
    inspectorPane: {
        flexShrink: 0,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
    },
    gridItem: {
        flexGrow: 1,
        flexBasis: 0,
        maxWidth: '100%',
    },
    gridItemPhone: {
        minWidth: '100%',
    },
});
