const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

function withLanNetworkSecurity(config) {
    config = withAndroidManifest(config, (nextConfig) => {
        const app = AndroidConfig.Manifest.getMainApplicationOrThrow(nextConfig.modResults);
        app.$['android:usesCleartextTraffic'] = 'true';
        app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
        return nextConfig;
    });

    config = withDangerousMod(config, ['android', async (nextConfig) => {
        const xmlDir = path.join(
            nextConfig.modRequest.platformProjectRoot,
            'app',
            'src',
            'main',
            'res',
            'xml',
        );
        await fs.mkdir(xmlDir, { recursive: true });
        await fs.writeFile(path.join(xmlDir, 'network_security_config.xml'), NETWORK_SECURITY_XML, 'utf8');
        return nextConfig;
    }]);

    return config;
}

module.exports = withLanNetworkSecurity;
