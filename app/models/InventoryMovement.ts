// app/models/InventoryMovement.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IInventoryMovement extends Document {
  productId: string;
  productName?: string;
  type: "purchase" | "adjustment" | "sale" | "return" | "transfer";
  qty: number;
  previousStock?: number;
  newStock?: number;
  vendorId?: string;
  cost?: number;
  sellingPrice?: number;
  reference?: string;
  note?: string;
  userEmail?: string;
  userId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: { type: String, required: true, index: true },
    productName: { type: String },
    type: { 
      type: String, 
      enum: ["purchase", "adjustment", "sale", "return", "transfer"],
      required: true 
    },
    qty: { type: Number, required: true },
    previousStock: { type: Number },
    newStock: { type: Number },
    vendorId: { type: String, index: true },
    cost: { type: Number, min: 0 },
    sellingPrice: { type: Number, min: 0 },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    userEmail: { type: String, trim: true },
    userId: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for better performance
InventoryMovementSchema.index({ productId: 1, createdAt: -1 });
InventoryMovementSchema.index({ vendorId: 1, createdAt: -1 });
InventoryMovementSchema.index({ type: 1 });
InventoryMovementSchema.index({ createdAt: -1 });

export const InventoryMovement = mongoose.models.InventoryMovement || 
  mongoose.model<IInventoryMovement>("InventoryMovement", InventoryMovementSchema);