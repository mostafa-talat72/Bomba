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
    
    console.log(`🔍 إنشاء فاتورة جديدة للجلسة: ${sessionId}`);
    
    // 1. الحصول على الجلسة
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة');
      process.exit(1);
    }
    
    console.log(`✅ الجلسة موجودة: ${session.deviceName} (${session.status})`);
    
    // 2. الحصول على الطاولة
    const table = await Table.findById(tableId);
    if (!table) {
      console.log('❌ الطاولة غير موجودة');
      process.exit(1);
    }
    
    console.log(`✅ الطاولة موجودة: طاولة ${table.number}`);
    
    // 3. إنشاء رقم فاتورة فريد
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    
    const billNumber = `BILL-${year}${month}${day}${hour}${minute}${second}${ms}`;
    
    console.log(`📋 رقم الفاتورة الجديدة: ${billNumber}`);
    
    // 4. إنشاء فاتورة جديدة
    const newBill = new Bill({
      billNumber: billNumber,
      customerName: `طاولة ${table.number}`,
      customerPhone: null,
      table: tableId,
      orders: [],
      sessions: [sessionId],
      subtotal: session.totalCost || 0,
      discount: 0,
      discountPercentage: 0,
      tax: 0,
      total: session.totalCost || 0,
      paid: 0,
      remaining: session.totalCost || 0,
      status: 'draft',
      paymentMethod: 'cash',
      notes: `فاتورة جلسة طاولة ${table.number} - ${session.deviceType} (طاولة ${table.number})`,
      billType: session.deviceType,
      dueDate: null,
      createdBy: session.createdBy,
      updatedBy: null,
      organization: session.organization,
      payments: [],
      partialPayments: [],
      itemPayments: [],
      sessionPayments: [{
        sessionId: sessionId,
        sessionCost: session.totalCost || 0,
        paidAmount: 0,
        remainingAmount: session.totalCost || 0,
        payments: []
      }],
      paymentHistory: []
    });
    
    await newBill.save();
    console.log(`✅ تم إنشاء فاتورة جديدة: ${newBill.billNumber} (${newBill._id})`);
    
    // 5. تحديث مرجع الفاتورة في الجلسة
    console.log(`🔧 تحديث مرجع الفاتورة في الجلسة من ${session.bill} إلى ${newBill._id}`);
    const updateResult = await Session.updateOne(
      { _id: sessionId },
      { $set: { bill: newBill._id } }
    );
    console.log(`✅ تم تحديث مرجع الفاتورة في الجلسة (${updateResult.modifiedCount} جلسة تم تعديلها)`);
    
    // 6. إزالة الجلسة من الفاتورة الخاطئة
    console.log('🗑️ إزالة الجلسة من الفاتورة الخاطئة...');
    const result = await Bill.updateOne(
      { _id: incorrectBillId },
      { $pull: { sessions: { _id: new mongoose.Types.ObjectId(sessionId) } } }
    );
    console.log(`✅ تم إزالة الجلسة من الفاتورة الخاطئة (${result.modifiedCount} فاتورة تم تعديلها)`);
    
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
    
    if (billsWithSession.length === 1 && updatedSession.bill.toString() === newBill._id.toString()) {
      console.log('🎉 تم إصلاح المشكلة بنجاح!');
      console.log(`✅ الجلسة مرتبطة الآن بالفاتورة الجديدة: ${newBill.billNumber}`);
    } else {
      console.log('⚠️ لا تزال هناك مشكلة في البيانات');
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ:', error);
    process.exit(1);
  });