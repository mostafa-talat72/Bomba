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
    const correctBillId = '694173e88b9f35c6663c6595';
    const incorrectBillId = '69402fb926c9c427fe583a25';
    
    console.log(`🔍 إصلاح الجلسة: ${sessionId}`);
    
    // 1. التحقق من الجلسة
    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('❌ الجلسة غير موجودة');
      process.exit(1);
    }
    
    console.log(`✅ الجلسة موجودة - الحالة: ${session.status}`);
    console.log(`🔍 الفاتورة الحالية في الجلسة: ${session.bill}`);
    
    // 2. تحديث مرجع الفاتورة في الجلسة
    if (session.bill.toString() !== correctBillId) {
      console.log('🔧 تحديث مرجع الفاتورة في الجلسة...');
      session.bill = correctBillId;
      await session.save();
      console.log('✅ تم تحديث مرجع الفاتورة في الجلسة');
    } else {
      console.log('✅ مرجع الفاتورة في الجلسة صحيح');
    }
    
    // 3. إزالة الجلسة من الفاتورة الخاطئة
    console.log('🗑️ إزالة الجلسة من الفاتورة الخاطئة...');
    const result1 = await Bill.updateOne(
      { _id: incorrectBillId },
      { $pull: { sessions: { _id: new mongoose.Types.ObjectId(sessionId) } } }
    );
    console.log(`✅ نتيجة الإزالة: ${result1.modifiedCount} فاتورة تم تعديلها`);
    
    // 3.1. التحقق من أن الفاتورة الخاطئة أصبحت فارغة وحذفها إذا لزم الأمر
    const incorrectBillAfterUpdate = await Bill.findById(incorrectBillId);
    if (incorrectBillAfterUpdate && incorrectBillAfterUpdate.sessions.length === 0 && incorrectBillAfterUpdate.orders.length === 0) {
      console.log('🗑️ الفاتورة الخاطئة أصبحت فارغة، سيتم حذفها...');
      await Bill.findByIdAndDelete(incorrectBillId);
      console.log('✅ تم حذف الفاتورة الفارغة');
    }
    
    // 4. التأكد من وجود الجلسة في الفاتورة الصحيحة
    console.log('✅ التحقق من الفاتورة الصحيحة...');
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
    
    // البحث بطرق مختلفة
    console.log('🔍 البحث بطريقة 1...');
    const bills1 = await Bill.find({
      'sessions._id': new mongoose.Types.ObjectId(sessionId)
    });
    console.log(`وُجد في ${bills1.length} فاتورة بالطريقة 1`);
    
    console.log('🔍 البحث بطريقة 2...');
    const bills2 = await Bill.find({
      sessions: { $elemMatch: { _id: new mongoose.Types.ObjectId(sessionId) } }
    });
    console.log(`وُجد في ${bills2.length} فاتورة بالطريقة 2`);
    
    console.log('🔍 البحث بطريقة 3...');
    const bills3 = await Bill.find({
      sessions: { $in: [new mongoose.Types.ObjectId(sessionId)] }
    });
    console.log(`وُجد في ${bills3.length} فاتورة بالطريقة 3`);
    
    const billsWithSession = bills1.length > 0 ? bills1 : (bills2.length > 0 ? bills2 : bills3);
    
    console.log(`📋 الجلسة موجودة في ${billsWithSession.length} فاتورة:`);
    billsWithSession.forEach(bill => {
      console.log(`   - ${bill.billNumber} (${bill._id})`);
    });
    
    if (billsWithSession.length === 1) {
      console.log('🎉 تم إصلاح المشكلة بنجاح!');
    } else {
      console.log('⚠️ لا تزال هناك مشكلة في البيانات');
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ خطأ:', error);
    process.exit(1);
  });