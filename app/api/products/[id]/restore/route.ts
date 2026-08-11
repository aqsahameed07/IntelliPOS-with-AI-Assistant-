// app/api/products/[id]/restore/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Product } from "@/app/models/Product";
import { withAuth } from "@/lib/authMiddleware";

// PATCH - Restore soft-deleted product (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();
        
        const { id: paramId } = await params;
        const id = paramId || request.nextUrl.pathname.split("/").pop() || "";
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Product ID is required",
          }, { status: 400 });
        }
        
        // Check if product exists and is deleted
        const product = await Product.findOne({
          _id: id,
          isDeleted: true,
        });
        
        if (!product) {
          return NextResponse.json({
            success: false,
            error: "Product not found or not deleted",
          }, { status: 404 });
        }
        
        // Restore product
        await Product.findByIdAndUpdate(id, {
          isDeleted: false,
          status: "active",
          deletedBy: undefined,
          deletedAt: undefined,
          updatedBy: user.id,
        });
        
        return NextResponse.json({
          success: true,
          message: "Product restored successfully",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error restoring product:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to restore product",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}