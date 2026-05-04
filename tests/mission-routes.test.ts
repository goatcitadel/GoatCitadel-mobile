import {
    DESKTOP_MISSION_ROUTE_IDS,
    MISSION_AREAS,
    MISSION_ROUTES,
    getMissionRouteCoverage,
} from '../src/navigation/missionRoutes';

describe('Mission Control Next mobile route parity', () => {
    it('covers every desktop Mission Control Next area and section', () => {
        expect(getMissionRouteCoverage()).toEqual({
            missingFromMobile: [],
            extraMobileRoutes: [],
        });
    });

    it('keeps every route navigable and attached to a known primary area', () => {
        const areaIds = new Set(Object.keys(MISSION_AREAS));
        const routeIds = new Set(MISSION_ROUTES.map((route) => route.id));

        expect(routeIds.size).toBe(DESKTOP_MISSION_ROUTE_IDS.length);
        for (const route of MISSION_ROUTES) {
            expect(areaIds.has(route.area)).toBe(true);
            expect(route.mobileRoute).toContain('/(tabs)/mission');
            expect(route.label.trim()).toBeTruthy();
            expect(route.description.trim()).toBeTruthy();
        }
    });
});
