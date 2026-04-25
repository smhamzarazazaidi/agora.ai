import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export let isMongoConnected = false;

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('⚠️  MONGODB_URI missing — running in local-only mode');
      return;
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isMongoConnected = true;
    console.log('✅ MongoDB connected successfully');
  } catch (error: any) {
    console.warn('⚠️  MongoDB unavailable (IP not whitelisted or network issue). Running in local-only mode.');
    console.warn('   Tip: Whitelist 0.0.0.0/0 in MongoDB Atlas → Network Access for deployment.');
  }
};
