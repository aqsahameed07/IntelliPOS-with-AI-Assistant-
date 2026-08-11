// app/api/refunds/[id]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Refund } from "@/app/models/Refund";
import { Invoice } from "@/app/models/Invoice";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// PATCH - Cancel refund and reverse stock changes
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
        const { reason } = await request.json();
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Refund ID is required",
          }, { status: 400 });
        }
        
        const refund = await Refund.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!refund) {
          return NextResponse.json({
            success: false,
            error: "Refund not found",
          }, { status: 404 });
        }
        
        if (refund.status === "cancelled") {
          return NextResponse.json({
            success: false,
            error: "Refund is already cancelled",
          }, { status: 400 });
        }
        
        // Reverse stock changes
        for (const item of refund.returnedItems) {
          if (item.restock && item.qty > 0) {
            // Remove the restocked items
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: -item.qty },
              updatedBy: user.id,
            });
          }
        }
        
        for (const item of refund.exchangedItems) {
          if (item.qty > 0) {
            // Add back the exchanged items
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: item.qty },
              updatedBy: user.id,
            });
          }
        }
        
        // Update refund status
        await Refund.findByIdAndUpdate(id, {
          status: "cancelled",
          updatedBy: user.id,
          notes: refund.notes 
            ? `${refund.notes}\nCancelled: ${reason || "No reason provided"}`
            : `Cancelled: ${reason || "No reason provided"}`,
        });
        
        // Update invoice status back
        const invoice = await Invoice.findOne({
          _id: refund.invoiceId,
          isDeleted: false,
        });
        
        if (invoice) {
          // Check if there are other refunds
          const otherRefunds = await Refund.find({
            invoiceId: refund.invoiceId,
            isDeleted: false,
            status: "processed",
            _id: { $ne: id },
          });
          
          if (otherRefunds.length === 0) {
            await Invoice.findByIdAndUpdate(refund.invoiceId, {
              paymentStatus: "paid",
              updatedBy: user.id,
            });
          }
        }
        
        await logActivity(user, "refund", `Refund ${refund.number} cancelled`, {
          refundId: id,
          refundNumber: refund.number,
          reason,
        });

        return NextResponse.json({
          success: true,
          message: "Refund cancelled and stock restored",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error cancelling refund:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to cancel refund",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}