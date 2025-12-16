import mongoose from 'mongoose';

// تعريف النماذج
const billSchema = new mongoose.Schema({}, { strict: false });
const sessionSchema = new mongoose.Schema({}, { strict: false });

const Bill = mongoose.model('Bill', billSchema);
const Session = mongoose.model('Session', sessionSchema);

async function fixSpecificSessionIssue() {
  try {
    console.log('🔍 إصلاح مشكلة الجلسة المحددة...');
    
    const sessionId = '694173e88b9f35c6663c6592';
    const correctBillId = '694173e88b9f35c6663c6595'; // الفاتورة الصحيحة
    const incorrectBillId = '69402fb926c9c427fe583a25'; // الفاتورة الخاطئة
    
    console.log(`📋 الجلسة: ${sessionId}`);
    console.log(`✅ الفاتورة الصحيحة: ${correctBillId}`);
    console.log(`❌ الفاتورة الخاطئة: ${incorrectBillId}`);
    
    // 1. التحقق من الجلسة
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة');
      return { success: false, message: 'Session not found' };
    }
    
    console.log(`🔍 الجلسة موجودة - الحالة: ${session.status}`);
    console.log(`🔍 الفاتورة المرجعة في الجلسة: ${session.bill}`);
    
    // 2. تحديث مرجع الفاتورة في الجلسة إذا كان خاطئ
    if (session.bill.toString() !== correctBillId) {
      console.log('🔧 تحديث مرجع الفاتورة في الجلسة...');
      session.bill = correctBillId;
      await session.save();
      console.log('✅ تم تحديث مرجع الفاتورة في الجلسة');
    }
    
    // 3. إزالة الجلسة من الفاتورة الخاطئة
    console.log('🗑️ إزالة الجلسة من الفاتورة الخاطئة...');
    const incorrectBill = await Bill.findById(incorrectBillId);
    if (incorrectBill) {
      const originalSessionsCount = incorrectBill.sessions.length;
      incorrectBill.sessions = incorrectBill.sessions.filter(s => 
        s._id.toString() !== sessionId
      );
      
      if (incorrectBill.sessions.length < originalSessionsCount) {
        await incorrectBill.save();
        console.log(`✅ تم إزالة الجلسة من الفاتورة الخاطئة (${originalSessionsCount} -> ${incorrectBill.sessions.length})`);
      } else {
        console.log('⚠️ الجلسة لم تكن موجودة في الفاتورة الخاطئة');
      }
    }
    
    // 4. التأكد من وجود الجلسة في الفاتورة الصحيحة
    console.log('✅ التحقق من وجود الجلسة في الفاتورة الصحيحة...');
    const correctBill = await Bill.findById(correctBillId);
    if (correctBill) {
      const sessionExists = correctBill.sessions.some(s => 
        s._id.toString() === sessionId
      );
      
      if (!sessionExists) {
        console.log('🔧 إضافة الجلسة للفاتورة الصحيحة...');
        correctBill.sessions.push(sessionId);
        await correctBill.save();
        console.log('✅ تم إضافة الجلسة للفاتورة الصحيحة');
      } else {
        console.log('✅ الجلسة موجودة بالفعل في الفاتورة الصحيحة');
      }
    }
    
    // 5. التحقق النهائي
    console.log('\n📊 التحقق النهائي...');
    
    // فحص الجلسة
    const updatedSession = await Session.findById(sessionId);
    console.log(`🔍 مرجع الفاتورة في الجلسة: ${updatedSession.bill}`);
    
    // فحص الفواتير
    const billsWithSession = await Bill.find({
      'sessions._id': sessionId
    });
    
    console.log(`📋 الجلسة موجودة في ${billsWithSession.length} فاتورة:`);
    billsWithSession.forEach(bill => {
      console.log(`   - ${bill.billNumber} (${bill._id})`);
    });
    
    if (billsWithSession.length === 1 && billsWithSession[0]._id.toString() === correctBillId) {
      console.log('🎉 تم إصلاح المشكلة بنجاح!');
      return { 
        success: true, 
        message: 'تم إصلاح مشكلة الجلسة المكررة بنجاح',
        sessionId,
        correctBillId,
        billsCount: billsWithSession.length
      };
    } else {
      console.log('⚠️ لا تزال هناك مشكلة في البيانات');
      return { 
        success: false, 
        message: 'لا تزال الجلسة موجودة في عدة فواتير',
        sessionId,
        billsCount: billsWithSession.length
      };
    }
    
  } catch (error) {
    console.error('❌ خطأ في إصلاح المشكلة:', error);
    throw error;
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('🔗 متصل بقاعدة البيانات');
      return fixSpecificSessionIssue();
    })
    .then((result) => {
      console.log('\n🎉 تم الانتهاء من إصلاح المشكلة');
      console.log('النتيجة:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ فشل في إصلاح المشكلة:', error);
      process.exit(1);
    });
}

export { fixSpecificSessionIssue };