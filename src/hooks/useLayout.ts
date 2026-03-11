import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { TABLET_BREAKPOINT, TABLET_WIDE_BREAKPOINT } from '../theme/tokens';

export function useLayout() {
    const [dims, setDims] = useState(() => Dimensions.get('window'));

    useEffect(() => {
        const sub = Dimensions.addEventListener('change', ({ window }) => {
            setDims(window);
        });
        return () => sub.remove();
    }, []);

    return {
        width: dims.width,
        height: dims.height,
        isTablet: dims.width >= TABLET_BREAKPOINT,
        isWideTablet: dims.width >= TABLET_WIDE_BREAKPOINT,
        isLandscape: dims.width > dims.height,
    };
}
