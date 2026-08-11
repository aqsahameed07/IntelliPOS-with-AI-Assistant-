// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/app/models/Order";
import { Product } from "@/app/models/Product";
import { withAuth } from "@/lib/authMiddleware";

// GET - Get single order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Order ID is required",
      }, { status: 400 });
    }

    const order = await Order.findOne({ _id: id, isDeleted: false });

    if (!order) {
      return NextResponse.json({
        success: false,
        error: "Order not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: order,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch order",
    }, { status: 500 });
  }
}

// DELETE - Soft delete order (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        const { id } = await params;
        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Order ID is required",
          }, { status: 400 });
        }

        const order = await Order.findOne({ _id: id, isDeleted: false });

        if (!order) {
          return NextResponse.json({
            success: false,
            error: "Order not found or already deleted",
          }, { status: 404 });
        }

        // Reverse stock
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.qty },
            updatedBy: user.id,
          });
        }

        await Order.findByIdAndUpdate(id, {
          isDeleted: true,
          orderStatus: "cancelled",
          deletedBy: user.id,
          deletedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: "Order deleted and stock restored",
        }, { status: 200 });
      } catch (error) {
        console.error("Error deleting order:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete order",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}