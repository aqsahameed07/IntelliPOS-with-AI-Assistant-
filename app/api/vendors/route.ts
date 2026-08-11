// app/api/vendors/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Vendor from "@/app/models/Vendor";
import { withAuth } from "@/lib/authMiddleware";

// GET - Fetch all vendors
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};

    if (status && status !== "all") {
      query.status = status;
    }

    // Search by name, email, or contact name
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { contactName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: vendors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch vendors",
    }, { status: 500 });
  }
}

// POST - Create vendor
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        const body = await request.json();

        // Validate required fields
        if (!body.name) {
          return NextResponse.json({
            success: false,
            error: "Vendor name is required",
          }, { status: 400 });
        }

        if (!body.email) {
          return NextResponse.json({
            success: false,
            error: "Email is required",
          }, { status: 400 });
        }

        if (!body.phone) {
          return NextResponse.json({
            success: false,
            error: "Phone is required",
          }, { status: 400 });
        }

        // Check if vendor already exists
        const existingVendor = await Vendor.findOne({
          email: body.email.toLowerCase(),
        });

        if (existingVendor) {
          return NextResponse.json({
            success: false,
            error: "Vendor with this email already exists",
          }, { status: 409 });
        }

        const vendor = await Vendor.create({
          name: body.name.trim(),
          contactName: body.contactName?.trim() || "",
          email: body.email.toLowerCase().trim(),
          phone: body.phone.trim(),
          address: body.address || "",
          gstin: body.gstin || "",
          notes: body.notes || "",
          status: body.status || "active",
          createdBy: user.id,
        });

        return NextResponse.json({
          success: true,
          data: vendor,
          message: "Vendor created successfully",
        }, { status: 201 });
      } catch (error) {
        console.error("Error creating vendor:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to create vendor",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}