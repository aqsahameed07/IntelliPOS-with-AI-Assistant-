// app/api/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/app/models/Order";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// PATCH - Update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        const { id } = await params;
        const { orderStatus } = await request.json();

        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Order ID is required",
          }, { status: 400 });
        }

        if (!orderStatus) {
          return NextResponse.json({
            success: false,
            error: "Order status is required",
          }, { status: 400 });
        }

        const order = await Order.findOne({ _id: id, isDeleted: false });

        if (!order) {
          return NextResponse.json({
            success: false,
            error: "Order not found",
          }, { status: 404 });
        }

        // Prepare update data
        const updateData: any = {
          orderStatus,
          updatedBy: user.id,
        };

        // ✅ Auto-update payment status for cash on delivery when delivered
        if (orderStatus === "delivered" && order.paymentMethod === "cash") {
          updateData.paymentStatus = "paid";
        }

        // ✅ Also update payment status for other delivery statuses if needed
        if (orderStatus === "cancelled" && order.paymentStatus === "pending") {
          updateData.paymentStatus = "failed";
        }

        await Order.findByIdAndUpdate(id, updateData);

        await logActivity(user, "order", `Order ${order.number} status changed to ${orderStatus}`, {
          orderId: id,
          orderNumber: order.number,
          orderStatus,
        });

        return NextResponse.json({
          success: true,
          message: `Order status updated to ${orderStatus}${
            updateData.paymentStatus ? ` and payment status updated to ${updateData.paymentStatus}` : ""
          }`,
          data: updateData,
        }, { status: 200 });
      } catch (error) {
        console.error("Error updating order status:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update order status",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}