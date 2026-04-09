import { resolveAdaptiveLayout } from '../src/hooks/useLayout';

describe('resolveAdaptiveLayout', () => {
    it('keeps large phones in landscape on the phone shell', () => {
        const layout = resolveAdaptiveLayout({ width: 915, height: 411 });

        expect(layout.deviceClass).toBe('phone');
        expect(layout.navMode).toBe('bottom-tabs');
        expect(layout.dualPane).toBe(false);
        expect(layout.triplePane).toBe(false);
    });

    it('enables tablet shell without forcing dual pane on compact tablets', () => {
        const layout = resolveAdaptiveLayout({ width: 800, height: 1280 });

        expect(layout.isTablet).toBe(true);
        expect(layout.navMode).toBe('sidebar');
        expect(layout.usableWidth).toBe(704);
        expect(layout.dualPane).toBe(false);
    });

    it('unlocks dual and triple pane layouts only when usable width supports them', () => {
        const dualPaneLayout = resolveAdaptiveLayout({ width: 900, height: 1280 });
        const triplePaneLayout = resolveAdaptiveLayout({ width: 1600, height: 2560 });

        expect(dualPaneLayout.dualPane).toBe(true);
        expect(dualPaneLayout.triplePane).toBe(false);
        expect(dualPaneLayout.deviceClass).toBe('tablet');

        expect(triplePaneLayout.dualPane).toBe(true);
        expect(triplePaneLayout.triplePane).toBe(true);
        expect(triplePaneLayout.deviceClass).toBe('wide-tablet');
    });
});
