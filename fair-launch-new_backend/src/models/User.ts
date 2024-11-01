// models/User.ts
import mongoose, { Types } from 'mongoose';

const PINATA_GATEWAY_URL = process.env.PINATA_GATEWAY_URL;
const defaultImg = process.env.DEFAULT_IMG_HASH

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, },
  wallet: { type: String, required: true, unique: true },
  avatar: { type: String, default: `${PINATA_GATEWAY_URL}/${defaultImg}` }
});

const User = mongoose.model('User', userSchema);

export default User;