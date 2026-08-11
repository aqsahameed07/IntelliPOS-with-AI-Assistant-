// app/api/employees/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Employee from "@/app/models/Employee";
import User from "@/app/models/User";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";
import bcrypt from "bcryptjs";

// GET - Get single employee
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
        error: "Employee ID is required",
      }, { status: 400 });
    }

    const employee = await Employee.findOne({ _id: id });

    if (!employee) {
      return NextResponse.json({
        success: false,
        error: "Employee not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: employee,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch employee",
    }, { status: 500 });
  }
}

// PUT - Update employee (also updates the linked user)
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
            error: "Employee ID is required",
          }, { status: 400 });
        }

        // Find the existing employee
        const existingEmployee = await Employee.findOne({ _id: id });
        

        if (!existingEmployee) {
          return NextResponse.json({
            success: false,
            error: "Employee not found",
          }, { status: 404 });
        }

        // Check email uniqueness (if email is being changed)
        if (body.email && body.email !== existingEmployee.email) {
          const duplicate = await Employee.findOne({
            email: body.email.toLowerCase(),
            _id: { $ne: id },
          });

          if (duplicate) {
            return NextResponse.json({
              success: false,
              error: "Employee with this email already exists",
            }, { status: 409 });
          }

          // Also check if email exists in User collection
          if (existingEmployee.userId) {
            const duplicateUser = await User.findOne({
              email: body.email.toLowerCase(),
              _id: { $ne: existingEmployee.userId },
            });

            if (duplicateUser) {
              return NextResponse.json({
                success: false,
                error: "A user with this email already exists",
              }, { status: 409 });
            }
          }
        }

        // Prepare update data for Employee
        const employeeUpdateData: any = {};

        if (body.name) employeeUpdateData.name = body.name.trim();
        if (body.email) employeeUpdateData.email = body.email.toLowerCase().trim();
        if (body.phone) employeeUpdateData.phone = body.phone.trim();
        if (body.role) employeeUpdateData.role = body.role;
        if (body.department) employeeUpdateData.department = body.department;
        if (body.salary !== undefined) employeeUpdateData.salary = Number(body.salary);
        if (body.status) employeeUpdateData.status = body.status;

        // Update Employee record
        const updatedEmployee = await Employee.findByIdAndUpdate(
          id,
          employeeUpdateData,
          { new: true, runValidators: true }
        );
        

        // Update the linked User record
        if (existingEmployee.userId) {
          const userUpdateData: any = {};

          if (body.name) userUpdateData.name = body.name.trim();
          if (body.email) userUpdateData.email = body.email.toLowerCase().trim();
          if (body.phone) userUpdateData.phone = body.phone.trim();
          if (body.status) userUpdateData.status = body.status;
          
          // Map employee role to user role
          if (body.role) {
            // Map employee role to user role (all employees get "employee" role)
            userUpdateData.role = "employee";
          }

          // If password is provided, update it
          if (body.password && body.password.trim()) {
            if (body.password.length < 6) {
              return NextResponse.json({
                success: false,
                error: "Password must be at least 6 characters",
              }, { status: 400 });
            }
            userUpdateData.password = await bcrypt.hash(body.password, 10);
           
          }

         
          const updatedUser = await User.findByIdAndUpdate(
            existingEmployee.userId,
            userUpdateData,
            { new: true, runValidators: true }
          );
        
        }

        await logActivity(user, "employee", `Employee "${updatedEmployee!.name}" updated`, {
          employeeId: id,
          name: updatedEmployee!.name,
        });

        return NextResponse.json({
          success: true,
          data: updatedEmployee,
          message: "Employee and user updated successfully",
        }, { status: 200 });
      } catch (error: any) {
        console.error("❌ Error updating employee:", error);
        console.error("Error details:", error.errors);
        
        if (error.name === 'ValidationError') {
          const errors = Object.values(error.errors).map((err: any) => err.message);
          return NextResponse.json({
            success: false,
            error: errors.join(', '),
          }, { status: 400 });
        }

        return NextResponse.json({
          success: false,
          error: error.message || "Failed to update employee",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}

// DELETE - Delete employee (also deletes the linked user)
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
            error: "Employee ID is required",
          }, { status: 400 });
        }

        const employee = await Employee.findOne({ _id: id });

        if (!employee) {
          return NextResponse.json({
            success: false,
            error: "Employee not found",
          }, { status: 404 });
        }

        // Delete the employee
        await Employee.findByIdAndDelete(id);
        

        // Delete the linked user
        if (employee.userId) {
          await User.findByIdAndDelete(employee.userId);
         
        }

        await logActivity(user, "employee", `Employee "${employee.name}" deleted`, {
          employeeId: id,
          name: employee.name,
        });

        return NextResponse.json({
          success: true,
          message: "Employee and user deleted successfully",
        }, { status: 200 });
      } catch (error) {
        console.error("Error deleting employee:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete employee",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}