import { colors } from '../theme/tokens';

export type MissionArea = 'chat' | 'cowork' | 'code' | 'projects' | 'library' | 'ops' | 'settings';
export type MissionRouteStatus = 'mobile-native' | 'mobile-summary' | 'desktop-deep-edit';

export interface MissionRoute {
    id: string;
    area: MissionArea;
    section: string;
    label: string;
    description: string;
    mobileRoute: string;
    availableRoute?: string;
    status: MissionRouteStatus;
}

export interface MissionAreaMeta {
    id: MissionArea;
    label: string;
    kicker: string;
    description: string;
    color: string;
}

export const MISSION_AREAS: Record<MissionArea, MissionAreaMeta> = {
    chat: {
        id: 'chat',
        label: 'Chat',
        kicker: 'Conversation',
        description: 'Conversation, artifacts, memory, and approvals close to the active thread.',
        color: colors.areaChat,
    },
    cowork: {
        id: 'cowork',
        label: 'Cowork',
        kicker: 'Orchestration',
        description: 'Delegation, tasks, agent board posture, and operator checkpoints.',
        color: colors.areaCowork,
    },
    code: {
        id: 'code',
        label: 'Code',
        kicker: 'Implementation',
        description: 'Code-mode sessions, files, runtime posture, and prompt-pack quality gates.',
        color: colors.areaCode,
    },
    projects: {
        id: 'projects',
        label: 'Projects',
        kicker: 'Containers',
        description: 'Project containers that group Chat, Cowork, and Code work.',
        color: colors.areaProjects,
    },
    library: {
        id: 'library',
        label: 'Library',
        kicker: 'Knowledge',
        description: 'Agents, skills, memory, knowledge, files, artifacts, and prompt packs.',
        color: colors.areaLibrary,
    },
    ops: {
        id: 'ops',
        label: 'Ops',
        kicker: 'Operations',
        description: 'Activity, sessions, schedules, approvals, cost, runtime, and diagnostics.',
        color: colors.areaOps,
    },
    settings: {
        id: 'settings',
        label: 'Settings',
        kicker: 'Configuration',
        description: 'Providers, access, runtime, workspaces, integrations, channels, tools, and add-ons.',
        color: colors.areaSettings,
    },
};

const detailRoute = (area: MissionArea, section: string) => `/(tabs)/mission?area=${area}&section=${section}`;

export const MISSION_ROUTES: MissionRoute[] = [
    route('chat', 'thread', 'Thread', 'Conversation with model, tool, attachment, and runtime truth.', '/(tabs)/chat', 'mobile-native'),
    route('chat', 'artifacts', 'Artifacts', 'Generated outputs from active work.', undefined, 'mobile-summary'),
    route('chat', 'memory', 'Memory', 'Memory attached to the current conversation.', undefined, 'mobile-summary'),
    route('chat', 'approvals', 'Approvals', 'Pending decisions from the active thread.', '/(tabs)/approvals', 'mobile-native'),

    route('cowork', 'workspace', 'Workspace', 'Delegation-first work surface for multi-step tasks.', '/(tabs)/cowork', 'mobile-native'),
    route('cowork', 'tasks', 'Task Board', 'Planning, assigned, review, blocked, and done task lanes.', '/(tabs)/workflows', 'mobile-summary'),
    route('cowork', 'board', 'Agent Board', 'Agent posture and active orchestration state.', '/(tabs)/herd', 'mobile-summary'),
    route('cowork', 'approvals', 'Approvals', 'Risk checkpoints surfaced where operators expect them.', '/(tabs)/approvals', 'mobile-native'),

    route('code', 'workbench', 'Workbench', 'Code-mode sessions with project context.', '/(tabs)/code', 'mobile-native'),
    route('code', 'files', 'Files', 'Workspace file browser and file posture.', undefined, 'mobile-summary'),
    route('code', 'runtime', 'Runtime', 'Gateway and local runtime health while coding.', '/(tabs)/health', 'mobile-summary'),
    route('code', 'prompt-packs', 'Prompt Packs', 'Prompt-pack quality gates and generated review work.', undefined, 'desktop-deep-edit'),

    route('projects', 'projects', 'Projects', 'Project containers with grouped cross-surface threads.', undefined, 'mobile-summary'),

    route('library', 'agents', 'Agents', 'Reusable agent profiles and imported catalogs.', '/(tabs)/herd', 'mobile-native'),
    route('library', 'skills', 'Skills', 'Skill states, declared tools, and activation posture.', '/(tabs)/skills', 'mobile-native'),
    route('library', 'memory', 'Memory', 'Durable memory items and lifecycle posture.', undefined, 'mobile-summary'),
    route('library', 'knowledge', 'Knowledge', 'Knowledge ingest and retrieval context.', undefined, 'mobile-summary'),
    route('library', 'files', 'Files', 'Workspace files and templates.', undefined, 'mobile-summary'),
    route('library', 'artifacts', 'Artifacts', 'Generated artifacts from Chat, Cowork, and Code.', undefined, 'mobile-summary'),
    route('library', 'prompt-packs', 'Prompt Packs', 'Prompt-pack authoring, benchmark, export, and review.', undefined, 'desktop-deep-edit'),

    route('ops', 'activity', 'Activity', 'Realtime event feed and operational signal.', '/(tabs)/pulse', 'mobile-native'),
    route('ops', 'sessions', 'Sessions', 'Session timelines, summaries, and operator evidence.', '/(tabs)/sessions', 'mobile-native'),
    route('ops', 'schedules', 'Schedules', 'Cron posture and scheduler review queue.', '/(tabs)/workflows', 'mobile-native'),
    route('ops', 'improvement', 'Improvement', 'Replay and improvement-loop evidence.', undefined, 'mobile-summary'),
    route('ops', 'notifications', 'Notifications', 'Runtime issues and operator follow-up.', '/(tabs)/notifications', 'mobile-native'),
    route('ops', 'approvals', 'Approvals', 'Decision inbox, replay, and approval history.', '/(tabs)/approvals', 'mobile-native'),
    route('ops', 'costs', 'Costs', 'Spend visibility and session cost evidence.', '/(tabs)/costs', 'mobile-native'),
    route('ops', 'runtime', 'Runtime', 'Gateway health, daemon posture, host vitals, and backups.', '/(tabs)/health', 'mobile-summary'),
    route('ops', 'diagnostics', 'Diagnostics', 'Durable, daemon, admin, docs, and verification signals.', '/(tabs)/logs', 'mobile-summary'),

    route('settings', 'general', 'General', 'Base defaults inherited by every surface.', '/(tabs)/settings', 'mobile-native'),
    route('settings', 'onboarding', 'Onboarding', 'First-run readiness, defaults, and setup checkpoints.', '/login', 'mobile-summary'),
    route('settings', 'providers', 'Providers', 'Model provider defaults and credential posture.', '/(tabs)/settings', 'mobile-native'),
    route('settings', 'access', 'Access', 'Auth posture, device grants, secrets, and boundaries.', '/(tabs)/settings', 'mobile-native'),
    route('settings', 'runtime', 'Runtime', 'Mesh, local runtimes, backups, and serving posture.', '/(tabs)/settings', 'mobile-summary'),
    route('settings', 'workspaces', 'Workspaces', 'Workspace context and guidance.', undefined, 'mobile-summary'),
    route('settings', 'integrations', 'Integrations', 'Connections, connectors, and integration overview.', undefined, 'mobile-summary'),
    route('settings', 'channels', 'Channels', 'Comms and delivery setup.', undefined, 'mobile-summary'),
    route('settings', 'mcp', 'MCP', 'MCP server posture, templates, and tools.', '/(tabs)/mcp', 'mobile-native'),
    route('settings', 'tools', 'Tools', 'Tool grants and catalog policy.', undefined, 'mobile-summary'),
    route('settings', 'addons', 'Add-ons', 'Installed extensions and add-on posture.', undefined, 'mobile-summary'),
];

export const DESKTOP_MISSION_ROUTE_IDS = [
    'chat.thread',
    'chat.artifacts',
    'chat.memory',
    'chat.approvals',
    'cowork.workspace',
    'cowork.tasks',
    'cowork.board',
    'cowork.approvals',
    'code.workbench',
    'code.files',
    'code.runtime',
    'code.prompt-packs',
    'projects.projects',
    'library.agents',
    'library.skills',
    'library.memory',
    'library.knowledge',
    'library.files',
    'library.artifacts',
    'library.prompt-packs',
    'ops.activity',
    'ops.sessions',
    'ops.schedules',
    'ops.improvement',
    'ops.notifications',
    'ops.approvals',
    'ops.costs',
    'ops.runtime',
    'ops.diagnostics',
    'settings.general',
    'settings.onboarding',
    'settings.providers',
    'settings.access',
    'settings.runtime',
    'settings.workspaces',
    'settings.integrations',
    'settings.channels',
    'settings.mcp',
    'settings.tools',
    'settings.addons',
] as const;

export function getMissionRoute(area: MissionArea, section: string): MissionRoute | undefined {
    return MISSION_ROUTES.find((item) => item.area === area && item.section === section);
}

export function getMissionRoutesByArea(area: MissionArea): MissionRoute[] {
    return MISSION_ROUTES.filter((item) => item.area === area);
}

export function getMissionRouteCoverage() {
    const mobileIds = new Set(MISSION_ROUTES.map((item) => item.id));
    const desktopIds = new Set<string>(DESKTOP_MISSION_ROUTE_IDS);
    return {
        missingFromMobile: DESKTOP_MISSION_ROUTE_IDS.filter((id) => !mobileIds.has(id)),
        extraMobileRoutes: MISSION_ROUTES.map((item) => item.id).filter((id) => !desktopIds.has(id)),
    };
}

function route(
    area: MissionArea,
    section: string,
    label: string,
    description: string,
    availableRoute?: string,
    status: MissionRouteStatus = 'mobile-summary',
): MissionRoute {
    return {
        id: `${area}.${section}`,
        area,
        section,
        label,
        description,
        availableRoute,
        status,
        mobileRoute: detailRoute(area, section),
    };
}
