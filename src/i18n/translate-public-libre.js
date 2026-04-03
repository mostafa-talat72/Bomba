/**
 * Translation script using Public LibreTranslate Instance
 * Uses https://libretranslate.com (free public instance with rate limits)
 * 
 * No installation required - just run:
 * node src/i18n/translate-public-libre.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKIP_LANGUAGES = ['ar', 'en', 'fr'];
const BATCH_SIZE = 1; // One at a time for public API
const DELAY_BETWEEN_STRINGS = 2000; // 2 seconds
const DELAY_BETWEEN_LANGUAGES = 10000; // 10 seconds
const MAX_RETRIES = 5;
const CHECKPOINT_FILE = path.join(__dirname, '.translation-checkpoint.json');

// Public LibreTranslate instance
const LIBRE_TRANSLATE_URL = 'https://libretranslate.com';

console.log('🌍 Starting translation with Public LibreTranslate...');
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
 * Translate text using LibreTranslate with retry logic
 */
async function translateText(text, targetLang, retries = 0) {
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
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.translatedText || text;
    
  } catch (error) {
    const isRateLimit = error.message.includes('429') || 
                        error.message.includes('rate limit') ||
                        error.message.includes('Too Many Requests');
    
    if (retries < MAX_RETRIES) {
      const waitTime = isRateLimit ? 30000 : (5000 * (retries + 1));
      
      if (isRateLimit) {
        console.log(`\n   ⏸️  Rate limit hit! Waiting ${waitTime / 1000}s...`);
      }
      
      await sleep(waitTime);
      return translateText(text, targetLang, retries + 1);
    }
    
    console.error(`\n   ⚠️  Failed: "${text.substring(0, 30)}..." - ${error.message}`);
    totalErrors++;
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
 * Translate all strings one at a time
 */
async function translateStrings(strings, targetLang) {
  const result = {};
  const stats = { translated: 0, skipped: 0, errors: 0 };
  
  for (let i = 0; i < strings.length; i++) {
    const item = strings[i];
    
    const translated = await translateText(item.value, targetLang);
    setByPath(result, item.key, translated);
    
    if (translated !== item.value) {
      stats.translated++;
    } else {
      stats.skipped++;
    }
    
    const progress = ((i + 1) / strings.length * 100).toFixed(1);
    process.stdout.write(`\r   Progress: ${progress}% (${i + 1}/${strings.length})`);
    
    if (i < strings.length - 1) {
      await sleep(DELAY_BETWEEN_STRINGS);
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
    console.log(`   ⏱️  Estimated time: ~${((strings.length * DELAY_BETWEEN_STRINGS) / 1000 / 60).toFixed(1)} minutes`);
    
    const { result, stats } = await translateStrings(strings, langCode);
    
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    result._meta = {
      languageCode: langCode,
      languageName: langInfo?.nativeName || langCode,
      translationStatus: 'full',
      fallbackLanguage: 'en',
      note: 'Translated using LibreTranslate (Open Source)',
      translatedAt: new Date().toISOString(),
      translatedBy: 'LibreTranslate Public API'
    };
    
    fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`   ✅ Translated: ${stats.translated} strings`);
    console.log(`   ⏭️  Skipped: ${stats.skipped} strings`);
    if (stats.errors > 0) {
      console.log(`   ⚠️  Errors: ${stats.errors} strings`);
    }
    
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
    console.log('🔍 Testing connection to LibreTranslate...');
    const testResponse = await fetch(`${LIBRE_TRANSLATE_URL}/languages`);
    if (!testResponse.ok) {
      throw new Error('Cannot connect to LibreTranslate server');
    }
    console.log('✅ Connected successfully!\n');
  } catch (error) {
    console.error('❌ Error: Cannot connect to LibreTranslate public server');
    console.log('\n💡 Alternative: Wait for your local server to finish downloading models');
    console.log('   Then run: node src/i18n/translate-libre.js\n');
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
  
  console.log(`📊 Languages to translate: ${languagesToTranslate.length}`);
  console.log(`⏱️  Estimated total time: ~${((languagesToTranslate.length * 3272 * DELAY_BETWEEN_STRINGS) / 1000 / 60 / 60).toFixed(1)} hours\n`);
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
    const avgTimePerLang = elapsed / (i + 1);
    const remaining = (avgTimePerLang * (languagesToTranslate.length - i - 1)).toFixed(1);
    
    console.log(`   📊 Overall Progress: ${progress}%`);
    console.log(`   ⏱️  Elapsed: ${elapsed} min | Remaining: ~${remaining} min`);
    console.log(`   ✅ Completed: ${completed} | ❌ Errors: ${totalErrors}`);
    
    if (i + 1 < languagesToTranslate.length) {
      console.log(`   ⏸️  Waiting ${DELAY_BETWEEN_LANGUAGES / 1000}s before next language...`);
      await sleep(DELAY_BETWEEN_LANGUAGES);
    }
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
