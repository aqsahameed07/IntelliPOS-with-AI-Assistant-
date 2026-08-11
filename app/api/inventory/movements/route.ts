// app/api/inventory/movements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { Product } from "@/app/models/Product";
import { withAuth } from "@/lib/authMiddleware";

// GET - Fetch all inventory movements
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');
    const vendorId = searchParams.get('vendorId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    
    // Build query
    const query: Record<string, unknown> = {};
    
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    if (productId) {
      query.productId = productId;
    }
    
    if (vendorId) {
      query.vendorId = vendorId;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }
    
    const [movements, total] = await Promise.all([
      InventoryMovement.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryMovement.countDocuments(query),
    ]);
    
    return NextResponse.json({
      success: true,
      data: movements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching inventory movements:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch inventory movements",
    }, { status: 500 });
  }
}

// POST - Create a new inventory movement (Admin and Employee only)
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();
        
        const body = await request.json();
        
        // Validate required fields
        if (!body.productId) {
          return NextResponse.json({
            success: false,
            error: "Product ID is required",
          }, { status: 400 });
        }
        
        // For adjustments, qty can be negative (decrease) or positive (increase)
        // For purchases, qty must be positive
        if (body.qty === undefined || body.qty === null) {
          return NextResponse.json({
            success: false,
            error: "Quantity is required",
          }, { status: 400 });
        }

        // Only validate positive for purchases
        if (body.type === 'purchase' && body.qty <= 0) {
          return NextResponse.json({
            success: false,
            error: "Quantity must be greater than 0 for purchases",
          }, { status: 400 });
        }

        // For adjustment, allow negative values but not zero
        if (body.type === 'adjustment' && body.qty === 0) {
          return NextResponse.json({
            success: false,
            error: "Quantity cannot be zero",
          }, { status: 400 });
        }
        
        // For purchases, vendor is required
        if (body.type === 'purchase' && !body.vendorId) {
          return NextResponse.json({
            success: false,
            error: "Vendor is required for purchases",
          }, { status: 400 });
        }
        
        // Get the product
        const product = await Product.findOne({
          _id: body.productId,
          isDeleted: false,
        });
        
        if (!product) {
          return NextResponse.json({
            success: false,
            error: "Product not found",
          }, { status: 404 });
        }
        
        // Calculate new stock
        const previousStock = product.stock;
        let newStock = previousStock + body.qty;
        
        // Validate stock doesn't go negative
        if (newStock < 0) {
          return NextResponse.json({
            success: false,
            error: "Cannot reduce stock below zero",
          }, { status: 400 });
        }
        
        // Create the movement
        const movement = await InventoryMovement.create({
          productId: body.productId,
          productName: product.name,
          type: body.type,
          qty: body.qty,
          previousStock,
          newStock,
          vendorId: body.vendorId || undefined,
          cost: body.cost || undefined,
          sellingPrice: body.sellingPrice || undefined,
          reference: body.reference || undefined,
          note: body.note || undefined,
          userEmail: user.email,
          userId: user.id,
        });
        
        // Update product stock
        await Product.findByIdAndUpdate(body.productId, {
          stock: newStock,
          updatedBy: user.id,
        });
        
        return NextResponse.json({
          success: true,
          data: movement,
          message: "Inventory movement recorded successfully",
        }, { status: 201 });
        
      } catch (error) {
        console.error("Error creating inventory movement:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to create inventory movement",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}