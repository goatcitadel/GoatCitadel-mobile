const expoPreset = require('jest-expo/jest-preset');

module.exports = {
    ...expoPreset,
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts', '**/*.test.tsx'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transformIgnorePatterns: expoPreset.transformIgnorePatterns,
};
