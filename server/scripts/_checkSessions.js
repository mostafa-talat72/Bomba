import mongoose from "mongoose";
import Bill from "../models/Bill.js";

await mongoose.connect("mongodb://localhost:27017/bomba");
const bills = await Bill.find({
    status: { $in: ["draft", "partial", "overdue"] },
    sessions: { $ne: [] },
});
console.log(bills.length + " bills with sessions:");
for (const b of bills) {
    console.log("  " + b.billNumber + " - " + (b.sessions || []).length + " sessions");
}
process.exit(0);
