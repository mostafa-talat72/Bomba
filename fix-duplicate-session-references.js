const mongoose = require('mongoose');

// تعريف النماذج
const billSchema = new mongoose.Schema({}, { strict: false });
const sessionSchema = new mongoose.Schema({}, { strict: false });

const Bill = mongoose.model('Bill', billSchema);
const Session = mongoose.model('Session', sessionSchema);

async function fixDuplicateSessionReferences() {
  try {
    console.log('🔍 البحث عن الجلسات المكررة في الفواتير...');
    
    // الحصول على جميع الفواتير
    const bills = await Bill.find({});
    
    let duplicatesFound = 0;
    let duplicatesFixed = 0;
    
    // تتبع الجلسات التي تم العثور عليها
    const sessionTracker = new Map();
    
    for (const bill of bills) {
      if (bill.sessions && bill.sessions.length > 0) {
        console.log(`\n📋 فحص الفاتورة: ${bill.billNumber} (${bill._id})`);
        
        // فحص كل جلسة في الفاتورة
        for (const session of bill.sessions) {
          const sessionId = session._id.toString();
          
          if (sessionTracker.has(sessionId)) {
            duplicatesFound++;
            const previousBill = sessionTracker.get(sessionId);
            
            console.log(`❌ جلسة مكررة وُجدت:`);
            console.log(`   الجلسة: ${sessionId}`);
            console.log(`   الفاتورة السابقة: ${previousBill.billNumber} (${previousBill._id})`);
            console.log(`   الفاتورة الحالية: ${bill.billNumber} (${bill._id})`);
            
            // التحقق من أي فاتورة يجب أن تحتوي على الجلسة
            const sessionDoc = await Session.findById(sessionId);
            if (sessionDoc) {
              const correctBillId = sessionDoc.bill.toString();
              
              console.log(`   الفاتورة الصحيحة في الجلسة: ${correctBillId}`);
              
              // إزالة الجلسة من الفاتورة الخاطئة
              if (correctBillId === bill._id.toString()) {
                // الفاتورة الحالية صحيحة، إزالة من السابقة
                console.log(`   ✅ إزالة الجلسة من الفاتورة السابقة: ${previousBill.billNumber}`);
                await Bill.updateOne(
                  { _id: previousBill._id },
                  { $pull: { sessions: { _id: sessionId } } }
                );
                duplicatesFixed++;
              } else if (correctBillId === previousBill._id.toString()) {
                // الفاتورة السابقة صحيحة، إزالة من الحالية
                console.log(`   ✅ إزالة الجلسة من الفاتورة الحالية: ${bill.billNumber}`);
                await Bill.updateOne(
                  { _id: bill._id },
                  { $pull: { sessions: { _id: sessionId } } }
                );
                duplicatesFixed++;
              } else {
                // الجلسة تشير لفاتورة ثالثة!
                console.log(`   ⚠️ الجلسة تشير لفاتورة ثالثة: ${correctBillId}`);
                console.log(`   🔧 تحديث مرجع الجلسة وإزالة من الفواتير الخاطئة`);
                
                // إزالة من كلا الفاتورتين
                await Bill.updateOne(
                  { _id: previousBill._id },
                  { $pull: { sessions: { _id: sessionId } } }
                );
                await Bill.updateOne(
                  { _id: bill._id },
                  { $pull: { sessions: { _id: sessionId } } }
                );
                
                // إضافة للفاتورة الصحيحة إذا لم تكن موجودة
                const correctBill = await Bill.findById(correctBillId);
                if (correctBill) {
                  const sessionExists = correctBill.sessions.some(s => s._id.toString() === sessionId);
                  if (!sessionExists) {
                    await Bill.updateOne(
                      { _id: correctBillId },
                      { $push: { sessions: session } }
                    );
                  }
                }
                duplicatesFixed++;
              }
            } else {
              console.log(`   ❌ الجلسة غير موجودة في قاعدة البيانات!`);
            }
          } else {
            // تسجيل الجلسة لأول مرة
            sessionTracker.set(sessionId, {
              _id: bill._id,
              billNumber: bill.billNumber
            });
          }
        }
      }
    }
    
    console.log(`\n📊 ملخص النتائج:`);
    console.log(`   الجلسات المكررة الموجودة: ${duplicatesFound}`);
    console.log(`   الجلسات المكررة المُصلحة: ${duplicatesFixed}`);
    
    if (duplicatesFound === 0) {
      console.log('✅ لا توجد جلسات مكررة في الفواتير');
    } else {
      console.log('✅ تم إصلاح جميع الجلسات المكررة');
    }
    
    return {
      duplicatesFound,
      duplicatesFixed
    };
    
  } catch (error) {
    console.error('❌ خطأ في إصلاح الجلسات المكررة:', error);
    throw error;
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
if (require.main === module) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('🔗 متصل بقاعدة البيانات');
      return fixDuplicateSessionReferences();
    })
    .then((result) => {
      console.log('\n🎉 تم الانتهاء من إصلاح الجلسات المكررة');
      console.log('النتيجة:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ فشل في إصلاح الجلسات المكررة:', error);
      process.exit(1);
    });
}

module.exports = { fixDuplicateSessionReferences };