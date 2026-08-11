// app/api/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employee from "@/app/models/Employee";
import User from "@/app/models/User";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";
import bcrypt from "bcryptjs";

// GET - Fetch all employees
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (role && role !== "all") {
      query.role = role;
    }

    // Search by name, email, or department
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Employee.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch employees",
    }, { status: 500 });
  }
}

// POST - Create employee (also creates a user account)
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

        if (!body.role) {
          return NextResponse.json({
            success: false,
            error: "Role is required",
          }, { status: 400 });
        }

        if (!body.department) {
          return NextResponse.json({
            success: false,
            error: "Department is required",
          }, { status: 400 });
        }

        // Check if password is provided (only for new employees)
        if (!body.password) {
          return NextResponse.json({
            success: false,
            error: "Password is required for new employee",
          }, { status: 400 });
        }

        if (body.password.length < 6) {
          return NextResponse.json({
            success: false,
            error: "Password must be at least 6 characters",
          }, { status: 400 });
        }

        // Check if employee already exists
        const existingEmployee = await Employee.findOne({
          email: body.email.toLowerCase(),
        });

        if (existingEmployee) {
          return NextResponse.json({
            success: false,
            error: "Employee with this email already exists",
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

        // Hash password
        const hashedPassword = await bcrypt.hash(body.password, 10);

        // 1. Create User with appropriate role
        const newUser = await User.create({
          name: body.name.trim(),
          email: body.email.toLowerCase().trim(),
          password: hashedPassword,
          phone: body.phone.trim(),
          address: body.address || "",
          role: "employee", // Employees always get the "employee" role
          status: "active",
          createdBy: user.id,
        });

        

        // 2. Create Employee linked to the user
        const employee = await Employee.create({
          name: body.name.trim(),
          email: body.email.toLowerCase().trim(),
          phone: body.phone.trim(),
          role: body.role,
          department: body.department,
          salary: Number(body.salary) || 0,
          status: body.status || "active",
          userId: newUser._id,
          createdBy: user.id,
        });

        

        await logActivity(user, "employee", `Employee "${employee.name}" created`, {
          employeeId: employee._id,
          name: employee.name,
          email: employee.email,
        });

        return NextResponse.json({
          success: true,
          data: employee,
          message: `Employee created successfully. Login credentials: Email: ${body.email}, Password: ${body.password}`,
          user: {
            id: newUser._id,
            email: newUser.email,
          },
        }, { status: 201 });
      } catch (error: any) {
        console.error("❌ Error creating employee:", error);
        console.error("Error details:", error.errors);
        
        // Check for validation errors
        if (error.name === 'ValidationError') {
          const errors = Object.values(error.errors).map((err: any) => err.message);
          return NextResponse.json({
            success: false,
            error: errors.join(', '),
          }, { status: 400 });
        }

        return NextResponse.json({
          success: false,
          error: error.message || "Failed to create employee",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}