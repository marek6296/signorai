const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let files = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'public' || file === 'dist' || file.startsWith('.')) continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            files = files.concat(walkDir(filePath));
        } else {
            if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.md')) {
                files.push(filePath);
            }
        }
    }
    return files;
}

const filesToSearch = walkDir(process.cwd());

let changedFiles = 0;
for (const file of filesToSearch) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    
    // Replacements
    content = content.replace(/https:\/\/aiwai\.news/g, 'https://aiwai.news');
    content = content.replace(/aiwai\.news/g, 'aiwai.news');
    content = content.replace(/AIWAI NEWS/g, 'AIWAI NEWS');
    content = content.replace(/AIWai/g, 'AIWai');
    content = content.replace(/AIWai News/g, 'AIWai News');
    content = content.replace(/AIWai/g, 'AIWai');
    content = content.replace(/aiwai/g, 'aiwai');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedFiles++;
        console.log(`Replaced in ${file}`);
    }
}
console.log(`Changed ${changedFiles} files`);
