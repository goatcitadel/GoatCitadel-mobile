import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useBottomInsetPadding(base = 0): number {
    const { bottom } = useSafeAreaInsets();
    return base + bottom;
}
