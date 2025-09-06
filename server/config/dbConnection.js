import mongoose from "mongoose";

mongoose.set("strictQuery", false);

const connectionToDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1); // stop app if DB fails
  }
};

export default connectionToDB;
