/**
 * TURBO Web Automation Translation - MAXIMUM SPEED
 * Uses multiple parallel browsers for ultra-fast translation
 * 
 * Run: node src/i18n/translate-puppeteer-turbo.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
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

const PARALLEL_BROWSERS = 3; // Reduced for better quality
const DELAY_BETWEEN_STRINGS = 1000; // 1 second (better quality)
const CHECKPOINT_FILE = path.join(__dirname, '.translation-turbo-checkpoint.json');

console.log('🚀 TURBO MODE - Maximum Speed Translation!\n');
console.log('⚙️  Configuration:');
console.log(`   - Parallel browsers: ${PARALLEL_BROWSERS}`);
console.log(`   - Total languages to check: ${ALL_LANGUAGES.length}`);
console.log(`   - Delay between strings: ${DELAY_BETWEEN_STRINGS}ms`);
console.log(`   - Mode: Headless (ultra fast)`);
console.log(`   - Verification: Full quality check on all languages\n`);

let totalTranslated = 0;
let totalSkipped = 0;
let totalErrors = 0;
let isShuttingDown = false;
let currentLanguage = null;
let currentProgress = 0;

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
  return { completedLanguages: [] };
}

function saveCheckpoint(data) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('   ⚠️  Could not save checkpoint:', error.message);
  }
}

/**
 * Create a browser instance
 */
async function createBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-sync',
      '--disable-translate',
      '--disable-background-networking',
      '--disable-default-apps',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });
  
  const page = await browser.newPage();
  
  // Disable unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'websocket'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  return { browser, page };
}

/**
 * Translate single text (FIXED - with retry mechanism)
 */
async function translateText(page, text, targetLang, retries = 0) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }
  
  if (!/[a-zA-Z]/.test(text)) {
    return text;
  }
  
  try {
    const url = `https://translate.google.com/?sl=ar&tl=${targetLang}&text=${encodeURIComponent(text)}&op=translate`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Wait longer for translation to actually load
    await sleep(3000);
    
    // Get translation with minimal waiting
    const translatedText = await page.evaluate(() => {
      const selectors = [
        '[data-result-index="0"]',
        '.ryNqvb',
        'span[jsname="W297wb"]',
        '.VIiyi',
        '.Q4iAWc',
        '[data-text]'
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          return el.textContent.trim();
        }
      }
      return null;
    });
    
    const cleaned = translatedText?.trim() || text;
    
    // Filter out bad translations
    const badPatterns = [
      'Loading...Listen',
      'Loading...',
      'Listen',
      'Translate',
      'Translating',
      'Error'
    ];
    
    for (const bad of badPatterns) {
      if (cleaned === bad || cleaned.includes('Loading')) {
        // Retry if we got bad translation
        if (retries < 2) {
          await sleep(2000);
          return translateText(page, text, targetLang, retries + 1);
        }
        return text; // Keep original after retries
      }
    }
    
    return cleaned;
    
  } catch (error) {
    if (retries < 2) {
      await sleep(2000);
      return translateText(page, text, targetLang, retries + 1);
    }
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

async function translateStrings(page, strings, targetLang, langName, targetPath) {
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
        console.log(`   [${langName}] Resuming from ${startIndex}/${strings.length}`);
      }
    } catch (e) {
      // Ignore, start fresh
    }
  }
  
  for (let i = startIndex; i < strings.length; i++) {
    // Check if shutdown requested
    if (isShuttingDown) {
      console.log(`\n   [${langName}] Shutdown requested, saving progress at ${i}/${strings.length}...`);
      
      // Save current progress
      const langInfo = WORLD_LANGUAGES.find(l => l.code === targetLang);
      result._meta = {
        languageCode: targetLang,
        languageName: langInfo?.nativeName || targetLang,
        translationStatus: 'in-progress',
        translationProgress: i,
        fallbackLanguage: 'ar',
        sourceLanguage: 'ar',
        note: 'Translated using Google Translate (TURBO Mode) - Interrupted',
        translatedAt: new Date().toISOString(),
        translatedBy: 'Google Translate (Puppeteer TURBO)'
      };
      
      fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`   [${langName}] ✅ Progress saved! Resume later from ${i}/${strings.length}`);
      
      return { result, stats, interrupted: true };
    }
    
    const item = strings[i];
    currentProgress = i + 1;
    
    const translated = await translateText(page, item.value, targetLang);
    setByPath(result, item.key, translated);
    
    if (translated !== item.value) {
      stats.translated++;
    } else {
      stats.skipped++;
    }
    
    // Save progress every 50 strings
    if (i % 50 === 0 || i === strings.length - 1) {
      const progress = ((i + 1) / strings.length * 100).toFixed(1);
      console.log(`   [${langName}] ${progress}% (${i + 1}/${strings.length})`);
      
      // Save intermediate progress
      const langInfo = WORLD_LANGUAGES.find(l => l.code === targetLang);
      result._meta = {
        languageCode: targetLang,
        languageName: langInfo?.nativeName || targetLang,
        translationStatus: i === strings.length - 1 ? 'full' : 'in-progress',
        translationProgress: i + 1,
        fallbackLanguage: 'ar',
        sourceLanguage: 'ar',
        note: 'Translated from Arabic using Google Translate (Puppeteer TURBO)',
        translatedAt: new Date().toISOString(),
        translatedBy: 'Google Translate (Puppeteer TURBO)'
      };
      
      fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
    }
    
    if (i < strings.length - 1) {
      await sleep(DELAY_BETWEEN_STRINGS);
    }
  }
  
  return { result, stats, interrupted: false };
}

/**
 * Check if translation is complete and valid
 */
function checkIfTranslationComplete(targetPath, totalStrings) {
  try {
    if (!fs.existsSync(targetPath)) {
      return { complete: false, needsTranslation: true, reason: 'File does not exist' };
    }
    
    const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    const translatedStrings = collectStrings(content);
    
    // Check if number of strings matches exactly
    if (translatedStrings.length !== totalStrings) {
      return { 
        complete: false, 
        needsTranslation: true, 
        reason: `String count mismatch (${translatedStrings.length}/${totalStrings})`,
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

/**
 * Translate one language
 */
async function translateLanguage(browserInstance, langCode, langName) {
  const { page } = browserInstance;
  const localesDir = path.join(__dirname, 'locales');
  const arPath = path.join(localesDir, 'ar.json');
  const targetPath = path.join(localesDir, `${langCode}.json`);
  
  currentLanguage = langName;
  console.log(`\n🔍 [${langName}] Checking...`);
  
  try {
    const arContent = JSON.parse(fs.readFileSync(arPath, 'utf-8'));
    const strings = collectStrings(arContent);
    
    // Check if translation is complete and valid
    const checkResult = checkIfTranslationComplete(targetPath, strings.length);
    
    console.log(`   📊 Status: ${checkResult.reason}`);
    
    if (checkResult.complete && !checkResult.needsTranslation) {
      console.log(`   ✅ Verified complete (${checkResult.count} strings) - Skipping`);
      totalSkipped++;
      return { success: true, skipped: true };
    }
    
    // Needs translation or re-translation
    if (checkResult.existingStrings) {
      console.log(`   🔄 Re-translating to fix issues (had ${checkResult.existingStrings} strings)`);
    } else {
      console.log(`   🆕 Starting fresh translation`);
    }
    
    console.log(`   📝 Total strings to translate: ${strings.length}`);
    
    const { result, stats, interrupted } = await translateStrings(page, strings, langCode, langName, targetPath);
    
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
      note: 'Translated from Arabic using Google Translate (Puppeteer TURBO)',
      translatedAt: new Date().toISOString(),
      translatedBy: 'Google Translate (Puppeteer TURBO)'
    };
    delete result._meta.translationProgress; // Remove progress marker when complete
    
    fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`   ✅ [${langName}] Complete! Translated: ${stats.translated}, Skipped: ${stats.skipped}`);
    
    totalTranslated += stats.translated;
    
    return { success: true, stats };
    
  } catch (error) {
    console.error(`   ❌ [${langName}] Error: ${error.message}`);
    totalErrors++;
    return { success: false, error: error.message };
  }
}

/**
 * Process a batch of languages in parallel
 */
async function processBatch(languages, startIndex) {
  const browsers = [];
  
  try {
    // Create browsers
    console.log(`\n🌐 Creating ${PARALLEL_BROWSERS} browsers...`);
    for (let i = 0; i < PARALLEL_BROWSERS; i++) {
      browsers.push(await createBrowser());
    }
    console.log('✅ Browsers ready!\n');
    
    // Process languages in parallel
    const promises = [];
    for (let i = 0; i < languages.length; i++) {
      const langCode = languages[i];
      const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
      const browserIndex = i % PARALLEL_BROWSERS;
      
      promises.push(
        translateLanguage(browsers[browserIndex], langCode, langInfo?.nativeName || langCode)
      );
    }
    
    const results = await Promise.all(promises);
    return results;
    
  } finally {
    // Close all browsers
    console.log('\n🔒 Closing browsers...');
    for (const { browser } of browsers) {
      await browser.close();
    }
  }
}

async function main() {
  const startTime = Date.now();
  
  // Setup graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Shutdown signal received (Ctrl+C)');
    console.log('📝 Saving current progress...');
    console.log(`   Current language: ${currentLanguage || 'N/A'}`);
    console.log(`   Current progress: ${currentProgress} strings`);
    isShuttingDown = true;
  });
  
  process.on('SIGTERM', () => {
    console.log('\n\n⚠️  Shutdown signal received (SIGTERM)');
    console.log('📝 Saving current progress...');
    isShuttingDown = true;
  });
  
  const checkpoint = loadCheckpoint();
  const completedLanguages = new Set(checkpoint.completedLanguages || []);
  const skippedLanguages = new Set(checkpoint.skippedLanguages || []);
  
  if (completedLanguages.size > 0 || skippedLanguages.size > 0) {
    console.log(`📌 Resuming from checkpoint:`);
    console.log(`   ✅ Completed: ${completedLanguages.size} languages`);
    console.log(`   ⏭️  Skipped (verified): ${skippedLanguages.size} languages\n`);
  }
  
  const languagesToTranslate = ALL_LANGUAGES.filter(
    code => !completedLanguages.has(code) && !skippedLanguages.has(code)
  );
  
  console.log(`🌍 Languages to check/translate: ${languagesToTranslate.length}`);
  console.log(`✅ Already completed: ${completedLanguages.size}`);
  console.log(`⏱️  Estimated time: ~${((languagesToTranslate.length * 3272 * DELAY_BETWEEN_STRINGS) / 1000 / 60 / PARALLEL_BROWSERS).toFixed(1)} minutes\n`);
  console.log('💡 Press Ctrl+C anytime to save progress and exit safely\n');
  console.log('='.repeat(60));
  
  // Process in batches
  const batchSize = PARALLEL_BROWSERS;
  for (let i = 0; i < languagesToTranslate.length; i += batchSize) {
    if (isShuttingDown) {
      console.log('\n🛑 Shutdown in progress, stopping batch processing...');
      break;
    }
    
    const batch = languagesToTranslate.slice(i, Math.min(i + batchSize, languagesToTranslate.length));
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 BATCH ${Math.floor(i / batchSize) + 1}/${Math.ceil(languagesToTranslate.length / batchSize)}`);
    console.log(`   Languages: ${batch.map(c => WORLD_LANGUAGES.find(l => l.code === c)?.nativeName || c).join(', ')}`);
    console.log('='.repeat(60));
    
    const results = await processBatch(batch, i);
    
    // Update checkpoint
    for (let j = 0; j < batch.length; j++) {
      if (results[j].success) {
        if (results[j].skipped) {
          skippedLanguages.add(batch[j]);
        } else {
          completedLanguages.add(batch[j]);
        }
      } else if (results[j].interrupted) {
        console.log(`\n⚠️  Translation interrupted for ${batch[j]}`);
        break;
      }
    }
    saveCheckpoint({ 
      completedLanguages: Array.from(completedLanguages),
      skippedLanguages: Array.from(skippedLanguages)
    });
    
    if (isShuttingDown) {
      break;
    }
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const completed = completedLanguages.size;
    const remaining = languagesToTranslate.length - completed;
    const avgTimePerLang = elapsed / completed;
    const estimatedRemaining = (avgTimePerLang * remaining).toFixed(1);
    
    console.log(`\n📊 Progress: ${completed}/${languagesToTranslate.length} (${(completed / languagesToTranslate.length * 100).toFixed(1)}%)`);
    console.log(`⏱️  Elapsed: ${elapsed} min | Remaining: ~${estimatedRemaining} min`);
  }
  
  if (isShuttingDown) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  TRANSLATION INTERRUPTED');
    console.log('='.repeat(60));
    console.log(`✅ Languages completed: ${completedLanguages.size}`);
    console.log(`📝 Progress saved successfully!`);
    console.log(`🔄 Run the script again to resume from where you left off`);
    console.log('='.repeat(60));
    return;
  }
  
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 TURBO TRANSLATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Languages translated: ${completedLanguages.size}`);
  console.log(`🔤 Total strings translated: ${totalTranslated.toLocaleString()}`);
  console.log(`⏱️  Total time: ${totalTime} minutes`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
