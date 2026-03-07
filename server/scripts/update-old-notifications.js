import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import notification translations
import { getNotificationTranslation } from '../utils/notificationTranslations.js';
import { getCurrencySymbol } from '../utils/localeHelper.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Notification Schema (simplified)
const notificationSchema = new mongoose.Schema({
  title: String,
  message: String,
  type: String,
  category: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

// Function to generate translations for old notifications
const generateTranslations = (notification) => {
  const { title, message, category, metadata } = notification;
  
  // Try to detect the notification type from title/message
  let translations = null;
  
  try {
    // Session notifications
    if (category === 'session') {
      if (title.includes('جلسة جديدة') || title.includes('New Session')) {
        const deviceName = metadata?.deviceName || 'Unknown Device';
        translations = {
          ar: getNotificationTranslation('session', 'started', 'ar', deviceName),
          en: getNotificationTranslation('session', 'started', 'en', deviceName),
          fr: getNotificationTranslation('session', 'started', 'fr', deviceName)
        };
      } else if (title.includes('انتهاء الجلسة') || title.includes('Session Ended')) {
        const deviceName = metadata?.deviceName || 'Unknown Device';
        const cost = 0; // We don't have the cost in old notifications
        const arSymbol = getCurrencySymbol(metadata?.currency || 'EGP', 'ar');
        const enSymbol = getCurrencySymbol(metadata?.currency || 'EGP', 'en');
        const frSymbol = getCurrencySymbol(metadata?.currency || 'EGP', 'fr');
        translations = {
          ar: getNotificationTranslation('session', 'ended', 'ar', deviceName, cost, arSymbol),
          en: getNotificationTranslation('session', 'ended', 'en', deviceName, cost, enSymbol),
          fr: getNotificationTranslation('session', 'ended', 'fr', deviceName, cost, frSymbol)
        };
      }
    }
    
    // Order notifications
    else if (category === 'order') {
      if (title.includes('طلب جديد') || title.includes('New Order')) {
        const customerName = 'Customer';
        const itemCount = metadata?.itemCount || 1;
        translations = {
          ar: getNotificationTranslation('order', 'created', 'ar', customerName, itemCount),
          en: getNotificationTranslation('order', 'created', 'en', customerName, itemCount),
          fr: getNotificationTranslation('order', 'created', 'fr', customerName, itemCount)
        };
      } else if (title.includes('جاهز') || title.includes('Ready')) {
        const orderNumber = metadata?.orderNumber || 'Unknown';
        translations = {
          ar: getNotificationTranslation('order', 'ready', 'ar', orderNumber),
          en: getNotificationTranslation('order', 'ready', 'en', orderNumber),
          fr: getNotificationTranslation('order', 'ready', 'fr', orderNumber)
        };
      }
    }
    
    // Inventory notifications
    else if (category === 'inventory') {
      if (title.includes('مخزون منخفض') || title.includes('Low Stock')) {
        const itemName = metadata?.itemName || 'Unknown Item';
        const currentStock = metadata?.currentStock || 0;
        const unit = 'unit';
        translations = {
          ar: getNotificationTranslation('inventory', 'low_stock', 'ar', itemName, currentStock, unit),
          en: getNotificationTranslation('inventory', 'low_stock', 'en', itemName, currentStock, unit),
          fr: getNotificationTranslation('inventory', 'low_stock', 'fr', itemName, currentStock, unit)
        };
      }
    }
    
    // Billing notifications
    else if (category === 'billing') {
      if (title.includes('دفع مكتمل') || title.includes('Payment Complete')) {
        const billNumber = metadata?.billNumber || 'Unknown';
        translations = {
          ar: getNotificationTranslation('billing', 'paid', 'ar', billNumber),
          en: getNotificationTranslation('billing', 'paid', 'en', billNumber),
          fr: getNotificationTranslation('billing', 'paid', 'fr', billNumber)
        };
      } else if (title.includes('دفع جزئي') || title.includes('Partial Payment')) {
        const billNumber = metadata?.billNumber || 'Unknown';
        const remaining = 0;
        const arSymbol = getCurrencySymbol(metadata?.currency || 'EGP', 'ar');
        const enSymbol = getCurrencySymbol(metadata?.currency || 'EGP', 'en');
        const frSymbol = getCurrencySymbol(metadata?.currency || 'EGP', 'fr');
        translations = {
          ar: getNotificationTranslation('billing', 'partial_payment', 'ar', billNumber, remaining, arSymbol),
          en: getNotificationTranslation('billing', 'partial_payment', 'en', billNumber, remaining, enSymbol),
          fr: getNotificationTranslation('billing', 'partial_payment', 'fr', billNumber, remaining, frSymbol)
        };
      }
    }
    
    // If we couldn't generate translations, use the original text for all languages
    if (!translations) {
      translations = {
        ar: { title, message },
        en: { title, message },
        fr: { title, message }
      };
    }
  } catch (error) {
    console.error('Error generating translations:', error);
    // Fallback: use original text for all languages
    translations = {
      ar: { title, message },
      en: { title, message },
      fr: { title, message }
    };
  }
  
  return translations;
};

// Main function to update notifications
const updateNotifications = async () => {
  try {
    console.log('🔄 Starting notification update...');
    
    // Find all notifications without translations
    const notifications = await Notification.find({
      $or: [
        { 'metadata.translations': { $exists: false } },
        { 'metadata.translations': null }
      ]
    });
    
    console.log(`📊 Found ${notifications.length} notifications to update`);
    
    let updated = 0;
    let failed = 0;
    
    for (const notification of notifications) {
      try {
        const translations = generateTranslations(notification);
        
        // Update the notification
        await Notification.updateOne(
          { _id: notification._id },
          {
            $set: {
              'metadata.translations': translations
            }
          }
        );
        
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`✅ Updated ${updated} notifications...`);
        }
      } catch (error) {
        console.error(`❌ Failed to update notification ${notification._id}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n📈 Update Summary:');
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${notifications.length}`);
    
  } catch (error) {
    console.error('❌ Error updating notifications:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the script
(async () => {
  await connectDB();
  await updateNotifications();
  process.exit(0);
})();
