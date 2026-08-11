// app/api/employees/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employee from "@/app/models/Employee";

// GET - Employee statistics
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const [total, active, inactive] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: "active" }),
      Employee.countDocuments({ status: "inactive" }),
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
    console.error("Error fetching employee stats:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch employee stats",
    }, { status: 500 });
  }
}