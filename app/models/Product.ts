// app/models/Product.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  category: string;
  sku: string;
  barcode?: string;
  brand?: string;
  supplierId?: string;
  description: string;
  image?: string;
  gallery: string[];
  purchasePrice: number;
  sellingPrice: number;
  discount: number;
  tax: number;
  unit: string;
  tags: string[];
  stock: number;
  minStock: number;
  status: "active" | "inactive";
  sales?: number;
  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
  deletedBy?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    barcode: { type: String, trim: true, sparse: true },
    brand: { type: String, trim: true },
    supplierId: { type: String, trim: true },
    description: { type: String, default: "" },
    image: { type: String },
    gallery: { type: [String], default: [] },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    tax: { type: Number, default: 0, min: 0, max: 100 },
    unit: { type: String, default: "Piece", trim: true },
    tags: { type: [String], default: [] },
    stock: { type: Number, required: true, default: 0, min: 0 },
    minStock: { type: Number, required: true, default: 5, min: 0 },
    status: { 
      type: String, 
      enum: ["active", "inactive"], 
      default: "active" 
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedBy: { type: String },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for better performance
ProductSchema.index({ name: "text", sku: "text", brand: "text" });
ProductSchema.index({ category: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ isDeleted: 1 });
ProductSchema.index({ sku: 1 }, { unique: true });

export const Product = mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);