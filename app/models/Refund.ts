// app/models/Refund.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IRefundLine {
  productId: string;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
  restock: boolean;
}

export interface IExchangeLine {
  productId: string;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
}

export interface IRefund extends Document {
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  employeeEmail: string;
  employeeName: string;
  type: "full" | "partial" | "exchange";
  reason: string;
  returnedItems: IRefundLine[];
  exchangedItems: IExchangeLine[];
  refundSubtotal: number;
  exchangeSubtotal: number;
  taxAdjustment: number;
  exchangeTax: number;
  netRefund: number;
  amountDue: number;
  settlementMethod?: "cash" | "card" | "bank";
  refundMethod: "cash" | "card" | "bank" | "store_credit" | "exchange_only";
  status: "draft" | "processed" | "cancelled";
  exchangeInvoiceId?: string;
  exchangeInvoiceNumber?: string;
  notes?: string;
  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
  deletedBy?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefundLineSchema = new Schema<IRefundLine>({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  restock: { type: Boolean, default: true },
});

const ExchangeLineSchema = new Schema<IExchangeLine>({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
});

const RefundSchema = new Schema<IRefund>(
  {
    number: { 
      type: String, 
      unique: true,
      required: true,
    },
    invoiceId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: String, index: true },
    customerName: { type: String, required: true },
    employeeEmail: { type: String, required: true },
    employeeName: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["full", "partial", "exchange"],
      required: true 
    },
    reason: { type: String, required: true },
    returnedItems: { type: [RefundLineSchema], default: [] },
    exchangedItems: { type: [ExchangeLineSchema], default: [] },
    refundSubtotal: { type: Number, required: true, min: 0 },
    exchangeSubtotal: { type: Number, default: 0, min: 0 },
    taxAdjustment: { type: Number, default: 0 },
    exchangeTax: { type: Number, default: 0 },
    netRefund: { type: Number, required: true },
    amountDue: { type: Number, default: 0, min: 0 },
    settlementMethod: { 
      type: String, 
      enum: ["cash", "card", "bank"],
    },
    refundMethod: { 
      type: String, 
      enum: ["cash", "card", "bank", "store_credit", "exchange_only"],
      required: true 
    },
    status: {
      type: String,
      enum: ["draft", "processed", "cancelled"],
      default: "processed"
    },
    exchangeInvoiceId: { type: String },
    exchangeInvoiceNumber: { type: String },
    notes: { type: String },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedBy: { type: String },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Generate refund number
RefundSchema.pre('save', async function(next) {
  if (this.isNew && !this.number) {
    try {
      const RefundModel = mongoose.models.Refund;
      const count = await RefundModel.countDocuments();
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const seq = String(count + 1).padStart(4, '0');
      this.number = `REF-${year}${month}${day}-${seq}`;
    } catch (error) {
      this.number = `REF-${Date.now()}`;
    }
  }
  next();
});

// Indexes
RefundSchema.index({ number: 1 }, { unique: true });
RefundSchema.index({ invoiceId: 1, createdAt: -1 });
RefundSchema.index({ customerId: 1, createdAt: -1 });
RefundSchema.index({ type: 1, createdAt: -1 });
RefundSchema.index({ status: 1 });
RefundSchema.index({ createdAt: -1 });

export const Refund = mongoose.models.Refund || mongoose.model<IRefund>("Refund", RefundSchema);