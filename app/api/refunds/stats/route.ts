// app/api/refunds/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Refund } from "@/app/models/Refund";

// GET - Refund statistics
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const refunds = await Refund.find({ isDeleted: false, status: "processed" });
    
    const totalRefunds = refunds.length;
    const totalRefunded = refunds.reduce((sum, r) => sum + Math.max(0, r.netRefund), 0);
    const totalExchanged = refunds.reduce((sum, r) => sum + r.exchangeSubtotal, 0);
    const totalReturns = refunds.reduce((sum, r) => sum + r.returnedItems.reduce((s: number, i: { qty: number }) => s + i.qty, 0), 0);
    
    // Count by type
    const byType = {
      full: refunds.filter(r => r.type === "full").length,
      partial: refunds.filter(r => r.type === "partial").length,
      exchange: refunds.filter(r => r.type === "exchange").length,
    };
    
    return NextResponse.json({
      success: true,
      data: {
        totalRefunds,
        totalRefunded,
        totalExchanged,
        totalReturns,
        byType,
      },
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching refund stats:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch refund stats",
    }, { status: 500 });
  }
}