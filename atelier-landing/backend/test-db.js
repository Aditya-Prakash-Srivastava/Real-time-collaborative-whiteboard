require('dotenv').config({ path: 'c:/Users/Asus/Whiteboard/atelier-landing/backend/.env' });
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log("Attempting to connect to:", process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB Connection Successful!");
    process.exit(0);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
}

testConnection();
