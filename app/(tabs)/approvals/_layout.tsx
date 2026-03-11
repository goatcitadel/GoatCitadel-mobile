/**
 * GoatCitadel Mobile — Approvals tab layout
 */
import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/tokens';

export default function ApprovalsLayout() {
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
