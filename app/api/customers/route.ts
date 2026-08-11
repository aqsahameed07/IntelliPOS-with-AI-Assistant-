// app/api/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Customer from "@/app/models/Customer";
import User from "@/app/models/User";
import { withAuth } from "@/lib/authMiddleware";
import bcrypt from "bcryptjs";

// GET - Fetch all customers
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

    // Search by name, email, or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch customers",
    }, { status: 500 });
  }
}

// POST - Create customer (also creates a user account)
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
            error: "Name is required",
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

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({
          email: body.email.toLowerCase(),
        });

        if (existingCustomer) {
          return NextResponse.json({
            success: false,
            error: "Customer with this email already exists",
          }, { status: 409 });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
          email: body.email.toLowerCase(),
        });

        if (existingUser) {
          return NextResponse.json({
            success: false,
            error: "A user with this email already exists",
          }, { status: 409 });
        }

        // Generate random password if not provided
        const password = body.password || Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);

        // 1. Create User with role "customer"
        const newUser = await User.create({
          name: body.name.trim(),
          email: body.email.toLowerCase().trim(),
          password: hashedPassword,
          phone: body.phone.trim(),
          address: body.address || "",
          role: "customer",
          status: "active",
          createdBy: user.id,
        });

        // 2. Create Customer linked to the user
        const customer = await Customer.create({
          name: body.name.trim(),
          email: body.email.toLowerCase().trim(),
          phone: body.phone.trim(),
          address: body.address || "",
          status: body.status || "active",
          totalPurchases: 0,
          userId: newUser._id,
          createdBy: user.id,
        });

        return NextResponse.json({
          success: true,
          data: customer,
          message: `Customer created successfully. Login credentials: Email: ${body.email}, Password: ${password}`,
          user: {
            id: newUser._id,
            email: newUser.email,
            password: password, // Only sent on creation
          },
        }, { status: 201 });
      } catch (error) {
        console.error("Error creating customer:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to create customer",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}