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
    
    // مراقبة الفواتير الفارغة
    console.log('\n🔍 مراقبة الفواتير الفارغة (بدون جلسات وطلبات):');
    
    const emptyBills = await Bill.find({
      $and: [
        { $or: [{ sessions: { $size: 0 } }, { sessions: { $exists: false } }] },
        { $or: [{ orders: { $size: 0 } }, { orders: { $exists: false } }] }
      ]
    });
    
    console.log(`📋 وُجدت ${emptyBills.length} فاتورة فارغة:`);
    
    for (const bill of emptyBills) {
      console.log(`\n📄 الفاتورة: ${bill.billNumber} (${bill._id})`);
      console.log(`   العميل: ${bill.customerName}`);
      console.log(`   الحالة: ${bill.status}`);
      console.log(`   عدد الجلسات: ${bill.sessions?.length || 0}`);
      console.log(`   عدد الطلبات: ${bill.orders?.length || 0}`);
      console.log(`   المجموع: ${bill.total || 0} ج.م`);
      console.log(`   تاريخ الإنشاء: ${bill.createdAt}`);
      console.log(`   آخر تحديث: ${bill.updatedAt}`);
      
      // التحقق من وجود جلسات تشير إلى هذه الفاتورة
      const sessionsPointingToBill = await Session.find({ bill: bill._id });
      if (sessionsPointingToBill.length > 0) {
        console.log(`   ⚠️ تحذير: ${sessionsPointingToBill.length} جلسة تشير إلى هذه الفاتورة الفارغة!`);
        sessionsPointingToBill.forEach((session, index) => {
          console.log(`     ${index + 1}. ${session.deviceName} (${session._id}) - الحالة: ${session.status}`);
        });
      } else {
        console.log(`   ✅ لا توجد جلسات تشير إلى هذه الفاتورة`);
      }
    }
    
    // مراقبة الجلسات النشطة وفواتيرها
    console.log('\n🎮 مراقبة الجلسات النشطة وفواتيرها:');
    
    const activeSessions = await Session.find({ status: 'active' });
    console.log(`📱 وُجدت ${activeSessions.length} جلسة نشطة:`);
    
    for (const session of activeSessions) {
      console.log(`\n🎮 الجلسة: ${session.deviceName} (${session._id})`);
      console.log(`   الفاتورة المرجعة: ${session.bill}`);
      
      if (session.bill) {
        const bill = await Bill.findById(session.bill);
        if (bill) {
          console.log(`   ✅ الفاتورة موجودة: ${bill.billNumber}`);
          console.log(`     عدد الجلسات في الفاتورة: ${bill.sessions?.length || 0}`);
          console.log(`     عدد الطلبات في الفاتورة: ${bill.orders?.length || 0}`);
          
          // التحقق من وجود الجلسة في الفاتورة
          const sessionInBill = bill.sessions?.some(s => {
            const sId = s._id ? s._id.toString() : s.toString();
            return sId === session._id.toString();
          });
          console.log(`     الجلسة موجودة في الفاتورة: ${sessionInBill ? '✅ نعم' : '❌ لا'}`);
          
          if (!sessionInBill) {
            console.log(`     ⚠️ تحذير: الجلسة تشير إلى الفاتورة لكن الفاتورة لا تحتوي على الجلسة!`);
          }
        } else {
          console.log(`   ❌ الفاتورة غير موجودة!`);
        }
      } else {
        console.log(`   ⚠️ الجلسة لا تشير إلى أي فاتورة`);
      }
    }
    
    // إحصائيات عامة
    console.log('\n📊 إحصائيات عامة:');
    const totalBills = await Bill.countDocuments();
    const totalSessions = await Session.countDocuments();
    const activeBills = await Bill.countDocuments({ status: { $in: ['draft', 'partial', 'overdue'] } });
    
    console.log(`   إجمالي الفواتير: ${totalBills}`);
    console.log(`   الفواتير النشطة: ${activeBills}`);
    console.log(`   الفواتير الفارغة: ${emptyBills.length}`);
    console.log(`   إجمالي الجلسات: ${totalSessions}`);
    console.log(`   الجلسات النشطة: ${activeSessions.length}`);
    
    if (emptyBills.length > 0) {
      console.log('\n💡 توصية: يمكن حذف الفواتير الفارغة التي لا تشير إليها أي جلسة');
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ:', error);
    process.exit(1);
  });