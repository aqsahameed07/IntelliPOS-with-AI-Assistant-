// app/api/refunds/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Refund } from "@/app/models/Refund";
import { withAuth } from "@/lib/authMiddleware";

// GET - Fetch single refund
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
        error: "Refund ID is required",
      }, { status: 400 });
    }
    
    const query: Record<string, unknown> = { _id: id };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    const refund = await Refund.findOne(query);
    
    if (!refund) {
      return NextResponse.json({
        success: false,
        error: "Refund not found",
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: refund,
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching refund:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch refund",
    }, { status: 500 });
  }
}

// PUT - Update refund (Admin only)
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
            error: "Refund ID is required",
          }, { status: 400 });
        }
        
        const existingRefund = await Refund.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!existingRefund) {
          return NextResponse.json({
            success: false,
            error: "Refund not found",
          }, { status: 404 });
        }
        
        // Only allow certain fields to be updated
        const updateData = {
          status: body.status,
          notes: body.notes,
          refundMethod: body.refundMethod,
          settlementMethod: body.settlementMethod,
          updatedBy: user.id,
        };
        
        const updatedRefund = await Refund.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        
        return NextResponse.json({
          success: true,
          data: updatedRefund,
          message: "Refund updated successfully",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error updating refund:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update refund",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}

// DELETE - Soft delete refund (Admin only)
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
            error: "Refund not found or already deleted",
          }, { status: 404 });
        }
        
        await Refund.findByIdAndUpdate(id, {
          isDeleted: true,
          deletedBy: user.id,
          deletedAt: new Date(),
        });
        
        return NextResponse.json({
          success: true,
          message: "Refund deleted successfully",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error deleting refund:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete refund",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}