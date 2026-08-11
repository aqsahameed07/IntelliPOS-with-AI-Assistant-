// app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/app/models/Customer";
import User from "@/app/models/User";
import { withAuth } from "@/lib/authMiddleware";
import bcrypt from "bcryptjs";

// GET - Get single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Customer ID is required",
      }, { status: 400 });
    }

    const customer = await Customer.findOne({ _id: id });

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
    console.error("Error fetching customer:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch customer",
    }, { status: 500 });
  }
}

// PUT - Update customer (also updates the linked user)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        const { id } = await params;
        const body = await request.json();

        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Customer ID is required",
          }, { status: 400 });
        }

        // Find the customer
        const existingCustomer = await Customer.findOne({ _id: id });

        if (!existingCustomer) {
          return NextResponse.json({
            success: false,
            error: "Customer not found",
          }, { status: 404 });
        }

        // Check email uniqueness (if email is being changed)
        if (body.email && body.email !== existingCustomer.email) {
          const duplicate = await Customer.findOne({
            email: body.email.toLowerCase(),
            _id: { $ne: id },
          });

          if (duplicate) {
            return NextResponse.json({
              success: false,
              error: "Customer with this email already exists",
            }, { status: 409 });
          }

          // Also check if email exists in User collection
          const duplicateUser = await User.findOne({
            email: body.email.toLowerCase(),
            _id: { $ne: existingCustomer.userId },
          });

          if (duplicateUser) {
            return NextResponse.json({
              success: false,
              error: "A user with this email already exists",
            }, { status: 409 });
          }
        }

        // Update the Customer record
        const updatedCustomer = await Customer.findByIdAndUpdate(
          id,
          {
            name: body.name?.trim(),
            email: body.email?.toLowerCase().trim(),
            phone: body.phone?.trim(),
            address: body.address,
            status: body.status,
          },
          { new: true, runValidators: true }
        );

        // ✅ Update the linked User record
        if (existingCustomer.userId) {
          const updateData: any = {
            name: body.name?.trim(),
            email: body.email?.toLowerCase().trim(),
            phone: body.phone?.trim(),
            address: body.address,
            status: body.status,
          };

          // If password is provided, update it
          if (body.password) {
            updateData.password = await bcrypt.hash(body.password, 10);
          }

          await User.findByIdAndUpdate(
            existingCustomer.userId,
            updateData,
            { new: true, runValidators: true }
          );
        }

        return NextResponse.json({
          success: true,
          data: updatedCustomer,
          message: "Customer and user updated successfully",
        }, { status: 200 });
      } catch (error) {
        console.error("Error updating customer:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update customer",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}

// DELETE - Delete customer (also deletes the linked user or marks inactive)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        const { id } = await params;

        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Customer ID is required",
          }, { status: 400 });
        }

        const customer = await Customer.findOne({ _id: id });

        if (!customer) {
          return NextResponse.json({
            success: false,
            error: "Customer not found",
          }, { status: 404 });
        }

        // Delete the customer
        await Customer.findByIdAndDelete(id);

        // ✅ Also delete or deactivate the linked user
        if (customer.userId) {
          // Option 1: Hard delete the user
          await User.findByIdAndDelete(customer.userId);
          
          // Option 2: Or soft delete by setting status to inactive
          // await User.findByIdAndUpdate(customer.userId, { status: "inactive" });
        }

        return NextResponse.json({
          success: true,
          message: "Customer and user deleted successfully",
        }, { status: 200 });
      } catch (error) {
        console.error("Error deleting customer:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete customer",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}