import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGO_URI || '';
const client = new MongoClient(uri);
const dbName=process.env.DB_NAME || '';

let db:Db | null=null;

async function connectDB() {
  if (db) return db;

  try {
    await client.connect();
    db = client.db(dbName); 
    console.log(" MongoDB Connected");
    return db;
  } catch (err) {
    console.error(" MongoDB Connection Error:", err);
    throw err;
  }
}

export default connectDB