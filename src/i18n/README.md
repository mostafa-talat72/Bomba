# Internationalization (i18n) System

## Overview
This application supports 149+ world languages with automatic fallback to English for languages without full translations.

## Supported Languages
All languages from `shared/languages.js` are supported, including:
- **RTL Languages**: Arabic, Urdu, Hebrew, Persian, Pashto, Sindhi, Uyghur, Dhivehi, Kashmiri
- **Major Languages**: English, French, Spanish, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Hindi, and many more
- **Regional Languages**: Over 140 additional languages from all continents

## Current Translation Files
- `ar.json` - Arabic (العربية) - Full translation
- `en.json` - English - Full translation
- `fr.json` - French (Français) - Full translation

## Adding New Translations

### Option 1: Create a New Translation File
1. Copy `en.json` as a template
2. Create a new file: `locales/[language-code].json`
3. Translate all keys to the target language
4. Import the file in `config.ts`:
   ```typescript
   import es from './locales/es.json';
   ```
5. Add it to resources:
   ```typescript
   const resources: Record<string, { translation: any }> = {
     ar: { translation: ar },
     en: { translation: en },
     fr: { translation: fr },
     es: { translation: es }, // Add your new language
   };
   ```

### Option 2: Use Automatic Fallback
All languages in `WORLD_LANGUAGES` automatically use English translations as fallback. No additional configuration needed!

## Translation File Structure
```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    ...
  },
  "nav": {
    "dashboard": "Dashboard",
    ...
  },
  "auth": {
    "login": "Login",
    ...
  }
}
```

## Usage in Components
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return <button>{t('common.save')}</button>;
}
```

## RTL Support
Languages with `rtl: true` in `shared/languages.js` automatically:
- Set `dir="rtl"` on HTML elements
- Apply RTL-specific styles
- Adjust layout direction

## Language Selection
Users can select their preferred language from Settings page, which displays all 149 languages with their native names.

## Fallback Strategy
1. Try to load the selected language translation
2. If key is missing, fall back to English
3. If English is missing, display the key itself

## Best Practices
1. Always use translation keys, never hardcode text
2. Use descriptive key names: `settings.profile.title` not `sp1`
3. Keep translations consistent across languages
4. Test RTL languages for layout issues
5. Use interpolation for dynamic values: `t('welcome', { name: 'John' })`

## Contributing Translations
To contribute translations for a new language:
1. Create a new JSON file in `locales/`
2. Translate all keys from `en.json`
3. Test the translation in the application
4. Submit a pull request

## Notes
- All 149 languages are available in the language selector
- Languages without full translations use English as fallback
- The system automatically handles RTL/LTR direction
- Language preference is saved in localStorage and database
