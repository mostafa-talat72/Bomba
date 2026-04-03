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

// Languages that need translation
const REMAINING_LANGUAGES = [
  'as', 'ay', 'bm', 'ceb', 'co', 'cy', 'dv', 'ee', 'eo', 'fy', 'gd', 'gn', 
  'haw', 'ht', 'ik', 'iu', 'jv', 'kl', 'kr', 'kri', 'ks', 'la', 'lb', 'lg', 
  'ln', 'lu', 'mh', 'nd', 'ng', 'nr', 'nv', 'ny', 'oc', 'om', 'or', 'os', 
  'pi', 'qu', 'rm', 'rw', 'sa', 'sd', 'sg', 'sm', 'sn', 'ss', 'st', 'su', 
  'tg', 'ti', 'tk', 'tn', 'to', 'ts', 'tt', 'tw', 'ty', 'ug', 'uz', 've', 
  'wa', 'wo', 'xh', 'yi', 'yo', 'za', 'zu'
];

const PARALLEL_BROWSERS = 3; // Reduced for better quality
const DELAY_BETWEEN_STRINGS = 1000; // 1 second (better quality)
const CHECKPOINT_FILE = path.join(__dirname, '.translation-turbo-checkpoint.json');

console.log('🚀 TURBO MODE - Maximum Speed Translation!\n');
console.log('⚙️  Configuration:');
console.log(`   - Parallel browsers: ${PARALLEL_BROWSERS}`);
console.log(`   - Languages to translate: ${REMAINING_LANGUAGES.length}`);
console.log(`   - Delay between strings: ${DELAY_BETWEEN_STRINGS}ms`);
console.log(`   - Mode: Headless (ultra fast)\n`);

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
    const url = `https://translate.google.com/?sl=en&tl=${targetLang}&text=${encodeURIComponent(text)}&op=translate`;
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
        fallbackLanguage: 'en',
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
        fallbackLanguage: 'en',
        note: 'Translated using Google Translate (TURBO Mode)',
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
 * Translate one language
 */
async function translateLanguage(browserInstance, langCode, langName) {
  const { page } = browserInstance;
  const localesDir = path.join(__dirname, 'locales');
  const enPath = path.join(localesDir, 'en.json');
  const targetPath = path.join(localesDir, `${langCode}.json`);
  
  currentLanguage = langName;
  console.log(`\n🔄 [${langName}] Starting translation...`);
  
  try {
    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    const strings = collectStrings(enContent);
    console.log(`   [${langName}] Found ${strings.length} strings`);
    
    const { result, stats, interrupted } = await translateStrings(page, strings, langCode, langName, targetPath);
    
    if (interrupted) {
      return { success: false, interrupted: true };
    }
    
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    result._meta = {
      languageCode: langCode,
      languageName: langInfo?.nativeName || langCode,
      translationStatus: 'full',
      fallbackLanguage: 'en',
      note: 'Translated using Google Translate (TURBO Mode)',
      translatedAt: new Date().toISOString(),
      translatedBy: 'Google Translate (Puppeteer TURBO)'
    };
    delete result._meta.translationProgress; // Remove progress marker when complete
    
    fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`   ✅ [${langName}] Complete! Translated: ${stats.translated}, Skipped: ${stats.skipped}`);
    
    totalTranslated += stats.translated;
    totalSkipped += stats.skipped;
    
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
  
  if (completedLanguages.size > 0) {
    console.log(`📌 Resuming: ${completedLanguages.size} languages already done\n`);
  }
  
  const languagesToTranslate = REMAINING_LANGUAGES.filter(
    code => !completedLanguages.has(code)
  );
  
  console.log(`📊 Languages to translate: ${languagesToTranslate.length}`);
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
        completedLanguages.add(batch[j]);
      } else if (results[j].interrupted) {
        console.log(`\n⚠️  Translation interrupted for ${batch[j]}`);
        break;
      }
    }
    saveCheckpoint({ completedLanguages: Array.from(completedLanguages) });
    
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
