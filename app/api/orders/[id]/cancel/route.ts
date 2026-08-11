// app/api/orders/[id]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/app/models/Order";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// PATCH - Cancel order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        // ✅ FIX: Await params (Next.js 15)
        const { id } = await params;
        const { reason } = await request.json();

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

        if (order.orderStatus === "cancelled") {
          return NextResponse.json({
            success: false,
            error: "Order is already cancelled",
          }, { status: 400 });
        }

        // Restore stock
        for (const item of order.items) {
          const product = await Product.findOne({
            _id: item.productId,
            isDeleted: false,
          });

          if (product) {
            const previousStock = product.stock;
            const newStock = product.stock + item.qty;

            await Product.findByIdAndUpdate(item.productId, {
              stock: newStock,
              updatedBy: user.id,
            });

            await InventoryMovement.create({
              productId: item.productId,
              productName: product.name,
              type: "return",
              qty: item.qty,
              previousStock,
              newStock,
              reference: `CANCELLED-${order.number}`,
              note: `Order ${order.number} cancelled`,
              userEmail: user.email,
              userId: user.id,
            });
          }
        }

        await Order.findByIdAndUpdate(id, {
          orderStatus: "cancelled",
          updatedBy: user.id,
          notes: order.notes
            ? `${order.notes}\nCancelled: ${reason || "No reason provided"}`
            : `Cancelled: ${reason || "No reason provided"}`,
        });

        await logActivity(user, "order", `Order ${order.number} cancelled`, {
          orderId: id,
          orderNumber: order.number,
          reason,
        });

        return NextResponse.json({
          success: true,
          message: "Order cancelled and stock restored",
        }, { status: 200 });
      } catch (error) {
        console.error("Error cancelling order:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to cancel order",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee", "Customer"]
  );
}