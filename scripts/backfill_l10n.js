const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nlsBaseFile = path.join(rootDir, 'package.nls.json');

if (!fs.existsSync(nlsBaseFile)) {
    console.error('Base package.nls.json not found at', nlsBaseFile);
    process.exit(1);
}

const nlsBaseContent = JSON.parse(fs.readFileSync(nlsBaseFile, 'utf8'));
const nlsBaseKeys = Object.keys(nlsBaseContent);

let hasErrors = false;

// 1. Check package.nls.*.json files in root
console.log('\n📦 Checking package.nls.*.json files...\n');
const nlsFiles = fs.readdirSync(rootDir).filter(f => f.startsWith('package.nls.') && f.endsWith('.json') && f !== 'package.nls.json');

nlsFiles.forEach(file => {
    const filePath = path.join(rootDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const missingKeys = [];
    const extraKeys = [];

    // Check for missing keys
    nlsBaseKeys.forEach(key => {
        if (!content.hasOwnProperty(key)) {
            missingKeys.push(key);
        }
    });

    // Check for extra keys (not in base)
    Object.keys(content).forEach(key => {
        if (!nlsBaseContent.hasOwnProperty(key)) {
            extraKeys.push(key);
        }
    });

    if (missingKeys.length > 0 || extraKeys.length > 0) {
        hasErrors = true;
        console.log(`❌ ${file}:`);
        if (missingKeys.length > 0) {
            console.log(`   Missing keys (${missingKeys.length}):`);
            missingKeys.forEach(k => console.log(`     - ${k}`));
        }
        if (extraKeys.length > 0) {
            console.log(`   Extra keys (${extraKeys.length}) - should be removed:`);
            extraKeys.forEach(k => console.log(`     - ${k}`));
        }
    } else {
        console.log(`✅ ${file} - OK`);
    }
});

// 2. Check bundle.l10n.*.json files in l10n directory
console.log('\n📦 Checking l10n/bundle.l10n.*.json files...\n');
const l10nDir = path.join(rootDir, 'l10n');
const l10nBaseFile = path.join(l10nDir, 'bundle.l10n.json');

if (!fs.existsSync(l10nBaseFile)) {
    console.error('Base bundle.l10n.json not found at', l10nBaseFile);
    process.exit(1);
}

const l10nBaseContent = JSON.parse(fs.readFileSync(l10nBaseFile, 'utf8'));
const l10nBaseKeys = Object.keys(l10nBaseContent);

const l10nFiles = fs.readdirSync(l10nDir).filter(f => f.startsWith('bundle.l10n.') && f.endsWith('.json') && f !== 'bundle.l10n.json');

l10nFiles.forEach(file => {
    const filePath = path.join(l10nDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const missingKeys = [];

    l10nBaseKeys.forEach(key => {
        if (!content.hasOwnProperty(key)) {
            missingKeys.push(key);
        }
    });

    if (missingKeys.length > 0) {
        hasErrors = true;
        console.log(`❌ ${file}:`);
        console.log(`   Missing keys (${missingKeys.length}):`);
        missingKeys.forEach(k => console.log(`     - ${k}`));
    } else {
        console.log(`✅ ${file} - OK`);
    }
});

console.log('\n' + (hasErrors ? '⚠️  Some files have missing or extra keys. Please add translations manually.' : '✅ All translation files are complete!') + '\n');

process.exit(hasErrors ? 1 : 0);
