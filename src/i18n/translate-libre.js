/**
 * Translation script using LibreTranslate (Free & Open Source)
 * 
 * Setup:
 * 1. Install LibreTranslate: pip install libretranslate
 * 2. Run server: libretranslate --host 0.0.0.0 --port 5001
 * 3. Run this script: node src/i18n/translate-libre.js
 * 
 * Alternative: Use public instance at https://libretranslate.com (has rate limits)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKIP_LANGUAGES = ['ar', 'en', 'fr'];
const BATCH_SIZE = 10; // Smaller batches for free service
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
const CHECKPOINT_FILE = path.join(__dirname, '.translation-checkpoint.json');

// LibreTranslate server URL
const LIBRE_TRANSLATE_URL = process.env.LIBRE_TRANSLATE_URL || 'http://127.0.0.1:5001';

console.log('🌍 Starting translation with LibreTranslate...');
console.log(`📡 Using server: ${LIBRE_TRANSLATE_URL}\n`);

let totalTranslated = 0;
let totalSkipped = 0;
let totalErrors = 0;

/**
 * Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load checkpoint
 */
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    }
  } catch (error) {
    console.log('   ⚠️  Could not load checkpoint, starting fresh');
  }
  return { completedLanguages: [] };
}

/**
 * Save checkpoint
 */
function saveCheckpoint(data) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('   ⚠️  Could not save checkpoint:', error.message);
  }
}

/**
 * Translate text using LibreTranslate
 */
async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }
  
  if (!/[a-zA-Z]/.test(text)) {
    return text;
  }
  
  try {
    const response = await fetch(`${LIBRE_TRANSLATE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: targetLang,
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.translatedText || text;
    
  } catch (error) {
    console.error(`\n   ⚠️  Translation error: ${error.message}`);
    return text;
  }
}

/**
 * Collect all strings from an object
 */
function collectStrings(obj, prefix = '') {
  const strings = [];
  
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_meta') continue;
    
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      strings.push(...collectStrings(value, fullKey));
    } else if (typeof value === 'string') {
      strings.push({ key: fullKey, value });
    }
  }
  
  return strings;
}

/**
 * Set value in nested object by path
 */
function setByPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * Translate all strings in batches
 */
async function translateStrings(strings, targetLang) {
  const result = {};
  const stats = { translated: 0, skipped: 0, errors: 0 };
  
  for (let i = 0; i < strings.length; i += BATCH_SIZE) {
    const batch = strings.slice(i, i + BATCH_SIZE);
    
    for (const item of batch) {
      const translated = await translateText(item.value, targetLang);
      setByPath(result, item.key, translated);
      
      if (translated !== item.value) {
        stats.translated++;
      } else {
        stats.skipped++;
      }
    }
    
    const progress = Math.min(100, ((i + BATCH_SIZE) / strings.length * 100)).toFixed(1);
    process.stdout.write(`\r   Progress: ${progress}% (${Math.min(i + BATCH_SIZE, strings.length)}/${strings.length})`);
    
    if (i + BATCH_SIZE < strings.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log('');
  return { result, stats };
}

/**
 * Translate a single language
 */
async function translateLanguage(langCode, langName, index, total) {
  const localesDir = path.join(__dirname, 'locales');
  const enPath = path.join(localesDir, 'en.json');
  const targetPath = path.join(localesDir, `${langCode}.json`);
  
  console.log(`\n[${index}/${total}] 🔄 Translating ${langCode} (${langName})...`);
  
  try {
    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    const strings = collectStrings(enContent);
    console.log(`   📝 Found ${strings.length} strings to translate`);
    
    const { result, stats } = await translateStrings(strings, langCode);
    
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    result._meta = {
      languageCode: langCode,
      languageName: langInfo?.nativeName || langCode,
      translationStatus: 'full',
      fallbackLanguage: 'en',
      note: 'Translated using LibreTranslate (Open Source)',
      translatedAt: new Date().toISOString(),
      translatedBy: 'LibreTranslate'
    };
    
    fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`   ✅ Translated: ${stats.translated} strings`);
    console.log(`   ⏭️  Skipped: ${stats.skipped} strings`);
    
    totalTranslated += stats.translated;
    totalSkipped += stats.skipped;
    
    return { success: true, stats };
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    totalErrors++;
    return { success: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  // Test connection first
  try {
    const testResponse = await fetch(`${LIBRE_TRANSLATE_URL}/languages`);
    if (!testResponse.ok) {
      throw new Error('Cannot connect to LibreTranslate server');
    }
    console.log('✅ Connected to LibreTranslate server\n');
  } catch (error) {
    console.error('❌ Error: Cannot connect to LibreTranslate server');
    console.log('\n📝 Setup instructions:');
    console.log('   1. Install: pip install libretranslate');
    console.log('   2. Run server: libretranslate --host 0.0.0.0 --port 5001');
    console.log('   3. Or set LIBRE_TRANSLATE_URL to use a different server\n');
    process.exit(1);
  }
  
  const startTime = Date.now();
  let completed = 0;
  
  const checkpoint = loadCheckpoint();
  const completedLanguages = new Set(checkpoint.completedLanguages || []);
  
  if (completedLanguages.size > 0) {
    console.log(`📌 Resuming from checkpoint: ${completedLanguages.size} languages already completed\n`);
  }
  
  const languagesToTranslate = WORLD_LANGUAGES.filter(
    lang => !SKIP_LANGUAGES.includes(lang.code) && !completedLanguages.has(lang.code)
  );
  
  console.log(`📊 Languages to translate: ${languagesToTranslate.length}\n`);
  console.log('='.repeat(60));
  
  for (let i = 0; i < languagesToTranslate.length; i++) {
    const lang = languagesToTranslate[i];
    
    const result = await translateLanguage(
      lang.code,
      lang.nativeName,
      i + 1,
      languagesToTranslate.length
    );
    
    if (result.success) {
      completed++;
      completedLanguages.add(lang.code);
      saveCheckpoint({ completedLanguages: Array.from(completedLanguages) });
    }
    
    const progress = ((i + 1) / languagesToTranslate.length * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log(`   📊 Overall Progress: ${progress}%`);
    console.log(`   ⏱️  Elapsed: ${elapsed} min`);
    console.log(`   ✅ Completed: ${completed}`);
  }
  
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 TRANSLATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Languages translated: ${completed}`);
  console.log(`🔤 Total strings translated: ${totalTranslated.toLocaleString()}`);
  console.log(`⏱️  Total time: ${totalTime} minutes`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
