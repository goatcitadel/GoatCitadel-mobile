import * as Location from 'expo-location';

const LOCATION_REQUEST_PATTERNS = [
    /\bnear me\b/i,
    /\bnearby\b/i,
    /\baround here\b/i,
    /\baround me\b/i,
    /\baround us\b/i,
    /\bclose to me\b/i,
    /\bclosest\b/i,
    /\bin this area\b/i,
    /\bwhere am i\b/i,
];

type LocationContextResult =
    | { status: 'skipped' }
    | { status: 'attached'; context: string }
    | { status: 'permission-denied'; reason: string }
    | { status: 'unavailable'; reason: string };

export function shouldUseCurrentLocation(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) {
        return false;
    }
    return LOCATION_REQUEST_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export async function resolveCurrentLocationContext(message: string): Promise<LocationContextResult> {
    if (!shouldUseCurrentLocation(message)) {
        return { status: 'skipped' };
    }

    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') {
        return {
            status: 'permission-denied',
            reason: 'Location permission was not granted.',
        };
    }

    try {
        const position =
            await Location.getLastKnownPositionAsync({
                maxAge: 120_000,
                requiredAccuracy: 500,
            })
            ?? await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

        const latitude = position.coords.latitude.toFixed(5);
        const longitude = position.coords.longitude.toFixed(5);
        const accuracyMeters = typeof position.coords.accuracy === 'number'
            ? Math.round(position.coords.accuracy)
            : undefined;
        const reverseLabel = await buildReverseGeocodeLabel(position.coords.latitude, position.coords.longitude);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const segments = [
            'Mobile location context for this request only.',
            reverseLabel ? `Approximate place: ${reverseLabel}.` : undefined,
            `Coordinates: ${latitude}, ${longitude}.`,
            accuracyMeters ? `Accuracy: about ${accuracyMeters} meters.` : undefined,
            timeZone ? `Timezone: ${timeZone}.` : undefined,
            'Use this only when the user is asking about their current area, nearby places, distance, routing, or local context.',
        ].filter(Boolean);

        return {
            status: 'attached',
            context: segments.join(' '),
        };
    } catch (error) {
        return {
            status: 'unavailable',
            reason: (error as Error).message || 'Current location was unavailable.',
        };
    }
}

async function buildReverseGeocodeLabel(latitude: number, longitude: number): Promise<string | undefined> {
    try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (!place) {
            return undefined;
        }
        const label = [
            place.name,
            place.city ?? place.subregion,
            place.region,
            place.country,
        ]
            .filter((value): value is string => Boolean(value && value.trim()))
            .filter((value, index, values) => values.indexOf(value) === index)
            .join(', ');
        return label || undefined;
    } catch {
        return undefined;
    }
}
