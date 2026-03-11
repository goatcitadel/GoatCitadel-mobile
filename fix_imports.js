const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        fs.statSync(dirPath).isDirectory() ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir('app', function(filePath) {
    if (!filePath.endsWith('.tsx')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if View is imported more than once.
    // Usually it's in `import { View, Text ... } from 'react-native';`
    // And my script added `import { View } from 'react-native';`
    
    // Replace the exact line my script added if there is another 'react-native' import that already has View.
    // Or simpler: just match `\nimport { View } from 'react-native';`
    if (content.match(/import\s+{\s*View[\s\S]*?from\s+['"]react-native['"]/g)?.length > 1) {
        content = content.replace(/\r?\nimport\s+{\s*View\s*}\s+from\s+['"]react-native['"];/, '');
        fs.writeFileSync(filePath, content);
        console.log('Fixed', filePath);
    }
});
