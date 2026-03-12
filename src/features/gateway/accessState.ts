import type {
    GatewayAccessPreflightResult,
    GatewayAuthMode,
    GatewayConnectionCheck,
} from '../../api/types';

export type GatewayShellAccessStatus =
    | 'idle'
    | 'checking'
    | GatewayAccessPreflightResult['status']
    | 'degraded-live-updates';

export type GatewayShellAccessTone = 'success' | 'warning' | 'critical' | 'muted';

export type GatewayAccessLike = GatewayAccessPreflightResult | {
    status: 'idle' | 'checking';
    message: string;
    healthDetail?: string;
    authMode?: GatewayAuthMode;
    checks?: GatewayConnectionCheck[];
};

export interface GatewayShellAccessState {
    status: GatewayShellAccessStatus;
    label: string;
    message: string;
    nextStep: string;
    tone: GatewayShellAccessTone;
    detail?: string;
    authMode?: GatewayAuthMode;
    checks?: GatewayConnectionCheck[];
    canOpenLogin: boolean;
}

export function deriveGatewayShellAccessState(
    access: GatewayAccessLike | null | undefined,
    options?: {
        liveUpdatesDegraded?: boolean;
        liveUpdatesDetail?: string;
    },
): GatewayShellAccessState {
    const liveUpdatesDegraded = options?.liveUpdatesDegraded === true;
    const liveUpdatesDetail = options?.liveUpdatesDetail?.trim() || undefined;

    if (!access || access.status === 'idle' || access.status === 'checking') {
        return {
            status: access?.status ?? 'checking',
            label: 'Checking gateway',
            message: access?.message ?? 'Checking gateway access and live updates…',
            nextStep: 'Wait for the first probe to finish.',
            tone: 'muted',
            detail: access?.healthDetail,
            authMode: access?.authMode,
            checks: access?.checks,
            canOpenLogin: false,
        };
    }

    if (access.status === 'ready') {
        if (liveUpdatesDegraded) {
            return {
                status: 'degraded-live-updates',
                label: 'Live updates degraded',
                message: 'Gateway access is verified, but background refresh is degraded.',
                nextStep: 'Keep working, or retry if you need the latest events right now.',
                tone: 'warning',
                detail: liveUpdatesDetail ?? access.healthDetail,
                authMode: access.authMode,
                checks: access.checks,
                canOpenLogin: false,
            };
        }
        return {
            status: 'ready',
            label: 'Gateway ready',
            message: access.message,
            nextStep: 'The app can use the gateway normally.',
            tone: 'success',
            detail: access.healthDetail,
            authMode: access.authMode,
            checks: access.checks,
            canOpenLogin: false,
        };
    }

    if (access.status === 'needs-auth') {
        return {
            status: 'needs-auth',
            label: 'Auth required',
            message: access.message,
            nextStep: 'Open the login gate or refresh device approval before continuing.',
            tone: 'warning',
            detail: access.healthDetail,
            authMode: access.authMode,
            checks: access.checks,
            canOpenLogin: true,
        };
    }

    if (access.status === 'unreachable') {
        return {
            status: 'unreachable',
            label: 'Gateway unreachable',
            message: access.message,
            nextStep: 'Check the gateway URL, network path, and that the gateway is still running.',
            tone: 'critical',
            detail: access.healthDetail,
            authMode: access.authMode,
            checks: access.checks,
            canOpenLogin: false,
        };
    }

    return {
        status: 'misconfigured',
        label: 'Gateway misconfigured',
        message: access.message,
        nextStep: 'Fix the gateway auth or probe configuration before continuing.',
        tone: 'critical',
        detail: access.healthDetail,
        authMode: access.authMode,
        checks: access.checks,
        canOpenLogin: true,
    };
}

export function formatGatewayAccessDiagnostics(access: GatewayAccessLike | null | undefined): string | undefined {
    if (!access) {
        return undefined;
    }
    if (access.checks?.length) {
        return access.checks
            .map((check) => `${check.label} [${check.status.toUpperCase()}]\n${check.path}\n${check.detail}`)
            .join('\n\n');
    }
    return access.healthDetail?.trim() || undefined;
}

export function gatewayShellAccessToneToChipTone(
    tone: GatewayShellAccessTone,
): 'success' | 'warning' | 'critical' | 'muted' {
    if (tone === 'success') {
        return 'success';
    }
    if (tone === 'warning') {
        return 'warning';
    }
    if (tone === 'critical') {
        return 'critical';
    }
    return 'muted';
}
