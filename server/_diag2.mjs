import mongoose from "mongoose";
const uri = "mongodb://localhost:27017/bomba?replicaSet=rs0";
await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const o = await db.collection("orders")
  .find({ status: { $nin: ["delivered", "draft"] } }, { projection: { status: 1, bill: 1, table: 1, createdAt: 1, "items.name": 1 } })
  .toArray();
console.log("non-delivered non-draft:", o.length);
console.log(JSON.stringify(o.slice(0, 5), null, 1));

const draftsWithPaidBill = await db.collection("orders").aggregate([
  { $match: { status: "draft", bill: { $ne: null } } },
  { $lookup: { from: "bills", localField: "bill", foreignField: "_id", as: "b" } },
  { $unwind: { path: "$b", preserveNullAndEmptyArrays: true } },
  { $match: { "b.status": "paid" } },
  { $project: { status: 1, createdAt: 1, billStatus: "$b.status" } },
  { $limit: 10 },
]).toArray();
console.log("draft orders on paid bills:", draftWithPaidBill.length, JSON.stringify(draftWithPaidBill));

const readyOnPaid = await db.collection("orders").aggregate([
  { $match: { status: { $nin: ["delivered", "draft"] } } },
  { $lookup: { from: "bills", localField: "bill", foreignField: "_id", as: "b" } },
  { $project: { status: 1, billRef: 1, billStatus: { $arrayElemAt: ["$b.status", 0] } } },
]).toArray();
console.log("active orders billStatus:", JSON.stringify(readyOnPaid));
await mongoose.disconnect();
