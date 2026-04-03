/**
 * Translate remaining languages that LibreTranslate doesn't support
 * Uses Google Translate with very conservative rate limiting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@vitalets/google-translate-api';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const { translate } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Languages that need translation (have english-template status)
const REMAINING_LANGUAGES = [
  'as', 'ay', 'bm', 'ceb', 'co', 'cy', 'dv', 'ee', 'eo', 'fy', 'gd', 'gn', 
  'haw', 'ht', 'ik', 'iu', 'jv', 'kl', 'kr', 'kri', 'ks', 'la', 'lb', 'lg', 
  'ln', 'lu', 'mh', 'nd', 'ng', 'nr', 'nv', 'ny', 'oc', 'om', 'or', 'os', 
  'pi', 'qu', 'rm', 'rw', 'sa', 'sd', 'sg', 'sm', 'sn', 'ss', 'st', 'su', 
  'tg', 'ti', 'tk', 'tn', 'to', 'ts', 'tt', 'tw', 'ty', 'ug', 'uz', 've', 
  'wa', 'wo', 'xh', 'yi', 'yo', 'za', 'zu'
];

const DELAY_BETWEEN_STRINGS = 10000; // 10 seconds between strings
const DELAY_BETWEEN_LANGUAGES = 60000; // 60 seconds between languages
const MAX_RETRIES = 8;
const INITIAL_RATE_LIMIT_BACKOFF = 180000; // 3 minutes
const MAX_RATE_LIMIT_BACKOFF = 600000; // 10 minutes
const CHECKPOINT_FILE = path.join(__dirname, '.translation-remaining-checkpoint.json');

let consecutiveRateLimits = 0;
let totalTranslated = 0;
let totalSkipped = 0;
let totalErrors = 0;

console.log('🌍 Starting translation of remaining languages...\n');
console.log('⚙️  Configuration:');
console.log(`   - Languages to translate: ${REMAINING_LANGUAGES.length}`);
console.log(`   - Delay between strings: ${DELAY_BETWEEN_STRINGS / 1000}s`);
console.log(`   - Delay between languages: ${DELAY_BETWEEN_LANGUAGES / 1000}s`);
console.log(`   - Max retries: ${MAX_RETRIES}\n`);

// Language code mapping
const LANG_MAP = {
  'zh': 'zh-CN',
  'he': 'iw',
  'jv': 'jw',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomJitter() {
  return Math.floor(Math.random() * 3000); // 0-3 seconds
}

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

function saveCheckpoint(data) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('   ⚠️  Could not save checkpoint:', error.message);
  }
}

async function translateText(text, targetLang, retries = 0) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }
  
  if (!/[a-zA-Z]/.test(text)) {
    return text;
  }
  
  try {
    const googleLang = LANG_MAP[targetLang] || targetLang;
    const result = await translate(text, { to: googleLang, from: 'en' });
    
    consecutiveRateLimits = 0;
    return result.text;
  } catch (error) {
    const errorMsg = error.message || '';
    const isRateLimit = errorMsg.includes('Too Many Requests') || 
                        errorMsg.includes('429') ||
                        errorMsg.includes('rate limit');
    
    if (retries < MAX_RETRIES) {
      let waitTime;
      
      if (isRateLimit) {
        consecutiveRateLimits++;
        waitTime = Math.min(
          INITIAL_RATE_LIMIT_BACKOFF * Math.pow(2, consecutiveRateLimits - 1),
          MAX_RATE_LIMIT_BACKOFF
        );
        console.log(`\n   ⚠️  Rate limit hit (${consecutiveRateLimits} consecutive)! Waiting ${(waitTime / 1000).toFixed(0)}s...`);
      } else {
        waitTime = 10000 * (retries + 1);
      }
      
      await sleep(waitTime);
      return translateText(text, targetLang, retries + 1);
    }
    
    console.error(`\n   ⚠️  Failed: "${text.substring(0, 30)}..." - ${errorMsg}`);
    totalErrors++;
    return text;
  }
}

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

async function translateStrings(strings, targetLang) {
  const result = {};
  const stats = { translated: 0, skipped: 0, errors: 0 };
  
  for (let i = 0; i < strings.length; i++) {
    const item = strings[i];
    
    // Show current string being translated
    const displayText = item.value.length > 50 ? item.value.substring(0, 50) + '...' : item.value;
    process.stdout.write(`\r   [${i + 1}/${strings.length}] Translating: "${displayText}"`);
    
    const translated = await translateText(item.value, targetLang);
    setByPath(result, item.key, translated);
    
    if (translated !== item.value) {
      stats.translated++;
    } else {
      stats.skipped++;
    }
    
    const progress = ((i + 1) / strings.length * 100).toFixed(1);
    process.stdout.write(`\r   Progress: ${progress}% (${i + 1}/${strings.length}) - Last: "${displayText}"`);
    
    if (i < strings.length - 1) {
      const delay = DELAY_BETWEEN_STRINGS + getRandomJitter();
      await sleep(delay);
    }
  }
  
  console.log('');
  return { result, stats };
}

async function translateLanguage(langCode, langName, index, total) {
  const localesDir = path.join(__dirname, 'locales');
  const enPath = path.join(localesDir, 'en.json');
  const targetPath = path.join(localesDir, `${langCode}.json`);
  
  console.log(`\n[${index}/${total}] 🔄 Translating ${langCode} (${langName})...`);
  
  if (index > 1) {
    console.log(`   ⏸️  Waiting ${DELAY_BETWEEN_LANGUAGES / 1000}s before starting...`);
    await sleep(DELAY_BETWEEN_LANGUAGES);
  }
  
  try {
    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    const strings = collectStrings(enContent);
    console.log(`   📝 Found ${strings.length} strings to translate`);
    console.log(`   ⏱️  Estimated time: ~${((strings.length * (DELAY_BETWEEN_STRINGS + 1500)) / 1000 / 60).toFixed(1)} minutes`);
    
    const { result, stats } = await translateStrings(strings, langCode);
    
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    result._meta = {
      languageCode: langCode,
      languageName: langInfo?.nativeName || langCode,
      translationStatus: 'full',
      fallbackLanguage: 'en',
      note: 'Auto-translated using Google Translate API. May need manual review for accuracy.',
      translatedAt: new Date().toISOString(),
      translatedBy: 'Google Translate API (Free)'
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

async function main() {
  const startTime = Date.now();
  let completed = 0;
  
  const checkpoint = loadCheckpoint();
  const completedLanguages = new Set(checkpoint.completedLanguages || []);
  
  if (completedLanguages.size > 0) {
    console.log(`📌 Resuming from checkpoint: ${completedLanguages.size} languages already completed\n`);
  }
  
  const languagesToTranslate = REMAINING_LANGUAGES.filter(
    code => !completedLanguages.has(code)
  );
  
  console.log(`📊 Languages to translate: ${languagesToTranslate.length}`);
  console.log(`⏱️  Estimated total time: ~${((languagesToTranslate.length * 3272 * DELAY_BETWEEN_STRINGS) / 1000 / 60 / 60).toFixed(1)} hours\n`);
  console.log('='.repeat(60));
  
  for (let i = 0; i < languagesToTranslate.length; i++) {
    const langCode = languagesToTranslate[i];
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    
    const result = await translateLanguage(
      langCode,
      langInfo?.nativeName || langCode,
      i + 1,
      languagesToTranslate.length
    );
    
    if (result.success) {
      completed++;
      completedLanguages.add(langCode);
      saveCheckpoint({ completedLanguages: Array.from(completedLanguages) });
    }
    
    const progress = ((i + 1) / languagesToTranslate.length * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const avgTimePerLang = elapsed / (i + 1);
    const remaining = (avgTimePerLang * (languagesToTranslate.length - i - 1)).toFixed(1);
    
    console.log(`   📊 Overall Progress: ${progress}%`);
    console.log(`   ⏱️  Elapsed: ${elapsed} min | Remaining: ~${remaining} min`);
    console.log(`   ✅ Completed: ${completed} | ❌ Errors: ${totalErrors}`);
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
  
  console.log('\n✨ All remaining languages have been translated!');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
