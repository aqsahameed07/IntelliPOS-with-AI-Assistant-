// app/api/orders/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/app/models/Order";

// GET - Order statistics
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const orders = await Order.find({ isDeleted: false });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
    const pendingOrders = orders.filter((o) => o.orderStatus === "pending").length;
    const processingOrders = orders.filter((o) => o.orderStatus === "processing").length;
    const shippedOrders = orders.filter((o) => o.orderStatus === "shipped").length;
    const deliveredOrders = orders.filter((o) => o.orderStatus === "delivered").length;
    const cancelledOrders = orders.filter((o) => o.orderStatus === "cancelled").length;

    const paidOrders = orders.filter((o) => o.paymentStatus === "paid").length;
    const pendingPayment = orders.filter((o) => o.paymentStatus === "pending").length;

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        paidOrders,
        pendingPayment,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch order stats",
    }, { status: 500 });
  }
}