/**
 * GoatCitadel Mobile — Signal Noir Design Tokens
 * Ported from the desktop Signal Noir CSS theme.
 */

export const colors = {
    // Core backgrounds
    bgCore: '#06080d',
    bgShell: '#090d14',
    bgSidebar: '#0a1017',
    bgPanel: 'rgba(13, 19, 28, 0.92)',
    bgPanelElevated: 'rgba(17, 24, 35, 0.96)',
    bgPanelSolid: '#0d1320',
    bgPanelElevatedSolid: '#111824',
    bgInset: '#080b12',
    bgCard: '#0e141e',
    bgCardElevated: '#111927',
    bgInput: '#0a0f18',

    // Borders
    borderQuiet: 'rgba(62, 81, 101, 0.24)',
    borderDefault: 'rgba(89, 116, 139, 0.26)',
    borderStrong: 'rgba(91, 200, 224, 0.34)',
    borderLive: 'rgba(84, 221, 255, 0.54)',
    borderCyan: 'rgba(92, 198, 223, 0.18)',

    // Text
    textPrimary: '#f0f6fb',
    textSecondary: '#b6c3d1',
    textMuted: '#7e8ea1',
    textDim: '#5e6b7c',

    // Accents
    cyan: '#54ddff',
    cyanMuted: 'rgba(84, 221, 255, 0.18)',
    cyanGlow: 'rgba(84, 221, 255, 0.12)',
    ember: '#ff9a45',
    emberMuted: 'rgba(255, 154, 69, 0.18)',
    crimson: '#ff5678',
    crimsonMuted: 'rgba(255, 86, 120, 0.18)',
    success: '#6ef5a5',
    successMuted: 'rgba(110, 245, 165, 0.18)',

    // Semantic
    riskSafe: '#6ef5a5',
    riskCaution: '#ff9a45',
    riskDanger: '#ff5678',
    riskNuclear: '#ff2d55',

    // Status chip backgrounds
    statusLiveBg: 'rgba(84, 221, 255, 0.12)',
    statusWarningBg: 'rgba(255, 154, 69, 0.12)',
    statusCriticalBg: 'rgba(255, 86, 120, 0.12)',
    statusSuccessBg: 'rgba(110, 245, 165, 0.12)',
    statusMutedBg: 'rgba(111, 130, 150, 0.12)',

    // Tab bar
    tabBarBg: '#070a10',
    tabBarBorder: 'rgba(92, 198, 223, 0.12)',
    tabActive: '#54ddff',
    tabInactive: '#5e6b7c',
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
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
} as const;

export const typography = {
    displayFont: 'Rajdhani_600SemiBold',
    bodyFont: 'System',

    displayLg: {
        fontFamily: 'Rajdhani_600SemiBold',
        fontSize: 28,
        lineHeight: 32,
        letterSpacing: 0.8,
    },
    displayMd: {
        fontFamily: 'Rajdhani_600SemiBold',
        fontSize: 22,
        lineHeight: 26,
        letterSpacing: 0.6,
    },
    displaySm: {
        fontFamily: 'Rajdhani_600SemiBold',
        fontSize: 16,
        lineHeight: 20,
        letterSpacing: 0.5,
    },
    eyebrow: {
        fontFamily: 'Rajdhani_600SemiBold',
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 1.5,
        textTransform: 'uppercase' as const,
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
