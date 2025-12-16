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
    
    const sessionId = '694173e88b9f35c6663c6592';
    
    console.log(`🔍 الحل النهائي للجلسة المكررة: ${sessionId}`);
    
    // 1. الحصول على الجلسة
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة');
      process.exit(1);
    }
    
    console.log(`✅ الجلسة موجودة: ${session.deviceName} (${session.status})`);
    console.log(`   الفاتورة المرجعة في الجلسة: ${session.bill}`);
    
    // 2. البحث عن جميع الفواتير التي تحتوي على هذه الجلسة
    // استخدام طرق مختلفة للبحث
    const billsWithSession1 = await Bill.find({
      sessions: { $in: [new mongoose.Types.ObjectId(sessionId)] }
    });
    
    const billsWithSession2 = await Bill.find({
      'sessions._id': new mongoose.Types.ObjectId(sessionId)
    });
    
    const billsWithSession3 = await Bill.find({
      sessions: new mongoose.Types.ObjectId(sessionId)
    });
    
    // دمج النتائج وإزالة المكررات
    const allBills = [...billsWithSession1, ...billsWithSession2, ...billsWithSession3];
    const uniqueBillIds = [...new Set(allBills.map(b => b._id.toString()))];
    const billsWithSession = allBills.filter((bill, index, arr) => 
      arr.findIndex(b => b._id.toString() === bill._id.toString()) === index
    );
    
    console.log(`🔍 نتائج البحث:`);
    console.log(`   الطريقة 1 ($in): ${billsWithSession1.length} فاتورة`);
    console.log(`   الطريقة 2 (sessions._id): ${billsWithSession2.length} فاتورة`);
    console.log(`   الطريقة 3 (sessions): ${billsWithSession3.length} فاتورة`);
    console.log(`   المجموع الفريد: ${billsWithSession.length} فاتورة`);
    
    console.log(`📋 وُجدت ${billsWithSession.length} فاتورة تحتوي على هذه الجلسة:`);
    billsWithSession.forEach((bill, index) => {
      console.log(`   ${index + 1}. ${bill.billNumber} (${bill._id})`);
      console.log(`      العميل: ${bill.customerName}`);
      console.log(`      عدد الجلسات: ${bill.sessions.length}`);
      console.log(`      عدد الطلبات: ${bill.orders.length}`);
      console.log(`      المجموع: ${bill.total} ج.م`);
    });
    
    if (billsWithSession.length <= 1) {
      console.log('✅ لا توجد مشكلة - الجلسة في فاتورة واحدة فقط أو لا توجد');
      process.exit(0);
    }
    
    // 3. تحديد الفاتورة الصحيحة (التي يشير إليها session.bill)
    const correctBillId = session.bill.toString();
    const correctBill = billsWithSession.find(b => b._id.toString() === correctBillId);
    const incorrectBills = billsWithSession.filter(b => b._id.toString() !== correctBillId);
    
    console.log(`\n🎯 الفاتورة الصحيحة: ${correctBill ? correctBill.billNumber : 'غير موجودة'}`);
    console.log(`❌ الفواتير الخاطئة: ${incorrectBills.length}`);
    
    // 4. إزالة الجلسة من الفواتير الخاطئة
    for (const incorrectBill of incorrectBills) {
      console.log(`\n🗑️ إزالة الجلسة من الفاتورة الخاطئة: ${incorrectBill.billNumber}`);
      
      // إزالة الجلسة من array الجلسات
      const originalLength = incorrectBill.sessions.length;
      incorrectBill.sessions = incorrectBill.sessions.filter(s => {
        const sId = s._id ? s._id.toString() : s.toString();
        return sId !== sessionId;
      });
      
      console.log(`   تم تقليل الجلسات من ${originalLength} إلى ${incorrectBill.sessions.length}`);
      
      // إزالة sessionPayment إذا وجد
      if (incorrectBill.sessionPayments) {
        const originalPaymentsLength = incorrectBill.sessionPayments.length;
        incorrectBill.sessionPayments = incorrectBill.sessionPayments.filter(sp => 
          sp.sessionId.toString() !== sessionId
        );
        console.log(`   تم تقليل sessionPayments من ${originalPaymentsLength} إلى ${incorrectBill.sessionPayments.length}`);
      }
      
      // إعادة حساب المجاميع
      let newSubtotal = 0;
      
      // حساب مجموع الطلبات
      if (incorrectBill.orders && incorrectBill.orders.length > 0) {
        // هنا نحتاج لجلب الطلبات الفعلية لحساب مجموعها
        const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
        const orders = await Order.find({ _id: { $in: incorrectBill.orders } });
        newSubtotal += orders.reduce((sum, order) => sum + (order.total || 0), 0);
      }
      
      // حساب مجموع الجلسات المتبقية
      if (incorrectBill.sessions && incorrectBill.sessions.length > 0) {
        const remainingSessions = await Session.find({ _id: { $in: incorrectBill.sessions } });
        newSubtotal += remainingSessions.reduce((sum, s) => sum + (s.finalCost || s.totalCost || 0), 0);
      }
      
      incorrectBill.subtotal = newSubtotal;
      incorrectBill.total = newSubtotal - (incorrectBill.discount || 0);
      incorrectBill.remaining = incorrectBill.total - (incorrectBill.paid || 0);
      
      await incorrectBill.save();
      console.log(`✅ تم تحديث الفاتورة ${incorrectBill.billNumber} - المجموع الجديد: ${incorrectBill.total}`);
      
      // إذا أصبحت الفاتورة فارغة، احذفها
      if (incorrectBill.sessions.length === 0 && incorrectBill.orders.length === 0) {
        console.log(`🗑️ الفاتورة ${incorrectBill.billNumber} أصبحت فارغة - سيتم حذفها`);
        
        // حذف الفاتورة
        await incorrectBill.deleteOne();
        console.log(`✅ تم حذف الفاتورة الفارغة ${incorrectBill.billNumber}`);
        
        // تحديث حالة الطاولة إذا كانت مرتبطة بطاولة
        if (incorrectBill.table) {
          // البحث عن فواتير أخرى غير مدفوعة لنفس الطاولة
          const unpaidBills = await Bill.find({
            table: incorrectBill.table,
            status: { $in: ['draft', 'partial', 'overdue'] }
          });
          
          // تحديث حالة الطاولة
          const newTableStatus = unpaidBills.length > 0 ? 'occupied' : 'empty';
          await Table.findByIdAndUpdate(incorrectBill.table, { status: newTableStatus });
          console.log(`✅ تم تحديث حالة الطاولة إلى: ${newTableStatus}`);
        }
      }
    }
    
    // 5. التأكد من وجود الجلسة في الفاتورة الصحيحة
    if (correctBill) {
      const sessionExists = correctBill.sessions.some(s => {
        const sId = s._id ? s._id.toString() : s.toString();
        return sId === sessionId;
      });
      
      if (!sessionExists) {
        console.log(`🔧 إضافة الجلسة إلى الفاتورة الصحيحة: ${correctBill.billNumber}`);
        correctBill.sessions.push(new mongoose.Types.ObjectId(sessionId));
        
        // إضافة sessionPayment إذا لم يكن موجوداً
        const sessionPaymentExists = correctBill.sessionPayments?.some(sp => 
          sp.sessionId.toString() === sessionId
        );
        
        if (!sessionPaymentExists) {
          const sessionPayment = {
            sessionId: new mongoose.Types.ObjectId(sessionId),
            sessionCost: session.finalCost || session.totalCost || 0,
            paidAmount: 0,
            remainingAmount: session.finalCost || session.totalCost || 0,
            payments: []
          };
          
          if (!correctBill.sessionPayments) {
            correctBill.sessionPayments = [];
          }
          correctBill.sessionPayments.push(sessionPayment);
        }
        
        await correctBill.save();
        console.log(`✅ تم إضافة الجلسة إلى الفاتورة الصحيحة`);
      }
    }
    
    // 6. التحقق النهائي
    console.log('\n📊 التحقق النهائي...');
    
    const finalBillsWithSession = await Bill.find({
      sessions: { $in: [new mongoose.Types.ObjectId(sessionId)] }
    });
    
    console.log(`📋 الجلسة موجودة الآن في ${finalBillsWithSession.length} فاتورة:`);
    finalBillsWithSession.forEach(bill => {
      console.log(`   - ${bill.billNumber} (${bill._id})`);
    });
    
    const updatedSession = await Session.findById(sessionId);
    console.log(`🔍 مرجع الفاتورة في الجلسة: ${updatedSession.bill}`);
    
    if (finalBillsWithSession.length === 1 && updatedSession.bill.toString() === finalBillsWithSession[0]._id.toString()) {
      console.log('\n🎉 تم إصلاح المشكلة بنجاح!');
      console.log(`✅ الجلسة مرتبطة الآن بالفاتورة: ${finalBillsWithSession[0].billNumber}`);
      console.log(`✅ الجلسة موجودة في فاتورة واحدة فقط`);
      console.log(`✅ مرجع الفاتورة في الجلسة صحيح`);
    } else {
      console.log('\n⚠️ لا تزال هناك مشكلة في البيانات');
      console.log(`   الجلسة في ${finalBillsWithSession.length} فاتورة`);
      console.log(`   مرجع الفاتورة: ${updatedSession.bill}`);
      if (finalBillsWithSession.length > 0) {
        console.log(`   الفاتورة الموجودة: ${finalBillsWithSession[0]._id}`);
      }
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ:', error);
    process.exit(1);
  });