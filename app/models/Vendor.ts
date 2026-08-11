// app/models/Vendor.ts
import mongoose, { Schema, model, models } from "mongoose";

export interface IVendor {
  _id?: string;
  name: string;
  contactName?: string;
  email: string;
  phone: string;
  address?: string;
  gstin?: string;
  notes?: string;
  image?: string;
  status: "active" | "inactive";
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const VendorSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },
    contactName: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    address: {
      type: String,
      default: "",
    },
    gstin: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes
VendorSchema.index({ name: 1 });
VendorSchema.index({ email: 1 }, { unique: true });
VendorSchema.index({ phone: 1 });

export default models.Vendor || model("Vendor", VendorSchema);