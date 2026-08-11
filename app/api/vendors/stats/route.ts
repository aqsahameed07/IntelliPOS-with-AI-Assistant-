// app/api/vendors/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vendor from "@/app/models/Vendor";

// GET - Vendor statistics
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const [total, active, inactive] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.countDocuments({ status: "active" }),
      Vendor.countDocuments({ status: "inactive" }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        active,
        inactive,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching vendor stats:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch vendor stats",
    }, { status: 500 });
  }
}
