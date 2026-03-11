/**
 * GoatCitadel Mobile — Chat tab layout (stack navigator)
 */
import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/tokens';

export default function ChatLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bgCore },
                animation: 'slide_from_right',
            }}
        />
    );
}
