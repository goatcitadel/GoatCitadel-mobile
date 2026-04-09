import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
    DUAL_PANE_MIN_WIDTH,
    TABLET_BREAKPOINT,
    TABLET_WIDE_BREAKPOINT,
    adaptiveLayout,
} from '../theme/tokens';

export function resolveAdaptiveLayout(args: {
    width: number;
    height: number;
}) {
    const width = args.width;
    const height = args.height;
    const shortestSide = Math.min(width, height);
    const longestSide = Math.max(width, height);
    const isLandscape = width > height;
    const isTablet = shortestSide >= TABLET_BREAKPOINT;
    const shellReservedWidth = isTablet ? adaptiveLayout.railWidth : 0;
    const usableWidth = Math.max(width - shellReservedWidth, 0);
    const isWideTablet = isTablet && usableWidth >= TABLET_WIDE_BREAKPOINT;
    const dualPane = isTablet && usableWidth >= DUAL_PANE_MIN_WIDTH;
    const triplePane = isTablet && usableWidth >= TABLET_WIDE_BREAKPOINT;
    const deviceClass = triplePane ? 'wide-tablet' : isTablet ? 'tablet' : 'phone';
    const navMode = isTablet ? 'sidebar' : 'bottom-tabs';
    const gutter = triplePane
        ? adaptiveLayout.contentGutterWideTablet
        : isTablet
            ? adaptiveLayout.contentGutterTablet
            : adaptiveLayout.contentGutterPhone;
    const sectionGap = triplePane
        ? adaptiveLayout.sectionGapWideTablet
        : isTablet
            ? adaptiveLayout.sectionGapTablet
            : adaptiveLayout.sectionGapPhone;
    const contentMaxWidth = isTablet ? adaptiveLayout.maxContentWidth : undefined;
    const readableWidth = adaptiveLayout.maxReadableWidth;

    return {
        width,
        height,
        shortestSide,
        longestSide,
        usableWidth,
        shellReservedWidth,
        deviceClass,
        isTablet,
        isWideTablet,
        dualPane,
        triplePane,
        isLandscape,
        navMode,
        gutter,
        sectionGap,
        contentMaxWidth,
        readableWidth,
        railWidth: adaptiveLayout.railWidth,
        masterPaneWidth: adaptiveLayout.masterPaneWidth,
        inspectorPaneWidth: adaptiveLayout.inspectorPaneWidth,
    } as const;
}

export function useLayout() {
    const dims = useWindowDimensions();

    return useMemo(() => resolveAdaptiveLayout({
        width: dims.width,
        height: dims.height,
    }), [dims.height, dims.width]);
}
