import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type {
    OtpAssistAvailability,
    OtpAssistRequest,
    OtpAssistResult,
    PhoneAssistCapabilityId,
    PhoneAssistCapabilityState,
    ScreenShareSessionState,
} from './contracts';

type NativeCapabilityDescriptor = {
    id: PhoneAssistCapabilityId;
    state: PhoneAssistCapabilityState;
    summary: string;
    implementationStatus: 'ready' | 'stubbed' | 'deferred';
};

type PhoneAssistNativeModule = {
    getCapabilities: () => Promise<NativeCapabilityDescriptor[]>;
    requestEnable: (capabilityId: PhoneAssistCapabilityId) => Promise<PhoneAssistCapabilityState>;
    revoke: (capabilityId: PhoneAssistCapabilityId, reason: string) => Promise<PhoneAssistCapabilityState>;
    panicOff: () => Promise<boolean>;
    startOtpAssist?: (request: OtpAssistRequest) => Promise<OtpAssistAvailability>;
    stopOtpAssist?: () => Promise<boolean>;
    prepareScreenShareSession?: () => Promise<ScreenShareSessionState>;
    addListener?: (eventName: string) => void;
    removeListeners?: (count: number) => void;
};

function getNativeModule(): PhoneAssistNativeModule | undefined {
    if (Platform.OS !== 'android') {
        return undefined;
    }
    const mod = (NativeModules as Record<string, unknown>).PhoneAssist;
    if (!mod || typeof mod !== 'object') {
        return undefined;
    }
    return mod as PhoneAssistNativeModule;
}

const nativeEmitter = (() => {
    const mod = getNativeModule();
    return mod ? new NativeEventEmitter(mod as never) : null;
})();

export async function fetchNativePhoneAssistCapabilities(): Promise<NativeCapabilityDescriptor[]> {
    const mod = getNativeModule();
    if (!mod?.getCapabilities) {
        return [];
    }
    return mod.getCapabilities();
}

export async function requestNativePhoneAssistEnable(
    capabilityId: PhoneAssistCapabilityId,
): Promise<PhoneAssistCapabilityState | undefined> {
    const mod = getNativeModule();
    if (!mod?.requestEnable) {
        return undefined;
    }
    return mod.requestEnable(capabilityId);
}

export async function revokeNativePhoneAssist(
    capabilityId: PhoneAssistCapabilityId,
    reason: string,
): Promise<PhoneAssistCapabilityState | undefined> {
    const mod = getNativeModule();
    if (!mod?.revoke) {
        return undefined;
    }
    return mod.revoke(capabilityId, reason);
}

export async function triggerNativePhoneAssistPanicOff(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod?.panicOff) {
        return false;
    }
    return mod.panicOff();
}

export async function startNativeOtpAssist(
    request: OtpAssistRequest,
): Promise<OtpAssistAvailability | undefined> {
    const mod = getNativeModule();
    if (!mod?.startOtpAssist) {
        return undefined;
    }
    return mod.startOtpAssist(request);
}

export async function stopNativeOtpAssist(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod?.stopOtpAssist) {
        return false;
    }
    return mod.stopOtpAssist();
}

export function subscribeToNativeOtpAssist(
    callback: (result: OtpAssistResult) => void,
): (() => void) {
    if (!nativeEmitter) {
        return () => {};
    }
    const subscription = nativeEmitter.addListener('GoatCitadelOtpAssist', callback);
    return () => subscription.remove();
}

export async function prepareNativeScreenShareSession(): Promise<ScreenShareSessionState | undefined> {
    const mod = getNativeModule();
    if (!mod?.prepareScreenShareSession) {
        return undefined;
    }
    return mod.prepareScreenShareSession();
}
