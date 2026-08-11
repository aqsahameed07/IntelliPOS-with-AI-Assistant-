// app/api/invoices/[id]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Invoice } from "@/app/models/Invoice";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// PATCH - Cancel invoice and restore stock
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
            error: "Invoice ID is required",
          }, { status: 400 });
        }
        
        // Check if invoice exists
        const invoice = await Invoice.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!invoice) {
          return NextResponse.json({
            success: false,
            error: "Invoice not found",
          }, { status: 404 });
        }
        
        if (invoice.status === "cancelled") {
          return NextResponse.json({
            success: false,
            error: "Invoice is already cancelled",
          }, { status: 400 });
        }
        
        // Restore stock
        for (const item of invoice.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.qty },
            updatedBy: user.id,
          });
        }
        
        // Update invoice
        const updatedInvoice = await Invoice.findByIdAndUpdate(
          id,
          {
            status: "cancelled",
            updatedBy: user.id,
            notes: invoice.notes 
              ? `${invoice.notes}\nCancelled: ${reason || "No reason provided"}`
              : `Cancelled: ${reason || "No reason provided"}`,
          },
          { new: true }
        );
        
        // Create inventory movement for reversal
        for (const item of invoice.items) {
          const product = await Product.findOne({
            _id: item.productId,
            isDeleted: false,
          });
          
          if (product) {
            await InventoryMovement.create({
              productId: item.productId,
              productName: product.name,
              type: "return",
              qty: item.qty,
              previousStock: product.stock - item.qty,
              newStock: product.stock,
              reference: `CANCELLED-${invoice.number}`,
              note: `Invoice ${invoice.number} cancelled`,
              userEmail: user.email,
              userId: user.id,
            });
          }
        }
        
        await logActivity(user, "invoice", `Invoice ${invoice.number} cancelled`, {
          invoiceId: id,
          invoiceNumber: invoice.number,
          reason,
        });

        return NextResponse.json({
          success: true,
          data: updatedInvoice,
          message: "Invoice cancelled and stock restored",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error cancelling invoice:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to cancel invoice",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}