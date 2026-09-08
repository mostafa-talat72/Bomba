import mongoose from "mongoose";
const inspect = await mongoose.createConnection("mongodb://127.0.0.1:27019/?directConnection=true", { serverSelectionTimeoutMS: 5000 }).asPromise();
const sys = await mongoose.createConnection("mongodb://127.0.0.1:27017/?directConnection=true", { serverSelectionTimeoutMS: 5000 }).asPromise();
const cols = ["bills", "orders", "users", "organizations", "menuitems", "tables", "sessions", "inventoryitems"];
for (const c of cols) {
  let a = "?", b = "?";
  try { a = await inspect.db.db("bomba").collection(c).countDocuments(); } catch (e) { a = "ERR"; }
  try { b = await sys.db.db("bomba").collection(c).countDocuments(); } catch (e) { b = "ERR"; }
  console.log(`${c}: bundled(27018-data)=${a} | system(27017)=${b}${a !== b ? "  <-- DIFFERS" : ""}`);
}
await inspect.close();
await sys.close();
process.exit(0);
