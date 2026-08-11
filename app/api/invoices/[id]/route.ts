// app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Invoice } from "@/app/models/Invoice";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { withAuth } from "@/lib/authMiddleware";

// GET - Fetch single invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id: paramId } = await params;
    const id = paramId || request.nextUrl.pathname.split("/").pop() || "";
    const includeDeleted = request.nextUrl.searchParams.get("includeDeleted") === "true";
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Invoice ID is required",
      }, { status: 400 });
    }
    
    const query: Record<string, unknown> = { _id: id };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    const invoice = await Invoice.findOne(query);
    
    if (!invoice) {
      return NextResponse.json({
        success: false,
        error: "Invoice not found",
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: invoice,
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch invoice",
    }, { status: 500 });
  }
}

// PUT - Update invoice (Admin only)
export async function PUT(
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
        const body = await request.json();
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Invoice ID is required",
          }, { status: 400 });
        }
        
        // Check if invoice exists
        const existingInvoice = await Invoice.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!existingInvoice) {
          return NextResponse.json({
            success: false,
            error: "Invoice not found",
          }, { status: 404 });
        }
        
        // Only allow updates to certain fields
        const updateData = {
          customerId: body.customerId,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          notes: body.notes,
          paymentMethod: body.paymentMethod,
          paymentStatus: body.paymentStatus,
          paymentReference: body.paymentReference,
          updatedBy: user.id,
        };
        
        const updatedInvoice = await Invoice.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        
        return NextResponse.json({
          success: true,
          data: updatedInvoice,
          message: "Invoice updated successfully",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error updating invoice:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update invoice",
        }, { status: 500 });
      }
    },
    ["Admin"] // Only Admin can update
  );
}

// DELETE - Soft delete invoice (Admin only)
export async function DELETE(
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
            error: "Invoice not found or already deleted",
          }, { status: 404 });
        }
        
        // Reverse stock changes
        for (const item of invoice.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.qty },
            updatedBy: user.id,
          });
        }
        
        // Soft delete invoice
        await Invoice.findByIdAndUpdate(id, {
          isDeleted: true,
          status: "cancelled",
          deletedBy: user.id,
          deletedAt: new Date(),
        });
        
        return NextResponse.json({
          success: true,
          message: "Invoice deleted and stock restored",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error deleting invoice:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete invoice",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}