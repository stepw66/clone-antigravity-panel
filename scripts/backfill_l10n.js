const fs = require('fs');
const path = require('path');

const l10nDir = path.resolve(__dirname, '../l10n');
const baseFile = path.join(l10nDir, 'bundle.l10n.json');

if (!fs.existsSync(baseFile)) {
    console.error('Base bundle not found at', baseFile);
    process.exit(1);
}

const baseContent = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
const baseKeys = Object.keys(baseContent);

const files = fs.readdirSync(l10nDir).filter(f => f.endsWith('.json') && f !== 'bundle.l10n.json');

files.forEach(file => {
    const filePath = path.join(l10nDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let modified = false;

    baseKeys.forEach(key => {
        if (!content.hasOwnProperty(key)) {
            content[key] = key; // Fallback to key (English)
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 4), 'utf8');
        console.log(`✅ Backfilled missing keys in ${file}`);
    } else {
        console.log(`- ${file} is up to date`);
    }
});
