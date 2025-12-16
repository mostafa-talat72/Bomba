import mongoose from 'mongoose';
import NotificationService from './services/notificationService.js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config();

async function testNotifications() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // إنشاء مستخدم وهمي للاختبار
        const testUser = {
            _id: new mongoose.Types.ObjectId(),
            organization: new mongoose.Types.ObjectId(),
            name: 'مستخدم اختبار'
        };

        console.log('👤 Test user created:', testUser.name);
        console.log('   User ID:', testUser._id);
        console.log('   Organization:', testUser.organization);

        // اختبار إنشاء إشعار
        console.log('\n📢 Testing notification creation...');
        
        try {
            const notification = await NotificationService.createNotification({
                type: "session",
                category: "session",
                title: "اختبار الإشعارات",
                message: "هذا إشعار تجريبي للتأكد من عمل النظام",
                createdBy: testUser._id,
            }, testUser);

            console.log('✅ Notification created successfully:', notification._id);
            console.log('   Title:', notification.title);
            console.log('   Message:', notification.message);
            console.log('   Organization:', notification.organization);

            // حذف الإشعار التجريبي
            await mongoose.connection.db.collection('notifications').deleteOne({ _id: notification._id });
            console.log('🧹 Test notification cleaned up');

        } catch (error) {
            console.error('❌ Error creating notification:', error.message);
        }

        // اختبار مع بيانات ناقصة
        console.log('\n🚫 Testing with missing user data...');
        
        try {
            await NotificationService.createNotification({
                type: "session",
                title: "اختبار خطأ",
                message: "هذا يجب أن يفشل",
            }, null);
            console.log('❌ This should not succeed');
        } catch (error) {
            console.log('✅ Correctly failed with missing user:', error.message);
        }

        // اختبار مع مستخدم بدون organization
        console.log('\n🚫 Testing with user without organization...');
        
        try {
            const userWithoutOrg = {
                _id: new mongoose.Types.ObjectId(),
                name: 'مستخدم بدون منظمة'
            };

            await NotificationService.createNotification({
                type: "session",
                title: "اختبار خطأ 2",
                message: "هذا يجب أن يفشل أيضاً",
            }, userWithoutOrg);
            console.log('❌ This should not succeed');
        } catch (error) {
            console.log('✅ Correctly failed with user without organization:', error.message);
        }

        console.log('\n✅ All notification tests completed!');

    } catch (error) {
        console.error('❌ Error testing notifications:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// تشغيل الاختبار
testNotifications().catch(console.error);