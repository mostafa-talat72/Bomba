import mongoose from 'mongoose';

// تعريف النماذج
const billSchema = new mongoose.Schema({}, { strict: false });
const sessionSchema = new mongoose.Schema({}, { strict: false });

const Bill = mongoose.model('Bill', billSchema);
const Session = mongoose.model('Session', sessionSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';

console.log('🔗 الاتصال بقاعدة البيانات...');

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ متصل بقاعدة البيانات');
    
    const sessionId = '694173e88b9f35c6663c6592';
    
    console.log(`🔍 فحص حالة الجلسة: ${sessionId}`);
    
    // 1. فحص الجلسة
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة');
      process.exit(1);
    }
    
    console.log(`✅ الجلسة موجودة:`);
    console.log(`   الحالة: ${session.status}`);
    console.log(`   الجهاز: ${session.deviceName} (${session.deviceNumber})`);
    console.log(`   الفاتورة المرجعة: ${session.bill}`);
    
    // 2. البحث عن جميع الفواتير التي تحتوي على هذه الجلسة
    console.log('\n🔍 البحث عن الفواتير التي تحتوي على هذه الجلسة...');
    
    const billsWithSession = await Bill.find({
      'sessions._id': new mongoose.Types.ObjectId(sessionId)
    });
    
    console.log(`📋 وُجدت ${billsWithSession.length} فاتورة تحتوي على هذه الجلسة:`);
    
    for (const bill of billsWithSession) {
      console.log(`\n   📄 الفاتورة: ${bill.billNumber} (${bill._id})`);
      console.log(`      العميل: ${bill.customerName}`);
      console.log(`      الطاولة: ${bill.table ? (typeof bill.table === 'object' ? bill.table.number : bill.table) : 'لا توجد'}`);
      console.log(`      عدد الطلبات: ${bill.orders?.length || 0}`);
      console.log(`      عدد الجلسات: ${bill.sessions?.length || 0}`);
      console.log(`      الحالة: ${bill.status}`);
      console.log(`      المجموع: ${bill.total} ج.م`);
      
      // فحص الجلسات في هذه الفاتورة
      if (bill.sessions && bill.sessions.length > 0) {
        console.log(`      الجلسات:`);
        bill.sessions.forEach((s, index) => {
          const isTargetSession = s._id.toString() === sessionId;
          console.log(`        ${index + 1}. ${s._id} ${isTargetSession ? '← الجلسة المستهدفة' : ''}`);
        });
      }
    }
    
    // 3. فحص الفواتير المحددة
    const correctBillId = '694173e88b9f35c6663c6595';
    const incorrectBillId = '69402fb926c9c427fe583a25';
    
    console.log('\n🔍 فحص الفواتير المحددة...');
    
    const correctBill = await Bill.findById(correctBillId);
    const incorrectBill = await Bill.findById(incorrectBillId);
    
    console.log(`\n✅ الفاتورة الصحيحة (${correctBillId}):`);
    if (correctBill) {
      console.log(`   رقم الفاتورة: ${correctBill.billNumber}`);
      console.log(`   عدد الجلسات: ${correctBill.sessions?.length || 0}`);
      console.log(`   عدد الطلبات: ${correctBill.orders?.length || 0}`);
      const hasTargetSession = correctBill.sessions?.some(s => s._id.toString() === sessionId);
      console.log(`   تحتوي على الجلسة المستهدفة: ${hasTargetSession ? 'نعم' : 'لا'}`);
    } else {
      console.log('   ❌ الفاتورة غير موجودة');
    }
    
    console.log(`\n❌ الفاتورة الخاطئة (${incorrectBillId}):`);
    if (incorrectBill) {
      console.log(`   رقم الفاتورة: ${incorrectBill.billNumber}`);
      console.log(`   عدد الجلسات: ${incorrectBill.sessions?.length || 0}`);
      console.log(`   عدد الطلبات: ${incorrectBill.orders?.length || 0}`);
      const hasTargetSession = incorrectBill.sessions?.some(s => s._id.toString() === sessionId);
      console.log(`   تحتوي على الجلسة المستهدفة: ${hasTargetSession ? 'نعم' : 'لا'}`);
      
      if (incorrectBill.sessions?.length === 0 && incorrectBill.orders?.length === 0) {
        console.log(`   ⚠️ هذه الفاتورة فارغة ويجب حذفها`);
      }
    } else {
      console.log('   ❌ الفاتورة غير موجودة');
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ:', error);
    process.exit(1);
  });