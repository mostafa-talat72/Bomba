/**
 * Direct API Translation - Faster and more reliable
 * Uses Google Translate internal API
 * 
 * Run: node src/i18n/translate-api-direct.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all languages from WORLD_LANGUAGES (excluding Arabic as it's the source language)
const ALL_LANGUAGES = WORLD_LANGUAGES
  .filter(lang => lang.code !== 'ar') // Exclude Arabic (source language)
  .map(lang => lang.code);

console.log(`📋 Total languages in WORLD_LANGUAGES: ${WORLD_LANGUAGES.length}`);
console.log(`🌍 Languages to check/translate: ${ALL_LANGUAGES.length}`);
console.log(`⏭️  Excluded (source language): ar\n`);

const DELAY_BETWEEN_STRINGS = 500; // 500ms - very safe rate
const DELAY_BETWEEN_BATCHES = 10000; // 10 seconds between batches
const BATCH_SIZE = 50; // Process 50 strings at once (very safe batch size)
const DELAY_BETWEEN_LANGUAGES = 20000; // 20 seconds between languages
const MAX_RETRIES = 5; // Maximum retries for failed translations
const INITIAL_RETRY_DELAY = 5000; // 5 seconds initial delay before retry
const MAX_RETRY_DELAY = 60000; // Max 60 seconds between retries
const CHECKPOINT_FILE = path.join(__dirname, '.translation-api-checkpoint.json');

console.log('🚀 Direct API Translation - Fast & Reliable!\n');
console.log('⚙️  Configuration:');
console.log(`   - Total languages to check: ${ALL_LANGUAGES.length}`);
console.log(`   - Batch size: ${BATCH_SIZE} strings`);
console.log(`   - Delay between strings: ${DELAY_BETWEEN_STRINGS}ms`);
console.log(`   - Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
console.log(`   - Delay between languages: ${DELAY_BETWEEN_LANGUAGES}ms`);
console.log(`   - Max retries per string: ${MAX_RETRIES}`);
console.log(`   - Method: Google Translate Internal API`);
console.log(`   - Verification: Full quality check on all languages\n`);

let totalTranslated = 0;
let totalSkipped = 0;
let totalErrors = 0;
let isShuttingDown = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    }
  } catch (error) {
    console.log('   ⚠️  Could not load checkpoint, starting fresh');
  }
  return { completedLanguages: [], skippedLanguages: [] };
}

function saveCheckpoint(data) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('   ⚠️  Could not save checkpoint:', error.message);
  }
}

/**
 * Translate using Google Translate internal API with retry logic
 * Source language: Arabic (ar)
 */
async function translateText(text, targetLang, retryCount = 0) {
  // Return empty strings as-is
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }
  
  // Calculate exponential backoff delay
  const retryDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
  
  return new Promise((resolve) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${targetLang}&dt=t&q=${encodedText}`;
    
    const req = https.get(url, (res) => {
      let data = '';
      
      // Check if response is HTML (rate limited or blocked)
      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        console.error(`   ⚠️  Rate limited (HTML response) for "${text.substring(0, 30)}..."`);
        if (retryCount < MAX_RETRIES) {
          console.log(`   🔄 Retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(async () => {
            const result = await translateText(text, targetLang, retryCount + 1);
            resolve(result);
          }, retryDelay);
        } else {
          totalErrors++;
          console.error(`   ❌ Max retries reached, keeping original text`);
          resolve(text);
        }
        return;
      }
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Check if data starts with HTML
          if (data.trim().startsWith('<')) {
            throw new Error('HTML response instead of JSON');
          }
          
          const parsed = JSON.parse(data);
          if (parsed && parsed[0] && parsed[0][0] && parsed[0][0][0]) {
            const translated = parsed[0][0][0];
            resolve(translated);
          } else {
            console.error(`   ⚠️  Invalid response structure for "${text.substring(0, 30)}..."`);
            if (retryCount < MAX_RETRIES) {
              console.log(`   🔄 Retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
              setTimeout(async () => {
                const result = await translateText(text, targetLang, retryCount + 1);
                resolve(result);
              }, retryDelay);
            } else {
              totalErrors++;
              resolve(text);
            }
          }
        } catch (parseError) {
          console.error(`   ⚠️  Parse error for "${text.substring(0, 30)}...": ${parseError.message}`);
          if (retryCount < MAX_RETRIES) {
            console.log(`   🔄 Retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            setTimeout(async () => {
              const result = await translateText(text, targetLang, retryCount + 1);
              resolve(result);
            }, retryDelay);
          } else {
            totalErrors++;
            resolve(text);
          }
        }
      });
    });
    
    req.on('error', (httpError) => {
      console.error(`   ⚠️  HTTP error for "${text.substring(0, 30)}...": ${httpError.message}`);
      if (retryCount < MAX_RETRIES) {
        console.log(`   🔄 Retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(async () => {
          const result = await translateText(text, targetLang, retryCount + 1);
          resolve(result);
        }, retryDelay);
      } else {
        totalErrors++;
        resolve(text);
      }
    });
    
    // Set timeout for request
    req.setTimeout(15000, () => {
      req.destroy();
      console.error(`   ⚠️  Request timeout for "${text.substring(0, 30)}..."`);
      if (retryCount < MAX_RETRIES) {
        console.log(`   🔄 Retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(async () => {
          const result = await translateText(text, targetLang, retryCount + 1);
          resolve(result);
        }, retryDelay);
      } else {
        totalErrors++;
        resolve(text);
      }
    });
  });
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

async function translateStrings(strings, targetLang, targetPath, langName) {
  const result = {};
  const stats = { translated: 0, skipped: 0, errors: 0 };
  
  // Load existing progress if file exists
  let startIndex = 0;
  if (fs.existsSync(targetPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      if (existing._meta?.translationProgress) {
        startIndex = existing._meta.translationProgress;
        Object.assign(result, existing);
        console.log(`   📌 Resuming from ${startIndex}/${strings.length}`);
      }
    } catch (e) {
      // Ignore, start fresh
    }
  }
  
  for (let i = startIndex; i < strings.length; i++) {
    if (isShuttingDown) {
      console.log(`\n   [${langName}] Shutdown requested, saving progress...`);
      const langInfo = WORLD_LANGUAGES.find(l => l.code === targetLang);
      result._meta = {
        languageCode: targetLang,
        languageName: langInfo?.nativeName || targetLang,
        translationStatus: 'in-progress',
        translationProgress: i,
        fallbackLanguage: 'ar',
        sourceLanguage: 'ar',
        note: 'Translated from Arabic using Google Translate API - Interrupted',
        translatedAt: new Date().toISOString(),
        translatedBy: 'Google Translate API'
      };
      fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
      return { result, stats, interrupted: true };
    }
    
    const item = strings[i];
    
    // Translate the text
    const translated = await translateText(item.value, targetLang);
    setByPath(result, item.key, translated);
    
    // Count as translated if the result is different OR if it's a valid translation
    // (some words might be the same in multiple languages)
    if (translated !== item.value) {
      stats.translated++;
    } else {
      // Even if the text is the same, it's still processed
      stats.skipped++;
    }
    
    // Show progress every BATCH_SIZE strings
    if (i % BATCH_SIZE === 0 || i === strings.length - 1) {
      const progress = ((i + 1) / strings.length * 100).toFixed(1);
      const displayText = item.value.length > 30 ? item.value.substring(0, 30) + '...' : item.value;
      const displayTranslated = translated.length > 30 ? translated.substring(0, 30) + '...' : translated;
      console.log(`   [${progress}%] ${i + 1}/${strings.length} | "${displayText}" → "${displayTranslated}"`);
      
      // Save intermediate progress
      const langInfo = WORLD_LANGUAGES.find(l => l.code === targetLang);
      result._meta = {
        languageCode: targetLang,
        languageName: langInfo?.nativeName || targetLang,
        translationStatus: i === strings.length - 1 ? 'full' : 'in-progress',
        translationProgress: i + 1,
        fallbackLanguage: 'ar',
        sourceLanguage: 'ar',
        note: 'Translated from Arabic using Google Translate API',
        translatedAt: new Date().toISOString(),
        translatedBy: 'Google Translate API'
      };
      
      fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
      
      // Pause between batches (except for the last item)
      if (i < strings.length - 1) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    } else {
      // Small delay between individual strings within a batch
      if (i < strings.length - 1) {
        await sleep(DELAY_BETWEEN_STRINGS);
      }
    }
  }
  
  return { result, stats, interrupted: false };
}

function checkIfTranslationComplete(targetPath, totalStrings) {
  try {
    if (!fs.existsSync(targetPath)) {
      return { complete: false, needsTranslation: true, reason: 'File does not exist' };
    }
    
    const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    const translatedStrings = collectStrings(content);
    
    // Check if number of strings matches
    if (translatedStrings.length < totalStrings) {
      return { 
        complete: false, 
        needsTranslation: true, 
        reason: `Missing strings (${translatedStrings.length}/${totalStrings})`,
        existingStrings: translatedStrings.length
      };
    }
    
    // Check if _meta exists and has translationStatus
    if (!content._meta || content._meta.translationStatus !== 'full') {
      return { 
        complete: false, 
        needsTranslation: true, 
        reason: 'Missing or incomplete _meta',
        existingStrings: translatedStrings.length
      };
    }
    
    // Check for empty or untranslated strings
    let emptyCount = 0;
    let untranslatedCount = 0;
    
    for (const item of translatedStrings) {
      if (!item.value || item.value.trim() === '') {
        emptyCount++;
      }
      // Check if value is same as key (might indicate untranslated)
      if (item.value === item.key) {
        untranslatedCount++;
      }
    }
    
    if (emptyCount > 0 || untranslatedCount > 0) {
      return {
        complete: false,
        needsTranslation: true,
        reason: `Quality issues (${emptyCount} empty, ${untranslatedCount} untranslated)`,
        existingStrings: translatedStrings.length
      };
    }
    
    // All checks passed
    return { 
      complete: true, 
      needsTranslation: false, 
      count: translatedStrings.length,
      reason: 'Complete and verified'
    };
  } catch (error) {
    return { 
      complete: false, 
      needsTranslation: true, 
      reason: `Error: ${error.message}` 
    };
  }
}

async function translateLanguage(langCode, langName, index, total) {
  const localesDir = path.join(__dirname, 'locales');
  const arPath = path.join(localesDir, 'ar.json');
  const targetPath = path.join(localesDir, `${langCode}.json`);
  
  console.log(`\n[${index}/${total}] 🔍 Checking ${langCode} (${langName})...`);
  
  try {
    const arContent = JSON.parse(fs.readFileSync(arPath, 'utf-8'));
    const strings = collectStrings(arContent);
    
    // Check if translation is complete and valid
    const checkResult = checkIfTranslationComplete(targetPath, strings.length);
    
    console.log(`   📊 Status: ${checkResult.reason}`);
    
    if (checkResult.complete && !checkResult.needsTranslation) {
      console.log(`   ✅ Verified complete (${checkResult.count} strings) - Skipping`);
      return { success: true, skipped: true };
    }
    
    // Needs translation or re-translation
    if (checkResult.existingStrings) {
      console.log(`   � Re-translating to fix issues (had ${checkResult.existingStrings} strings)`);
    } else {
      console.log(`   🆕 Starting fresh translation`);
    }
    
    console.log(`   📝 Total strings to translate: ${strings.length}`);
    const batchCount = Math.ceil(strings.length / BATCH_SIZE);
    const estimatedTimePerBatch = (BATCH_SIZE * DELAY_BETWEEN_STRINGS + DELAY_BETWEEN_BATCHES) / 1000;
    const estimatedTotalTime = (batchCount * estimatedTimePerBatch) / 60;
    console.log(`   📦 Batches: ${batchCount} (${BATCH_SIZE} strings each)`);
    console.log(`   ⏱️  Estimated time: ~${estimatedTotalTime.toFixed(1)} minutes`);
    
    if (index > 1) {
      console.log(`   ⏸️  Waiting ${DELAY_BETWEEN_LANGUAGES / 1000}s before starting...`);
      await sleep(DELAY_BETWEEN_LANGUAGES);
    }
    
    const { result, stats, interrupted } = await translateStrings(strings, langCode, targetPath, langName);
    
    if (interrupted) {
      return { success: false, interrupted: true };
    }
    
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    result._meta = {
      languageCode: langCode,
      languageName: langInfo?.nativeName || langCode,
      translationStatus: 'full',
      fallbackLanguage: 'ar',
      sourceLanguage: 'ar',
      note: 'Translated from Arabic using Google Translate API',
      translatedAt: new Date().toISOString(),
      translatedBy: 'Google Translate API'
    };
    delete result._meta.translationProgress;
    
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
  let skipped = 0;
  
  // Setup graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Shutdown signal received (Ctrl+C)');
    console.log('📝 Saving current progress...');
    isShuttingDown = true;
  });
  
  const checkpoint = loadCheckpoint();
  const completedLanguages = new Set(checkpoint.completedLanguages || []);
  const skippedLanguages = new Set(checkpoint.skippedLanguages || []);
  
  if (completedLanguages.size > 0) {
    console.log(`📌 Resuming from checkpoint: ${completedLanguages.size} languages already completed\n`);
  }
  
  const languagesToCheck = ALL_LANGUAGES.filter(
    code => !completedLanguages.has(code) && !skippedLanguages.has(code)
  );
  
  console.log(`� Languages to check/translate: ${languagesToCheck.length}`);
  console.log(`✅ Already completed: ${completedLanguages.size}`);
  console.log(`⏭️  Already skipped: ${skippedLanguages.size}`);
  const avgStringsPerLang = 3272; // Average from ar.json
  const batchCount = Math.ceil(avgStringsPerLang / BATCH_SIZE);
  const timePerLang = (batchCount * (BATCH_SIZE * DELAY_BETWEEN_STRINGS + DELAY_BETWEEN_BATCHES) / 1000 / 60);
  const totalEstimatedTime = (languagesToCheck.length * timePerLang) / 60;
  console.log(`⏱️  Estimated total time: ~${totalEstimatedTime.toFixed(1)} hours (~${timePerLang.toFixed(1)} min per language)`);
  console.log(`💡 Press Ctrl+C anytime to save progress and exit safely\n`);
  console.log('='.repeat(60));
  
  for (let i = 0; i < languagesToCheck.length; i++) {
    if (isShuttingDown) {
      console.log('\n🛑 Shutdown in progress...');
      break;
    }
    
    const langCode = languagesToCheck[i];
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    
    const result = await translateLanguage(
      langCode,
      langInfo?.nativeName || langCode,
      i + 1,
      languagesToCheck.length
    );
    
    if (result.interrupted) {
      break;
    }
    
    if (result.success) {
      if (result.skipped) {
        skipped++;
        skippedLanguages.add(langCode);
      } else {
        completed++;
        completedLanguages.add(langCode);
      }
      saveCheckpoint({ 
        completedLanguages: Array.from(completedLanguages),
        skippedLanguages: Array.from(skippedLanguages)
      });
    }
    
    const progress = ((i + 1) / languagesToCheck.length * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const avgTimePerLang = elapsed / (i + 1);
    const remaining = (avgTimePerLang * (languagesToCheck.length - i - 1)).toFixed(1);
    
    console.log(`   📊 Overall Progress: ${progress}%`);
    console.log(`   ⏱️  Elapsed: ${elapsed} min | Remaining: ~${remaining} min`);
    console.log(`   ✅ Translated: ${completed} | ⏭️  Skipped: ${skipped} | ❌ Errors: ${totalErrors}`);
  }
  
  if (isShuttingDown) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  TRANSLATION INTERRUPTED');
    console.log('='.repeat(60));
    console.log(`✅ Languages translated: ${completed}`);
    console.log(`⏭️  Languages skipped (already done): ${skipped}`);
    console.log(`📝 Progress saved! Run again to resume`);
    console.log('='.repeat(60));
    return;
  }
  
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 TRANSLATION VERIFICATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Languages translated/fixed: ${completed}`);
  console.log(`⏭️  Languages verified (already complete): ${skipped}`);
  console.log(`🔤 Total strings translated: ${totalTranslated.toLocaleString()}`);
  console.log(`🌍 Total languages checked: ${ALL_LANGUAGES.length}`);
  console.log(`⏱️  Total time: ${totalTime} minutes`);
  console.log('='.repeat(60));
  
  // Summary of all languages
  const localesDir = path.join(__dirname, 'locales');
  const allFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  console.log(`\n📁 Total translation files: ${allFiles.length}`);
  console.log(`📋 Expected languages: ${WORLD_LANGUAGES.length}`);
  
  if (allFiles.length >= WORLD_LANGUAGES.length) {
    console.log(`✅ All languages have translation files!`);
  } else {
    console.log(`⚠️  Missing ${WORLD_LANGUAGES.length - allFiles.length} language files`);
  }
  
  // Detailed verification summary
  console.log(`\n🔍 Verification Summary:`);
  console.log(`   - Verified complete: ${skipped} languages`);
  console.log(`   - Needed translation: ${completed} languages`);
  console.log(`   - Total checked: ${completed + skipped} languages`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
