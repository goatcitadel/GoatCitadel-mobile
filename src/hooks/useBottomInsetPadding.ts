import { useMemo } from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/tokens';

export function getAndroidBottomSystemInset(args: {
    windowWidth: number;
    windowHeight: number;
    screenWidth: number;
    screenHeight: number;
}): number {
    const verticalInset = Math.max(args.screenHeight - args.windowHeight, 0);
    const horizontalInset = Math.max(args.screenWidth - args.windowWidth, 0);

    // In landscape some Android devices move the nav buttons to the side. We only
    // want bottom padding here, so prefer the vertical delta and ignore side rails.
    if (verticalInset >= horizontalInset) {
        return verticalInset;
    }

    return 0;
}

export function resolveBottomInsetPadding(args: {
    base?: number;
    bottomInset: number;
    platform?: string;
    windowWidth: number;
    windowHeight: number;
    screenWidth: number;
    screenHeight: number;
    androidFallbackInset?: number;
}): number {
    const {
        base = 0,
        bottomInset,
        platform = Platform.OS,
        windowWidth,
        windowHeight,
        screenWidth,
        screenHeight,
        androidFallbackInset = spacing.lg,
    } = args;

    if (platform !== 'android') {
        return base + bottomInset;
    }

    const detectedBottomInset = getAndroidBottomSystemInset({
        windowWidth,
        windowHeight,
        screenWidth,
        screenHeight,
    });
    const fallbackInset = bottomInset === 0 && detectedBottomInset === 0
        ? androidFallbackInset
        : 0;

    return base + Math.max(bottomInset, detectedBottomInset, fallbackInset);
}

export function useBottomInsetPadding(base = 0, options?: {
    androidFallbackInset?: number;
}): number {
    const { bottom } = useSafeAreaInsets();
    const dims = useWindowDimensions();
    const screen = Dimensions.get('screen');

    return useMemo(() => resolveBottomInsetPadding({
        base,
        bottomInset: bottom,
        windowWidth: dims.width,
        windowHeight: dims.height,
        screenWidth: screen.width,
        screenHeight: screen.height,
        androidFallbackInset: options?.androidFallbackInset,
    }), [base, bottom, dims.height, dims.width, options?.androidFallbackInset, screen.height, screen.width]);
}
