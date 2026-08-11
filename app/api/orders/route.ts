// app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Order } from "@/app/models/Order";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { withAuth } from "@/lib/authMiddleware";

// GET - Fetch orders
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const customerEmail = searchParams.get("customerEmail");
    const orderStatus = searchParams.get("orderStatus");
    const paymentStatus = searchParams.get("paymentStatus");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    query.isDeleted = false;

    if (customerEmail) {
      query.customerEmail = customerEmail;
    }

    if (orderStatus && orderStatus !== "all") {
      query.orderStatus = orderStatus;
    }

    if (paymentStatus && paymentStatus !== "all") {
      query.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate + "T23:59:59.999Z");
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch orders",
    }, { status: 500 });
  }
}

// POST - Create order
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();

        const body = await request.json();
        console.log("📦 Creating order:", JSON.stringify(body, null, 2));

        // Validate required fields
        if (!body.items || body.items.length === 0) {
          return NextResponse.json({
            success: false,
            error: "Order must have at least one item",
          }, { status: 400 });
        }

        // Validate stock
        for (const item of body.items) {
          const product = await Product.findOne({
            _id: item.productId,
            isDeleted: false,
          });

          if (!product) {
            return NextResponse.json({
              success: false,
              error: `Product "${item.name}" not found`,
            }, { status: 404 });
          }

          if (product.stock < item.qty) {
            return NextResponse.json({
              success: false,
              error: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
            }, { status: 400 });
          }
        }

        // Create order
        const order = await Order.create({
          customerEmail: body.customerEmail || user.email,
          customerName: body.customerName || user.name,
          customerPhone: body.customerPhone,
          customerAddress: body.customerAddress,
          items: body.items,
          subtotal: body.subtotal,
          tax: body.tax || 0,
          shipping: body.shipping || 0,
          discount: body.discount || 0,
          grandTotal: body.grandTotal,
          paymentMethod: body.paymentMethod || "card",
          paymentStatus: body.paymentStatus || "pending",
          orderStatus: "pending",
          shippingAddress: body.shippingAddress || {
            name: body.customerName || user.name,
            phone: body.customerPhone || "",
            address: body.customerAddress || "",
            city: "",
            zip: "",
          },
          notes: body.notes,
          createdBy: user.id,
          updatedBy: user.id,
        });

        console.log(`✅ Order created: ${order.number}`);

        // Update stock and create inventory movements
        for (const item of body.items) {
          const product = await Product.findOne({
            _id: item.productId,
            isDeleted: false,
          });

          if (product) {
            const previousStock = product.stock;
            const newStock = product.stock - item.qty;

            await Product.findByIdAndUpdate(item.productId, {
              stock: newStock,
              updatedBy: user.id,
            });

            await InventoryMovement.create({
              productId: item.productId,
              productName: product.name,
              type: "sale",
              qty: -item.qty,
              previousStock,
              newStock,
              reference: order.number,
              sellingPrice: item.price,
              userEmail: user.email,
              userId: user.id,
              note: `Order ${order.number}`,
            });
          }
        }

        return NextResponse.json({
          success: true,
          data: order,
          message: `Order ${order.number} created successfully`,
        }, { status: 201 });
      } catch (error) {
        console.error("❌ Error creating order:", error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to create order",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee", "Customer"]
  );
}