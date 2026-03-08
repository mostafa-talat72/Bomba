/**
 * Script to translate all languages using Google Translate
 * 
 * REQUIREMENTS:
 * 1. Install: npm install @google-cloud/translate
 * 2. Set up Google Cloud project
 * 3. Enable Translation API
 * 4. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
 * 
 * OR use the free unofficial API:
 * npm install @vitalets/google-translate-api
 * 
 * Usage: node src/i18n/translate-with-google.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import translation library
let translate;
try {
  // Try to import the free translation library
  const googleTranslate = await import('@vitalets/google-translate-api');
  translate = googleTranslate.translate || googleTranslate.default || googleTranslate;
  console.log('✅ Using free Google Translate API\n');
} catch (error) {
  console.log('❌ Translation library not found!');
  console.log('\n📦 Please install:');
  console.log('   npm install @vitalets/google-translate-api');
  console.log('\nError:', error.message);
  process.exit(1);
}

const FULL_TRANSLATION_LANGUAGES = ['ar', 'en', 'fr'];

// Language code mapping (i18n code -> Google Translate code)
const languageCodeMap = {
  'zh': 'zh-CN',  // Chinese Simplified
  'he': 'iw',     // Hebrew
  // Add more mappings as needed
};

/**
 * Translate text using Google Translate
 */
async function translateText(text, targetLang) {
  try {
    // Skip if text is empty or just whitespace
    if (!text || !text.trim()) {
      return text;
    }
    
    // Skip if text contains only special characters or numbers
    if (!/[a-zA-Z]/.test(text)) {
      return text;
    }
    
    // Map language code if needed
    const googleLangCode = languageCodeMap[targetLang] || targetLang;
    
    // Translate
    const result = await translate(text, { to: googleLangCode });
    return result.text;
    
  } catch (error) {
    console.error(`   ⚠️  Translation error for "${text}": ${error.message}`);
    return text; // Return original text on error
  }
}

/**
 * Recursively translate an object with rate limiting
 */
async function translateObject(obj, targetLang, path = '', stats = { translated: 0, skipped: 0 }) {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (key === '_meta') {
      // Keep metadata, update status
      result[key] = {
        languageCode: targetLang,
        languageName: WORLD_LANGUAGES.find(l => l.code === targetLang)?.nativeName || targetLang,
        translationStatus: 'full',
        fallbackLanguage: 'en',
        note: 'Translated using Google Translate API. May need manual review.',
        translatedAt: new Date().toISOString()
      };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively translate nested objects
      result[key] = await translateObject(value, targetLang, currentPath, stats);
    } else if (typeof value === 'string') {
      // Translate string values
      const translated = await translateText(value, targetLang);
      result[key] = translated;
      
      if (translated !== value) {
        stats.translated++;
      } else {
        stats.skipped++;
      }
      
      // Rate limiting: small delay every 10 translations
      if (stats.translated % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      // Keep other types as is
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Generate full translation for a language
 */
async function generateFullTranslation(languageCode, languageName) {
  const localesDir = path.join(__dirname, 'locales');
  const enPath = path.join(localesDir, 'en.json');
  const targetPath = path.join(localesDir, `${languageCode}.json`);
  
  console.log(`\n🔄 Translating ${languageCode} (${languageName})...`);
  
  // Read English translation as template
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  
  // Translate the content
  const stats = { translated: 0, skipped: 0 };
  const translated = await translateObject(enContent, languageCode, '', stats);
  
  // Write to file
  fs.writeFileSync(
    targetPath,
    JSON.stringify(translated, null, 2),
    'utf-8'
  );
  
  console.log(`   ✅ Translated: ${stats.translated} strings`);
  console.log(`   ⏭️  Skipped: ${stats.skipped} strings`);
  
  return { translated: stats.translated, skipped: stats.skipped };
}

/**
 * Main function
 */
async function generateAllTranslations() {
  console.log('🌍 Generating FULL translations using Google Translate...\n');
  console.log('⚠️  This will take a LONG time (several hours)');
  console.log('⚠️  This will create ~22 MB of translation files');
  console.log('⚠️  Rate limits may apply\n');
  
  const startTime = Date.now();
  let created = 0;
  let skipped = 0;
  let errors = 0;
  let totalTranslated = 0;
  let totalSkipped = 0;
  
  for (const lang of WORLD_LANGUAGES) {
    try {
      // Skip languages that already have full translations
      if (FULL_TRANSLATION_LANGUAGES.includes(lang.code)) {
        console.log(`⏭️  Skipped: ${lang.code} (${lang.nativeName}) - already has full translation`);
        skipped++;
        continue;
      }
      
      // Generate full translation
      const stats = await generateFullTranslation(lang.code, lang.nativeName);
      totalTranslated += stats.translated;
      totalSkipped += stats.skipped;
      created++;
      
      // Progress indicator
      const progress = ((created + skipped + errors) / WORLD_LANGUAGES.length * 100).toFixed(1);
      console.log(`   📊 Progress: ${progress}% (${created + skipped + errors}/${WORLD_LANGUAGES.length})`);
      
    } catch (error) {
      console.error(`❌ Error: ${lang.code} (${lang.nativeName}) - ${error.message}`);
      errors++;
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${created} full translations`);
  console.log(`⏭️  Skipped: ${skipped} (already full)`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📝 Total languages: ${WORLD_LANGUAGES.length}`);
  console.log(`🔤 Total strings translated: ${totalTranslated}`);
  console.log(`⏭️  Total strings skipped: ${totalSkipped}`);
  console.log(`⏱️  Time taken: ${duration} minutes`);
  
  // Calculate total size
  const localesDir = path.join(__dirname, 'locales');
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  let totalSize = 0;
  files.forEach(file => {
    const stats = fs.statSync(path.join(localesDir, file));
    totalSize += stats.size;
  });
  
  console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('='.repeat(60));
  
  console.log('\n⚠️  IMPORTANT: Review translations manually!');
  console.log('   Machine translations may not be 100% accurate.');
  console.log('   Consider hiring native speakers for review.');
}

// Run the script
try {
  await generateAllTranslations();
  console.log('\n✨ Done!');
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
