const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('app', function(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('SafeAreaView')) {
        let updated = content
            .replace(/<SafeAreaView([\s\S]*?)edges=\{.*?\}\s*>/g, '<View$1>')
            .replace(/<SafeAreaView([\s\S]*?)>/g, '<View$1>')
            .replace(/<\/SafeAreaView>/g, '</View>')
            .replace(/import\s+\{\s*SafeAreaView\s*\}\s+from\s+['"]react-native-safe-area-context['"];?/g, "import { View } from 'react-native';");
        fs.writeFileSync(filePath, updated);
        console.log('Updated', filePath);
    }
});
