// app/models/Invoice.ts - Remove the pre-save hook
import mongoose, { Schema, Document } from "mongoose";

export interface IInvoiceItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface IInvoice extends Document {
  number: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  employeeId?: string;
  employeeEmail: string;
  employeeName: string;
  items: IInvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: "cash" | "card" | "bank" | "pending";
  paymentStatus: "paid" | "pending" | "failed";
  paymentReference?: string;
  notes?: string;
  status: "draft" | "confirmed" | "cancelled" | "refunded";
  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
  deletedBy?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
});

const InvoiceSchema = new Schema<IInvoice>(
  {
    number: { 
      type: String, 
      unique: true,
      required: true,
    },
    customerId: { type: String, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String },
    customerPhone: { type: String },
    employeeId: { type: String },
    employeeEmail: { type: String, required: true },
    employeeName: { type: String, required: true },
    items: { type: [InvoiceItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: { 
      type: String, 
      enum: ["cash", "card", "bank", "pending"],
      default: "cash"
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "failed"],
      default: "pending"
    },
    paymentReference: { type: String },
    notes: { type: String },
    status: {
      type: String,
      enum: ["draft", "confirmed", "cancelled", "refunded"],
      default: "confirmed"
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedBy: { type: String },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Remove the pre-save hook - we'll generate the number in the API route

// Indexes
InvoiceSchema.index({ number: 1 }, { unique: true });
InvoiceSchema.index({ customerId: 1, createdAt: -1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.index({ paymentStatus: 1 });


export const Invoice = mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema);