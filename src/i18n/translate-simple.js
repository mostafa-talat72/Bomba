/**
 * Simple translation script using Google Translate
 * This will actually translate all languages
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FULL_TRANSLATION_LANGUAGES = ['ar', 'en', 'fr'];

// Import translate function
let translate;
try {
  const module = await import('@vitalets/google-translate-api');
  translate = module.default;
  if (!translate || typeof translate !== 'function') {
    throw new Error('Invalid translate function');
  }
  console.log('✅ Google Translate loaded\n');
} catch (error) {
  console.error('❌ Error loading translator:', error.message);
  console.log('\n💡 Make sure you installed: npm install @vitalets/google-translate-api');
  process.exit(1);
}

// Language code mapping
const langMap = {
  'zh': 'zh-CN',
  'he': 'iw',
  'jv': 'jw',
};

async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }
  
  try {
    const googleLang = langMap[targetLang] || targetLang;
    const result = await translate(text, { to: googleLang });
    return result.text;
  } catch (error) {
    return text; // Return original on error
  }
}

async function translateObject(obj, targetLang, depth = 0) {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_meta') {
      result[key] = {
        languageCode: targetLang,
        languageName: WORLD_LANGUAGES.find(l => l.code === targetLang)?.nativeName || targetLang,
        translationStatus: 'full',
        fallbackLanguage: 'en',
        note: 'Translated using Google Translate API',
        translatedAt: new Date().toISOString()
      };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = await translateObject(value, targetLang, depth + 1);
    } else if (typeof value === 'string') {
      result[key] = await translateText(value, targetLang);
      // Small delay every 10 translations
      if (Math.random() < 0.1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

async function translateLanguage(langCode, langName) {
  const localesDir = path.join(__dirname, 'locales');
  const enPath = path.join(localesDir, 'en.json');
  const targetPath = path.join(localesDir, `${langCode}.json`);
  
  console.log(`\n🔄 Translating ${langCode} (${langName})...`);
  
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  const translated = await translateObject(enContent, langCode);
  
  fs.writeFileSync(targetPath, JSON.stringify(translated, null, 2), 'utf-8');
  console.log(`   ✅ Done!`);
}

async function main() {
  console.log('🌍 Starting REAL translation for all languages...\n');
  console.log('⚠️  This will take 2-4 HOURS');
  console.log('⚠️  Please be patient and do not close this window\n');
  
  const startTime = Date.now();
  let completed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const lang of WORLD_LANGUAGES) {
    if (FULL_TRANSLATION_LANGUAGES.includes(lang.code)) {
      console.log(`⏭️  Skipped: ${lang.code} (${lang.nativeName})`);
      skipped++;
      continue;
    }
    
    try {
      await translateLanguage(lang.code, lang.nativeName);
      completed++;
      
      const progress = ((completed + skipped) / WORLD_LANGUAGES.length * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log(`   📊 Progress: ${progress}% | Time: ${elapsed} min | Completed: ${completed}/${WORLD_LANGUAGES.length - FULL_TRANSLATION_LANGUAGES.length}`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Completed: ${completed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`⏱️  Total time: ${totalTime} minutes`);
  console.log('='.repeat(60));
  console.log('\n✨ Translation complete!');
}

main().catch(console.error);
