/**
 * Helper script to create a new translation file template
 * Usage: node src/i18n/create-translation-template.js [language-code]
 * Example: node src/i18n/create-translation-template.js es
 */

const fs = require('fs');
const path = require('path');

const languageCode = process.argv[2];

if (!languageCode) {
  console.error('❌ Error: Please provide a language code');
  console.log('Usage: node create-translation-template.js [language-code]');
  console.log('Example: node create-translation-template.js es');
  process.exit(1);
}

const templatePath = path.join(__dirname, 'locales', 'en.json');
const outputPath = path.join(__dirname, 'locales', `${languageCode}.json`);

// Check if file already exists
if (fs.existsSync(outputPath)) {
  console.error(`❌ Error: Translation file for '${languageCode}' already exists`);
  process.exit(1);
}

// Read English template
try {
  const template = fs.readFileSync(templatePath, 'utf8');
  const translations = JSON.parse(template);
  
  // Add a comment at the top
  const output = {
    "_comment": `Translation file for ${languageCode}. Please translate all values to ${languageCode}.`,
    ...translations
  };
  
  // Write new file
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`✅ Successfully created translation template: ${outputPath}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Translate all values in the new file');
  console.log('2. Import the file in src/i18n/config.ts');
  console.log('3. Add it to the resources object');
  console.log('');
  console.log('Example:');
  console.log(`   import ${languageCode} from './locales/${languageCode}.json';`);
  console.log(`   ${languageCode}: { translation: ${languageCode} },`);
  
} catch (error) {
  console.error('❌ Error creating translation file:', error.message);
  process.exit(1);
}
