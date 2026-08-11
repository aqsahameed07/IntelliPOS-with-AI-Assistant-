// app/api/customers/email/[email]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/app/models/Customer";

// GET - Get customer by email
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    await connectDB();

    const { email } = await params;

    if (!email) {
      return NextResponse.json({
        success: false,
        error: "Email is required",
      }, { status: 400 });
    }

    const customer = await Customer.findOne({
      email: email.toLowerCase(),
    });

    if (!customer) {
      return NextResponse.json({
        success: false,
        error: "Customer not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: customer,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customer by email:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch customer",
    }, { status: 500 });
  }
}