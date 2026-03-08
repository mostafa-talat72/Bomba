// Test Google Translate API
import pkg from '@vitalets/google-translate-api';
const { translate } = pkg;

async function test() {
  try {
    console.log('Testing Google Translate...\n');
    
    const result = await translate('Hello World', { to: 'es' });
    console.log('Original:', 'Hello World');
    console.log('Translated:', result.text);
    console.log('\n✅ Translation works!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

test();
