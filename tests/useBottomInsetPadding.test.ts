import { resolveBottomInsetPadding } from '../src/hooks/useBottomInsetPadding';

describe('resolveBottomInsetPadding', () => {
    it('respects iOS safe area insets directly', () => {
        expect(resolveBottomInsetPadding({
            base: 20,
            bottomInset: 34,
            platform: 'ios',
            windowWidth: 430,
            windowHeight: 932,
            screenWidth: 430,
            screenHeight: 932,
        })).toBe(54);
    });

    it('detects Android three-button navigation from the screen/window delta', () => {
        expect(resolveBottomInsetPadding({
            base: 20,
            bottomInset: 0,
            platform: 'android',
            windowWidth: 1080,
            windowHeight: 2316,
            screenWidth: 1080,
            screenHeight: 2400,
        })).toBe(104);
    });

    it('uses a conservative Android fallback when the system inset is not exposed', () => {
        expect(resolveBottomInsetPadding({
            base: 8,
            bottomInset: 0,
            platform: 'android',
            windowWidth: 1080,
            windowHeight: 2400,
            screenWidth: 1080,
            screenHeight: 2400,
            androidFallbackInset: 16,
        })).toBe(24);
    });

    it('ignores side navigation bars in landscape when computing bottom padding', () => {
        expect(resolveBottomInsetPadding({
            base: 8,
            bottomInset: 0,
            platform: 'android',
            windowWidth: 2200,
            windowHeight: 1080,
            screenWidth: 2400,
            screenHeight: 1080,
            androidFallbackInset: 16,
        })).toBe(24);
    });
});
