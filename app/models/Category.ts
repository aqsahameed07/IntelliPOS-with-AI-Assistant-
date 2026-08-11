import mongoose, { Schema, models } from "mongoose";

export interface ICategory {
  _id?: string;
  name: string;
  description?: string;
  image?: string;
  status: "active" | "inactive";
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted: boolean;
  deletedBy?: string;
  deletedAt?: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    image: {
      type: String,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: String,
      ref: "User",
    },
    updatedBy: {
      type: String,
      ref: "User",
    },
    deletedBy: {
      type: String,
      ref: "User",
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes
CategorySchema.index({ name: 1 });
CategorySchema.index({ isDeleted: 1 });
CategorySchema.index({ status: 1 });
CategorySchema.index({ createdBy: 1 });

export const Category = models.Category || mongoose.model<ICategory>("Category", CategorySchema);