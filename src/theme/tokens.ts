/**
 * GoatCitadel Mobile — Mission Control Next aligned design tokens.
 */

export const colors = {
    // Core backgrounds
    bgCore: '#14181d',
    bgShell: '#181d24',
    bgSidebar: '#10141a',
    bgPanel: '#181d24',
    bgPanelElevated: '#222833',
    bgPanelSolid: '#181d24',
    bgPanelElevatedSolid: '#222833',
    bgInset: '#151a21',
    bgCard: '#1b2027',
    bgCardElevated: '#222833',
    bgInput: '#181d24',

    // Borders
    borderQuiet: 'rgba(255, 255, 255, 0.08)',
    borderDefault: 'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(244, 234, 214, 0.22)',
    borderLive: 'rgba(144, 196, 232, 0.34)',
    borderCyan: 'rgba(255, 255, 255, 0.10)',

    // Text
    textPrimary: '#f4f1ea',
    textSecondary: '#c9c6bd',
    textMuted: '#898f99',
    textDim: '#676f7a',

    // Accents
    cyan: '#90c4e8',
    cyanMuted: 'rgba(144, 196, 232, 0.14)',
    cyanGlow: 'rgba(144, 196, 232, 0.08)',
    ember: '#e5c46f',
    emberMuted: 'rgba(229, 196, 111, 0.14)',
    crimson: '#e47766',
    crimsonMuted: 'rgba(228, 119, 102, 0.14)',
    success: '#74d6a6',
    successMuted: 'rgba(116, 214, 166, 0.14)',

    // Mission Control Next area colors
    areaChat: '#90c4e8',
    areaCowork: '#d59bd4',
    areaCode: '#77d5b2',
    areaProjects: '#76cfe7',
    areaLibrary: '#9fb9ef',
    areaOps: '#9db5d1',
    areaSettings: '#e2ca7d',

    // Semantic
    riskSafe: '#74d6a6',
    riskCaution: '#e5c46f',
    riskDanger: '#e47766',
    riskNuclear: '#d867a5',

    // Status chip backgrounds
    statusLiveBg: 'rgba(84, 221, 255, 0.12)',
    statusWarningBg: 'rgba(255, 154, 69, 0.12)',
    statusCriticalBg: 'rgba(255, 86, 120, 0.12)',
    statusSuccessBg: 'rgba(110, 245, 165, 0.12)',
    statusMutedBg: 'rgba(111, 130, 150, 0.12)',

    // Tab bar
    tabBarBg: '#10141a',
    tabBarBorder: 'rgba(255, 255, 255, 0.08)',
    tabActive: '#f4ead6',
    tabInactive: '#898f99',
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
} as const;

export const radii = {
    sm: 5,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 999,
} as const;

export const typography = {
    displayFont: 'System',
    bodyFont: 'System',

    displayLg: {
        fontFamily: 'System',
        fontSize: 24,
        lineHeight: 29,
        letterSpacing: 0,
        fontWeight: '700' as const,
    },
    displayMd: {
        fontFamily: 'System',
        fontSize: 20,
        lineHeight: 26,
        letterSpacing: 0,
        fontWeight: '700' as const,
    },
    displaySm: {
        fontFamily: 'System',
        fontSize: 16,
        lineHeight: 20,
        letterSpacing: 0,
        fontWeight: '700' as const,
    },
    eyebrow: {
        fontFamily: 'System',
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
        fontWeight: '700' as const,
    },
    bodyLg: {
        fontSize: 16,
        lineHeight: 22,
    },
    bodyMd: {
        fontSize: 14,
        lineHeight: 20,
    },
    bodySm: {
        fontSize: 12,
        lineHeight: 16,
    },
    caption: {
        fontSize: 11,
        lineHeight: 14,
    },
    mono: {
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 18,
    },
} as const;

/**
 * Adaptive breakpoints are based on usability rather than raw width-only scaling.
 * Tablet detection uses shortest side so large phones in landscape remain in phone mode.
 */
export const TABLET_BREAKPOINT = 600;
export const DUAL_PANE_MIN_WIDTH = 760;
export const TABLET_WIDE_BREAKPOINT = 1100;

export const adaptiveLayout = {
    maxContentWidth: 1600,
    maxReadableWidth: 760,
    railWidth: 96,
    masterPaneWidth: 340,
    inspectorPaneWidth: 320,
    contentGutterPhone: spacing.xl,
    contentGutterTablet: 28,
    contentGutterWideTablet: 32,
    sectionGapPhone: spacing.lg,
    sectionGapTablet: spacing.xl,
    sectionGapWideTablet: spacing.xxl,
} as const;
