/**
 * Script to copy English translation to all languages
 * 
 * This creates full-sized translation files for all languages
 * using English text as the content. This is faster than translation
 * and provides a complete structure that can be translated later.
 * 
 * Usage: node src/i18n/copy-english-to-all.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FULL_TRANSLATION_LANGUAGES = ['ar', 'en', 'fr'];

console.log('🌍 Creating full translation files for all languages...\n');
console.log('📝 Note: This will copy English text to all languages');
console.log('   You can translate them later manually or with a translation service\n');

const localesDir = path.join(__dirname, 'locales');
const enPath = path.join(localesDir, 'en.json');

// Read English translation
const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

let created = 0;
let skipped = 0;

WORLD_LANGUAGES.forEach((lang) => {
  // Skip languages that already have full translations
  if (FULL_TRANSLATION_LANGUAGES.includes(lang.code)) {
    console.log(`⏭️  Skipped: ${lang.code} (${lang.nativeName}) - already has full translation`);
    skipped++;
    return;
  }

  const filePath = path.join(localesDir, `${lang.code}.json`);
  
  // Create a copy of English content
  const langContent = JSON.parse(JSON.stringify(enContent));
  
  // Update metadata
  if (!langContent._meta) {
    langContent._meta = {};
  }
  
  langContent._meta = {
    languageCode: lang.code,
    languageName: lang.nativeName,
    translationStatus: 'english-template',
    fallbackLanguage: 'en',
    note: 'This file contains English text as template. Translate the values (not keys) to ' + lang.nativeName + '.',
    createdAt: new Date().toISOString()
  };
  
  // Update language name in common section
  if (langContent.common) {
    langContent.common.language = lang.nativeName;
  }
  
  // Write to file
  fs.writeFileSync(
    filePath,
    JSON.stringify(langContent, null, 2),
    'utf-8'
  );
  
  console.log(`✅ Created: ${lang.code} (${lang.nativeName})`);
  created++;
});

console.log('\n📊 Summary:');
console.log(`   ✅ Created: ${created} files`);
console.log(`   ⏭️  Skipped: ${skipped} files`);
console.log(`   📝 Total languages: ${WORLD_LANGUAGES.length}`);

// Calculate total size
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
let totalSize = 0;
files.forEach(file => {
  const stats = fs.statSync(path.join(localesDir, file));
  totalSize += stats.size;
});

console.log(`\n💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log('\n✨ Done!');
console.log('\n💡 Next steps:');
console.log('   1. All languages now have full structure');
console.log('   2. Each file contains English text');
console.log('   3. You can now:');
console.log('      - Use them as-is (English fallback)');
console.log('      - Translate manually');
console.log('      - Use a translation service');
console.log('      - Hire translators');
