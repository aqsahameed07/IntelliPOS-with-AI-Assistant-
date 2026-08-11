// app/models/Cart.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ICartItem {
  productId: string;
  qty: number;
  addedAt: Date;
}

export interface ICart extends Document {
  userId: string;
  userEmail: string;
  items: ICartItem[];
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>({
  productId: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  addedAt: { type: Date, default: Date.now },
});

const CartSchema = new Schema<ICart>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    userEmail: { type: String, default: "" },
    items: { type: [CartItemSchema], default: [] },
  },
  { 
    timestamps: { updatedAt: true, createdAt: false },
    collection: "carts" // Explicitly set collection name
  }
);

// Use existing model or create new one
export const Cart = mongoose.models.Cart || mongoose.model<ICart>("Cart", CartSchema);