// app/api/customers/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/app/models/Customer";

// GET - Customer statistics
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const [total, active, inactive] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ status: "active" }),
      Customer.countDocuments({ status: "inactive" }),
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
    console.error("Error fetching customer stats:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch customer stats",
    }, { status: 500 });
  }
}