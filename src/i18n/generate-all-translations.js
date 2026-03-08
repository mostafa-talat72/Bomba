/**
 * Script to generate minimal translation files for all 146 world languages
 * 
 * This script creates translation files with essential keys translated using
 * language names in their native scripts. For full translations, only ar, en, fr
 * are maintained. All other languages will fallback to English for missing keys.
 * 
 * Usage: node src/i18n/generate-all-translations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WORLD_LANGUAGES } from '../../shared/languages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Languages that already have full translations (don't regenerate)
const FULL_TRANSLATION_LANGUAGES = ['ar', 'en', 'fr'];

// Minimal translation template with essential keys
// These will be the same across all languages (using English)
const createMinimalTranslation = (languageCode, nativeName) => ({
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",
    loading: "Loading...",
    success: "Success",
    error: "Error",
    yes: "Yes",
    no: "No",
    close: "Close",
    confirm: "Confirm",
    language: nativeName, // Use native name for the language itself
  },
  nav: {
    dashboard: "Dashboard",
    playstation: "PlayStation",
    computer: "Computer",
    cafe: "Cafe",
    orders: "Orders",
    menu: "Menu",
    billing: "Billing",
    reports: "Reports",
    inventory: "Inventory",
    costs: "Costs",
    payroll: "Payroll",
    users: "Users",
    settings: "Settings",
  },
  auth: {
    login: "Login",
    logout: "Logout",
    register: "Register",
    email: "Email",
    password: "Password",
    loginButton: "Login",
  },
  // Note: All other keys will fallback to English automatically
  _meta: {
    languageCode: languageCode,
    languageName: nativeName,
    translationStatus: "minimal",
    fallbackLanguage: "en",
    note: "This is a minimal translation file. Missing keys will fallback to English. To add full translations, edit this file manually."
  }
});

// Main function to generate translation files
const generateTranslations = () => {
  const localesDir = path.join(__dirname, 'locales');
  
  // Ensure locales directory exists
  if (!fs.existsSync(localesDir)) {
    fs.mkdirSync(localesDir, { recursive: true });
  }

  let created = 0;
  let skipped = 0;

  WORLD_LANGUAGES.forEach((lang) => {
    const filePath = path.join(localesDir, `${lang.code}.json`);
    
    // Skip if file already exists or is a full translation language
    if (fs.existsSync(filePath) || FULL_TRANSLATION_LANGUAGES.includes(lang.code)) {
      console.log(`⏭️  Skipped: ${lang.code} (${lang.nativeName}) - already exists or has full translation`);
      skipped++;
      return;
    }

    // Create minimal translation
    const translation = createMinimalTranslation(lang.code, lang.nativeName);
    
    // Write to file with pretty formatting
    fs.writeFileSync(
      filePath,
      JSON.stringify(translation, null, 2),
      'utf-8'
    );
    
    console.log(`✅ Created: ${lang.code} (${lang.nativeName})`);
    created++;
  });

  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${created} files`);
  console.log(`   ⏭️  Skipped: ${skipped} files`);
  console.log(`   📝 Total languages: ${WORLD_LANGUAGES.length}`);
  console.log('\n💡 Note: Minimal translation files created. Missing keys will fallback to English.');
  console.log('   To add full translations for a language, edit the corresponding JSON file manually.');
};

// Run the script
try {
  console.log('🌍 Generating translation files for all world languages...\n');
  generateTranslations();
  console.log('\n✨ Done!');
} catch (error) {
  console.error('❌ Error generating translations:', error);
  process.exit(1);
}
