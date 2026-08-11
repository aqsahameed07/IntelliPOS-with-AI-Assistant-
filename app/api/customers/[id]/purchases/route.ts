// app/api/customers/[id]/purchases/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/app/models/Customer";
import { withAuth } from "@/lib/authMiddleware";

// PATCH - Update total purchases
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        const { id } = await params;
        const { amount } = await request.json();

        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Customer ID is required",
          }, { status: 400 });
        }

        if (amount === undefined || amount < 0) {
          return NextResponse.json({
            success: false,
            error: "Valid amount is required",
          }, { status: 400 });
        }

        const customer = await Customer.findOne({ _id: id });

        if (!customer) {
          return NextResponse.json({
            success: false,
            error: "Customer not found",
          }, { status: 404 });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
          id,
          {
            $inc: { totalPurchases: amount },
          },
          { new: true }
        );

        return NextResponse.json({
          success: true,
          data: updatedCustomer,
          message: "Total purchases updated",
        }, { status: 200 });
      } catch (error) {
        console.error("Error updating total purchases:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update total purchases",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}