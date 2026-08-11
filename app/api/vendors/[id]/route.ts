// app/api/vendors/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { saveBase64Image, isBase64Image } from "@/lib/server-image-utils";
import Vendor from "@/app/models/Vendor";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// GET - Get single vendor
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
        error: "Vendor ID is required",
      }, { status: 400 });
    }

    const vendor = await Vendor.findOne({ _id: id });

    if (!vendor) {
      return NextResponse.json({
        success: false,
        error: "Vendor not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: vendor,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch vendor",
    }, { status: 500 });
  }
}

// PUT - Update vendor
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
            error: "Vendor ID is required",
          }, { status: 400 });
        }

        const existingVendor = await Vendor.findOne({ _id: id });

        if (!existingVendor) {
          return NextResponse.json({
            success: false,
            error: "Vendor not found",
          }, { status: 404 });
        }

        // Check email uniqueness
        if (body.email && body.email !== existingVendor.email) {
          const duplicate = await Vendor.findOne({
            email: body.email.toLowerCase(),
            _id: { $ne: id },
          });

          if (duplicate) {
            return NextResponse.json({
              success: false,
              error: "Vendor with this email already exists",
            }, { status: 409 });
          }
        }

        const updatedVendor = await Vendor.findByIdAndUpdate(
          id,
          {
            name: body.name?.trim(),
            contactName: body.contactName?.trim() || "",
            email: body.email?.toLowerCase().trim(),
            phone: body.phone?.trim(),
            address: body.address || "",
            gstin: body.gstin || "",
            notes: body.notes || "",
            image: isBase64Image(body.image)
              ? await saveBase64Image(body.image, "vendor", "vendors")
              : body.image?.trim() || undefined,
            status: body.status,
          },
          { new: true, runValidators: true }
        );

        await logActivity(user, "vendor", `Vendor "${updatedVendor!.name}" updated`, {
          vendorId: id,
          name: updatedVendor!.name,
        });

        return NextResponse.json({
          success: true,
          data: updatedVendor,
          message: "Vendor updated successfully",
        }, { status: 200 });
      } catch (error) {
        console.error("Error updating vendor:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update vendor",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}

// DELETE - Delete vendor
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
            error: "Vendor ID is required",
          }, { status: 400 });
        }

        const vendor = await Vendor.findOne({ _id: id });

        if (!vendor) {
          return NextResponse.json({
            success: false,
            error: "Vendor not found",
          }, { status: 404 });
        }

        await Vendor.findByIdAndDelete(id);

        await logActivity(user, "vendor", `Vendor "${vendor.name}" deleted`, {
          vendorId: id,
          name: vendor.name,
        });

        return NextResponse.json({
          success: true,
          message: "Vendor deleted successfully",
        }, { status: 200 });
      } catch (error) {
        console.error("Error deleting vendor:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete vendor",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}