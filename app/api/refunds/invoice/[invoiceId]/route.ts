// app/api/refunds/invoice/[invoiceId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Refund } from "@/app/models/Refund";

// GET - Fetch all refunds for a specific invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await connectDB();
    
    const { invoiceId: paramInvoiceId } = await params;
    const invoiceId = paramInvoiceId || request.nextUrl.pathname.split("/").pop() || "";
    const includeDeleted = request.nextUrl.searchParams.get("includeDeleted") === "true";
    
    if (!invoiceId) {
      return NextResponse.json({
        success: false,
        error: "Invoice ID is required",
      }, { status: 400 });
    }
    
    const query: Record<string, unknown> = { invoiceId };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    const refunds = await Refund.find(query)
      .sort({ createdAt: -1 })
      .lean();
    
    return NextResponse.json({
      success: true,
      data: refunds,
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching refunds by invoice:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch refunds",
    }, { status: 500 });
  }
}