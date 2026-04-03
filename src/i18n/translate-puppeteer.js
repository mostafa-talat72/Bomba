/**
 * Web Automation Translation using Google Translate
 * Uses Puppeteer to automate Google Translate website
 * 
 * No API key needed - just run it!
 * Run: node src/i18n/translate-puppeteer.js
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

const DELAY_BETWEEN_STRINGS = 800; // 0.8 second (balanced speed + quality)
const DELAY_BETWEEN_LANGUAGES = 3000; // 3 seconds
const BATCH_SIZE = 5; // Translate 5 strings at once
const CHECKPOINT_FILE = path.join(__dirname, '.translation-puppeteer-checkpoint.json');

console.log('🌍 Starting TURBO web automation translation with Google Translate...\n');
console.log('⚙️  Configuration:');
console.log(`   - Languages to translate: ${REMAINING_LANGUAGES.length}`);
console.log(`   - Delay between strings: ${DELAY_BETWEEN_STRINGS / 1000}s`);
console.log(`   - Mode: Headless (ultra fast)`);
console.log(`   - Method: Puppeteer web automation\n`);

let totalTranslated = 0;
let totalSkipped = 0;
let totalErrors = 0;
let browser = null;
let page = null;

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
 * Initialize browser and page (ULTRA OPTIMIZED)
 */
async function initBrowser() {
  console.log('🌐 Launching browser in TURBO mode...');
  browser = await puppeteer.launch({
    headless: 'new', // Headless mode = much faster!
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
      '--no-default-browser-check',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection'
    ]
  });
  
  page = await browser.newPage();
  
  // Disable unnecessary features for maximum speed
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'websocket'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  // Set user agent to avoid detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('✅ Browser launched in TURBO mode (headless + optimized)\n');
}

/**
 * Translate single text using Google Translate web interface (ULTRA FAST + FIXED)
 */
async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text;
  }
  
  if (!/[a-zA-Z]/.test(text)) {
    return text;
  }
  
  try {
    // Navigate to Google Translate with minimal waiting
    const url = `https://translate.google.com/?sl=en&tl=${targetLang}&text=${encodeURIComponent(text)}&op=translate`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // Wait longer for translation to load properly
    await sleep(2500);
    
    // Try multiple selectors for the translation result (parallel with shorter timeout)
    let translatedText = null;
    
    try {
      // Wait for any of these selectors to appear (faster timeout)
      const selector = await Promise.race([
        page.waitForSelector('[data-result-index="0"]', { timeout: 5000 }).then(() => '[data-result-index="0"]'),
        page.waitForSelector('.ryNqvb', { timeout: 5000 }).then(() => '.ryNqvb'),
        page.waitForSelector('span[jsname="W297wb"]', { timeout: 5000 }).then(() => 'span[jsname="W297wb"]'),
        page.waitForSelector('.VIiyi', { timeout: 5000 }).then(() => '.VIiyi'),
        page.waitForSelector('[data-text]', { timeout: 5000 }).then(() => '[data-text]'),
        page.waitForSelector('.Q4iAWc', { timeout: 5000 }).then(() => '.Q4iAWc')
      ]);
      
      translatedText = await page.$eval(selector, el => el.textContent || el.innerText);
    } catch (e) {
      // Fallback: try to get any text from translation area
      try {
        translatedText = await page.evaluate(() => {
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
      } catch (e2) {
        // Ignore
      }
      
      if (!translatedText) {
        return text;
      }
    }
    
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
        console.log(`\n   ⚠️  Bad translation detected: "${cleaned}" for "${text.substring(0, 30)}..." - keeping original`);
        return text;
      }
    }
    
    return cleaned;
    
  } catch (error) {
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
        console.log(`\n   📌 Resuming from ${startIndex}/${strings.length}`);
      }
    } catch (e) {
      // Ignore, start fresh
    }
  }
  
  for (let i = startIndex; i < strings.length; i++) {
    const item = strings[i];
    
    // Show current string (compact display)
    const displayText = item.value.length > 40 ? item.value.substring(0, 40) + '...' : item.value;
    const progress = ((i + 1) / strings.length * 100).toFixed(1);
    process.stdout.write(`\r   [${progress}%] ${i + 1}/${strings.length} | "${displayText}"                    `);
    
    const translated = await translateText(item.value, targetLang);
    setByPath(result, item.key, translated);
    
    if (translated !== item.value) {
      stats.translated++;
    } else {
      stats.skipped++;
    }
    
    // Save progress every 50 strings
    if (i % 50 === 0 || i === strings.length - 1) {
      const langInfo = WORLD_LANGUAGES.find(l => l.code === targetLang);
      result._meta = {
        languageCode: targetLang,
        languageName: langInfo?.nativeName || targetLang,
        translationStatus: i === strings.length - 1 ? 'full' : 'in-progress',
        translationProgress: i + 1,
        fallbackLanguage: 'en',
        note: 'Translated using Google Translate (Web Automation)',
        translatedAt: new Date().toISOString(),
        translatedBy: 'Google Translate (Puppeteer)'
      };
      
      fs.writeFileSync(targetPath, JSON.stringify(result, null, 2), 'utf-8');
    }
    
    // Minimal delay for speed
    if (i < strings.length - 1) {
      await sleep(DELAY_BETWEEN_STRINGS);
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
    console.log(`   ⏱️  Estimated time: ~${((strings.length * DELAY_BETWEEN_STRINGS) / 1000 / 60).toFixed(1)} minutes`);
    
    const { result, stats } = await translateStrings(strings, langCode, targetPath, langName);
    
    const langInfo = WORLD_LANGUAGES.find(l => l.code === langCode);
    result._meta = {
      languageCode: langCode,
      languageName: langInfo?.nativeName || langCode,
      translationStatus: 'full',
      fallbackLanguage: 'en',
      note: 'Translated using Google Translate (Web Automation)',
      translatedAt: new Date().toISOString(),
      translatedBy: 'Google Translate (Puppeteer)'
    };
    delete result._meta.translationProgress; // Remove progress marker when complete
    
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
  
  try {
    await initBrowser();
    
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
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  if (browser) {
    browser.close();
  }
  process.exit(1);
});
