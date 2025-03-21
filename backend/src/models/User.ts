import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    phoneNumber: string;
    privateKey: string;
    publicKey: string;
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    phoneNumber: { type: String, required: true, unique: true },
    privateKey: { type: String, required: true },
    publicKey: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>('User', UserSchema); 