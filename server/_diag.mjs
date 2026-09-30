import mongoose from "mongoose";

const uri = process.env.MONGODB_LOCAL_URI || "mongodb://localhost:27017/bomba?replicaSet=rs0";
await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

const db = mongoose.connection.db;
const bills = db.collection("bills");
const orders = db.collection("orders");

const paid = await bills
  .find({ status: "paid" }, { projection: { orders: 1, table: 1, organization: 1, updatedAt: 1, paid: 1, remaining: 1, total: 1 } })
  .sort({ updatedAt: -1 })
  .limit(8)
  .toArray();

console.log("recent paid bills:", paid.length);
let stuckTotal = 0;
for (const b of paid) {
  const ids = (b.orders || []).map(String);
  const ors = [{ bill: b._id }];
  if (ids.length) ors.push({ _id: { $in: (b.orders || []).map(o => new mongoose.Types.ObjectId(String(o))) } });
  const stuck = await orders
    .find({ $or: ors, status: { $ne: "delivered" } }, { projection: { status: 1, items: 1, bill: 1, createdAt: 1 } })
    .toArray();
  stuckTotal += stuck.length;
  console.log(`bill ${b._id} ordersRef=${ids.length} stuck=${stuck.length} paid=${b.paid}/${b.total} upd=${b.updatedAt}`);
  for (const s of stuck.slice(0, 3)) {
    console.log(`   order ${s._id} status=${s.status} bill=${s.bill || "NONE"} items=${(s.items||[]).map(i=>`${i.name}:${i.preparedCount??0}/${i.deliveredCount??0}/${i.quantity}`).join(", ")}`);
  }
}
console.log("TOTAL stuck orders on paid bills:", stuckTotal);

const byStatus = await orders.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray();
console.log("order statuses:", JSON.stringify(byStatus));
const withBill = await orders.countDocuments({ bill: { $exists: true, $ne: null } });
console.log("orders with bill ref:", withBill, "/", await orders.estimatedDocumentCount());

await mongoose.disconnect();
