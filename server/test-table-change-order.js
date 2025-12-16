import mongoose from 'mongoose';

// تعريف النماذج
const billSchema = new mongoose.Schema({}, { strict: false });
const sessionSchema = new mongoose.Schema({}, { strict: false });
const tableSchema = new mongoose.Schema({}, { strict: false });

const Bill = mongoose.model('Bill', billSchema);
const Session = mongoose.model('Session', sessionSchema);
const Table = mongoose.model('Table', tableSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bomba';

console.log('🔗 الاتصال بقاعدة البيانات...');

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ متصل بقاعدة البيانات');
    
    console.log('\n📋 اختبار ترتيب عملية تغيير الطاولة:');
    console.log('1️⃣ إضافة الجلسة للفاتورة الجديدة (الطاولة الجديدة)');
    console.log('2️⃣ حذف الجلسة من الفاتورة القديمة (الطاولة القديمة)');
    console.log('3️⃣ إذا أصبحت الفاتورة القديمة فارغة، حذفها باستخدام دالة حذف الفاتورة');
    
    // البحث عن جلسة نشطة للاختبار
    const activeSessions = await Session.find({ 
      status: 'active',
      bill: { $exists: true }
    }).limit(5);
    
    console.log(`\n🎮 وُجدت ${activeSessions.length} جلسة نشطة للاختبار:`);
    
    for (const session of activeSessions) {
      console.log(`\n📱 الجلسة: ${session.deviceName} (${session._id})`);
      console.log(`   الحالة: ${session.status}`);
      console.log(`   الفاتورة الحالية: ${session.bill?.billNumber || 'غير محددة'} (${session.bill?._id})`);
      
      if (session.bill) {
        const bill = await Bill.findById(session.bill._id);
        if (bill) {
          console.log(`   الطاولة الحالية: ${bill.table ? 'موجودة' : 'غير محددة'}`);
          console.log(`   عدد الجلسات في الفاتورة: ${bill.sessions?.length || 0}`);
          console.log(`   عدد الطلبات في الفاتورة: ${bill.orders?.length || 0}`);
          console.log(`   مجموع الفاتورة: ${bill.total || 0} ج.م`);
          
          // التحقق من وجود الجلسة في الفاتورة
          const sessionInBill = bill.sessions?.some(s => {
            const sId = s._id ? s._id.toString() : s.toString();
            return sId === session._id.toString();
          });
          console.log(`   الجلسة موجودة في الفاتورة: ${sessionInBill ? '✅ نعم' : '❌ لا'}`);
        }
      }
    }
    
    // البحث عن الطاولات المتاحة
    const availableTables = await Table.find({}).limit(5);
    console.log(`\n🪑 الطاولات المتاحة للاختبار: ${availableTables.length}`);
    availableTables.forEach((table, index) => {
      console.log(`   ${index + 1}. طاولة ${table.number} (${table._id}) - الحالة: ${table.status}`);
    });
    
    console.log('\n💡 لاختبار تغيير الطاولة:');
    console.log('1. اختر جلسة نشطة من القائمة أعلاه');
    console.log('2. اختر طاولة مختلفة من القائمة');
    console.log('3. استخدم API endpoint: PUT /api/sessions/{sessionId}/change-table');
    console.log('4. راقب اللوجز للتأكد من الترتيب الصحيح');
    
    console.log('\n🔍 مثال على طلب API:');
    if (activeSessions.length > 0 && availableTables.length > 0) {
      console.log(`PUT /api/sessions/${activeSessions[0]._id}/change-table`);
      console.log(`Body: { "newTableId": "${availableTables[0]._id}" }`);
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ:', error);
    process.exit(1);
  });