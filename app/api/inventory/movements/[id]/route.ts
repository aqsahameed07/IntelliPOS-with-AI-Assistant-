// app/api/inventory/movements/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { Product } from "@/app/models/Product";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// GET - Fetch single movement
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
        error: "Movement ID is required",
      }, { status: 400 });
    }
    
    const query: Record<string, unknown> = { _id: id };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    const movement = await InventoryMovement.findOne(query);
    
    if (!movement) {
      return NextResponse.json({
        success: false,
        error: "Inventory movement not found",
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: movement,
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching movement:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch movement",
    }, { status: 500 });
  }
}

// DELETE - Soft delete a movement (Admin only)
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
            error: "Movement ID is required",
          }, { status: 400 });
        }
        
        // Check if movement exists
        const movement = await InventoryMovement.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!movement) {
          return NextResponse.json({
            success: false,
            error: "Movement not found or already deleted",
          }, { status: 404 });
        }
        
        // Reverse the stock change
        if (movement.type === 'purchase' || movement.type === 'return') {
          // Reduce stock by the quantity
          await Product.findByIdAndUpdate(movement.productId, {
            $inc: { stock: -movement.qty },
            updatedBy: user.id,
          });
        } else if (movement.type === 'sale' || movement.type === 'adjustment') {
          // Increase stock by the quantity (reversing the decrease)
          await Product.findByIdAndUpdate(movement.productId, {
            $inc: { stock: -movement.qty },
            updatedBy: user.id,
          });
        }
        
        // Soft delete the movement
        await InventoryMovement.findByIdAndUpdate(id, {
          isDeleted: true,
        });

        await logActivity(user, "inventory", `Inventory movement deleted: ${movement.productName}`, {
          movementId: id,
          productId: movement.productId,
          productName: movement.productName,
          type: movement.type,
        });
        
        return NextResponse.json({
          success: true,
          message: "Inventory movement deleted and stock reversed",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error deleting movement:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete movement",
        }, { status: 500 });
      }
    },
    ["Admin"] // Only Admin can delete movements
  );
}