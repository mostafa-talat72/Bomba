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
    const incorrectBillId = '69402fb926c9c427fe583a25';
    const tableId = '693906a88ced232dd30b50f4'; // طاولة 2
    
    console.log(`🔍 الحل النهائي للجلسة: ${sessionId}`);
    
    // 1. الحصول على الجلسة
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة');
      process.exit(1);
    }
    
    console.log(`✅ الجلسة موجودة: ${session.deviceName} (${session.status})`);
    console.log(`   الفاتورة الحالية: ${session.bill}`);
    
    // 2. إزالة الجلسة من الفاتورة الخاطئة أولاً
    console.log('🗑️ إزالة الجلسة من الفاتورة الخاطئة...');
    
    // استخدام طرق مختلفة للإزالة
    const removeResult1 = await Bill.updateOne(
      { _id: incorrectBillId },
      { $pull: { sessions: { _id: new mongoose.Types.ObjectId(sessionId) } } }
    );
    console.log(`   طريقة 1: ${removeResult1.modifiedCount} فاتورة تم تعديلها`);
    
    const removeResult2 = await Bill.updateOne(
      { _id: incorrectBillId },
      { $pull: { sessions: new mongoose.Types.ObjectId(sessionId) } }
    );
    console.log(`   طريقة 2: ${removeResult2.modifiedCount} فاتورة تم تعديلها`);
    
    // 3. التحقق من الفاتورة الخاطئة
    const incorrectBill = await Bill.findById(incorrectBillId);
    if (incorrectBill) {
      console.log(`📋 الفاتورة الخاطئة بعد الإزالة:`);
      console.log(`   عدد الجلسات: ${incorrectBill.sessions?.length || 0}`);
      
      // إزالة يدوية إذا لزم الأمر
      const sessionStillExists = incorrectBill.sessions?.some(s => 
        s._id.toString() === sessionId || s.toString() === sessionId
      );
      
      if (sessionStillExists) {
        console.log('🔧 إزالة يدوية للجلسة...');
        incorrectBill.sessions = incorrectBill.sessions.filter(s => {
          const sId = s._id ? s._id.toString() : s.toString();
          return sId !== sessionId;
        });
        await incorrectBill.save();
        console.log('✅ تم إزالة الجلسة يدوياً');
      }
    }
    
    // 4. البحث عن فاتورة موجودة للطاولة أو إنشاء جديدة
    console.log('\n🔍 البحث عن فاتورة للطاولة...');
    let targetBill = await Bill.findOne({
      table: tableId,
      status: { $in: ['draft', 'pending'] }
    });
    
    if (targetBill) {
      console.log(`✅ وُجدت فاتورة موجودة: ${targetBill.billNumber}`);
    } else {
      console.log('🆕 إنشاء فاتورة جديدة...');
      
      // الحصول على الطاولة
      const table = await Table.findById(tableId);
      if (!table) {
        console.log('❌ الطاولة غير موجودة');
        process.exit(1);
      }
      
      // إنشاء رقم فاتورة فريد
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hour = now.getHours().toString().padStart(2, '0');
      const minute = now.getMinutes().toString().padStart(2, '0');
      const second = now.getSeconds().toString().padStart(2, '0');
      const ms = now.getMilliseconds().toString().padStart(3, '0');
      
      const billNumber = `BILL-${year}${month}${day}${hour}${minute}${second}${ms}`;
      
      targetBill = new Bill({
        billNumber: billNumber,
        customerName: `طاولة ${table.number}`,
        customerPhone: null,
        table: tableId,
        orders: [],
        sessions: [],
        subtotal: 0,
        discount: 0,
        discountPercentage: 0,
        tax: 0,
        total: 0,
        paid: 0,
        remaining: 0,
        status: 'draft',
        paymentMethod: 'cash',
        notes: `فاتورة جلسة طاولة ${table.number} - playstation (طاولة ${table.number})`,
        billType: 'playstation',
        dueDate: null,
        createdBy: session.createdBy,
        updatedBy: null,
        organization: session.organization,
        payments: [],
        partialPayments: [],
        itemPayments: [],
        sessionPayments: [],
        paymentHistory: []
      });
      
      await targetBill.save();
      console.log(`✅ تم إنشاء فاتورة جديدة: ${targetBill.billNumber}`);
    }
    
    // 5. إضافة الجلسة للفاتورة المستهدفة
    console.log('\n🔗 إضافة الجلسة للفاتورة المستهدفة...');
    
    // التحقق من عدم وجود الجلسة مسبقاً
    const sessionExists = targetBill.sessions.some(s => {
      const sId = s._id ? s._id.toString() : s.toString();
      return sId === sessionId;
    });
    
    if (!sessionExists) {
      targetBill.sessions.push(new mongoose.Types.ObjectId(sessionId));
      
      // إضافة sessionPayment
      const sessionPayment = {
        sessionId: new mongoose.Types.ObjectId(sessionId),
        sessionCost: session.totalCost || 0,
        paidAmount: 0,
        remainingAmount: session.totalCost || 0,
        payments: []
      };
      targetBill.sessionPayments.push(sessionPayment);
      
      // تحديث المجاميع
      targetBill.subtotal = (targetBill.subtotal || 0) + (session.totalCost || 0);
      targetBill.total = targetBill.subtotal;
      targetBill.remaining = targetBill.total - (targetBill.paid || 0);
      
      await targetBill.save();
      console.log('✅ تم إضافة الجلسة للفاتورة المستهدفة');
    } else {
      console.log('ℹ️ الجلسة موجودة بالفعل في الفاتورة المستهدفة');
    }
    
    // 6. تحديث مرجع الفاتورة في الجلسة
    console.log('\n🔧 تحديث مرجع الفاتورة في الجلسة...');
    const updateResult = await Session.updateOne(
      { _id: sessionId },
      { $set: { bill: targetBill._id } }
    );
    console.log(`✅ تم تحديث مرجع الفاتورة (${updateResult.modifiedCount} جلسة تم تعديلها)`);
    
    // 7. التحقق النهائي
    console.log('\n📊 التحقق النهائي...');
    
    const billsWithSession = await Bill.find({
      'sessions._id': new mongoose.Types.ObjectId(sessionId)
    });
    
    console.log(`📋 الجلسة موجودة في ${billsWithSession.length} فاتورة:`);
    billsWithSession.forEach(bill => {
      console.log(`   - ${bill.billNumber} (${bill._id})`);
    });
    
    const updatedSession = await Session.findById(sessionId);
    console.log(`🔍 مرجع الفاتورة في الجلسة: ${updatedSession.bill}`);
    
    if (billsWithSession.length === 1 && updatedSession.bill.toString() === targetBill._id.toString()) {
      console.log('\n🎉 تم إصلاح المشكلة بنجاح!');
      console.log(`✅ الجلسة مرتبطة الآن بالفاتورة: ${targetBill.billNumber}`);
      console.log(`✅ الجلسة موجودة في فاتورة واحدة فقط`);
      console.log(`✅ مرجع الفاتورة في الجلسة صحيح`);
    } else {
      console.log('\n⚠️ لا تزال هناك مشكلة في البيانات');
      console.log(`   الجلسة في ${billsWithSession.length} فاتورة`);
      console.log(`   مرجع الفاتورة: ${updatedSession.bill}`);
      console.log(`   الفاتورة المستهدفة: ${targetBill._id}`);
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ:', error);
    process.exit(1);
  });