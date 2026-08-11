// app/models/Order.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IOrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface IOrder extends Document {
  number: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  grandTotal: number;
  paymentMethod: "cash" | "card" | "bank";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  status?: string;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    zip: string;
  };
  notes?: string;
  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
  deletedBy?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
});

const ShippingAddressSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  zip: { type: String, default: "" },
});

const OrderSchema = new Schema<IOrder>(
  {
    number: { type: String, unique: true },
    customerEmail: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    customerAddress: { type: String },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bank"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    notes: { type: String },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedBy: { type: String },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Generate order number
OrderSchema.pre("save", async function (next) {
  if (this.isNew && !this.number) {
    try {
      const count = await mongoose.models.Order.countDocuments();
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const seq = String(count + 1).padStart(4, "0");
      this.number = `ORD-${year}${month}${day}-${seq}`;
    } catch (error) {
      this.number = `ORD-${Date.now()}`;
    }
  }
  next();
});

// Indexes
OrderSchema.index({ number: 1 }, { unique: true });
OrderSchema.index({ customerEmail: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);