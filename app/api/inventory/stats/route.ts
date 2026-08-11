// app/api/inventory/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";

// GET - Get inventory statistics
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Get product stats
    const products = await Product.find({ isDeleted: false });
    
    const totalSKUs = products.length;
    const stockValue = products.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0);
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    
    // Get total movements count
    const totalMovements = await InventoryMovement.countDocuments({ isDeleted: false });
    
    return NextResponse.json({
      success: true,
      data: {
        totalSKUs,
        stockValue,
        lowStock,
        outOfStock,
        totalMovements,
      },
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching inventory stats:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch inventory stats",
    }, { status: 500 });
  }
}