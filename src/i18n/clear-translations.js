/**
 * Clear all translation files except Arabic
 * Run: node src/i18n/clear-translations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'locales');

console.log('🗑️  Clearing translation files...\n');

try {
  // Get all JSON files in locales directory
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  
  console.log(`📁 Found ${files.length} translation files`);
  
  let deletedCount = 0;
  let keptCount = 0;
  
  files.forEach(file => {
    const filePath = path.join(localesDir, file);
    const langCode = file.replace('.json', '');
    
    // Keep only Arabic (ar)
    if (langCode === 'ar') {
      console.log(`✅ Keeping: ${file}`);
      keptCount++;
    } else {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted: ${file}`);
      deletedCount++;
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ CLEANUP COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Kept: ${keptCount} files (ar.json only)`);
  console.log(`🗑️  Deleted: ${deletedCount} files`);
  console.log('='.repeat(60));
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
