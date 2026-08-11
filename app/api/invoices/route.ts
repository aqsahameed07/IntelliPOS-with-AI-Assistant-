// app/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Invoice } from "@/app/models/Invoice";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// Helper function to generate invoice number
async function generateInvoiceNumber() {
  try {
    const count = await Invoice.countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const seq = String(count + 1).padStart(4, '0');
    return `INV-${year}${month}${day}-${seq}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    return `INV-${Date.now()}`;
  }
}

// GET - Fetch all invoices
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    
    // Build query
    const query: Record<string, unknown> = {};
    
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    if (customerId) {
      query.customerId = customerId;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus;
    }
    
    // Date range filter
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) {
        createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
      query.createdAt = createdAt;
    }
    
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(query),
    ]);
    
    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch invoices",
    }, { status: 500 });
  }
}

// POST - Create a new invoice
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();
        
        const body = await request.json();
        console.log("📝 Received invoice data:", JSON.stringify(body, null, 2));
        
        // Validate required fields
        if (!body.items || body.items.length === 0) {
          console.log("❌ No items in invoice");
          return NextResponse.json({
            success: false,
            error: "Invoice must have at least one item",
          }, { status: 400 });
        }
        
        // Validate each item and check stock
        const validatedItems = [];
        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i];
          
          
          // Check if product exists
          const product = await Product.findOne({
            _id: item.productId,
            isDeleted: false,
          });
          
          if (!product) {
          
            return NextResponse.json({
              success: false,
              error: `Product "${item.name || item.productId}" not found`,
            }, { status: 404 });
          }
        
         
          
          // Check stock
          if (product.stock < item.qty) {
            console.log(`❌ Insufficient stock for ${product.name}`);
            return NextResponse.json({
              success: false,
              error: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.qty}`,
            }, { status: 400 });
          }
          
          validatedItems.push({
            productId: item.productId,
            name: product.name,
            qty: item.qty,
            price: item.price || product.sellingPrice,
            discount: item.discount || 0,
            tax: item.tax || 0,
            lineTotal: item.lineTotal || (item.price || product.sellingPrice) * item.qty,
          });
        }
        
        // Calculate totals if not provided
        const subtotal = body.subtotal || validatedItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const discount = body.discount || 0;
        const tax = body.tax || 0;
        const grandTotal = body.grandTotal || (subtotal - discount + tax);
        
        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber();
        console.log(`📄 Generated invoice number: ${invoiceNumber}`);
        
        // Create invoice data with explicit number
        const invoiceData = {
          number: invoiceNumber, // Explicitly set the number
          customerName: body.customerName || "Walk-in customer",
          customerEmail: body.customerEmail || undefined,
          customerPhone: body.customerPhone || undefined,
          customerId: body.customerId || undefined,
          employeeId: user.id,
          employeeEmail: user.email,
          employeeName: user.name || "Staff",
          items: validatedItems,
          subtotal: Math.round(subtotal * 100) / 100,
          discount: Math.round(discount * 100) / 100,
          tax: Math.round(tax * 100) / 100,
          grandTotal: Math.round(grandTotal * 100) / 100,
          paymentMethod: body.paymentMethod || "cash",
          paymentStatus: body.paymentMethod === "pending" ? "pending" : "paid",
          notes: body.notes || "",
          status: "confirmed",
          createdBy: user.id,
          updatedBy: user.id,
        };
        
        console.log("📄 Creating invoice with data:", JSON.stringify(invoiceData, null, 2));
        
        // Create invoice
        let invoice;
        try {
          invoice = await Invoice.create(invoiceData);
          console.log(`✅ Invoice created: ${invoice.number}`);
        } catch (createError: any) {
          console.error("❌ Error creating invoice:", createError);
          console.error("Error details:", createError.errors);
          return NextResponse.json({
            success: false,
            error: createError.message || "Failed to create invoice document",
          }, { status: 500 });
        }
        
        // Update stock and create inventory movements
        for (const item of validatedItems) {
          try {
            const product = await Product.findOne({
              _id: item.productId,
              isDeleted: false,
            });
            
            if (product) {
              const previousStock = product.stock;
              const newStock = product.stock - item.qty;
              
              console.log(`📦 Updating stock for ${product.name}: ${previousStock} → ${newStock}`);
              
              // Update product stock
              await Product.findByIdAndUpdate(item.productId, {
                stock: newStock,
                updatedBy: user.id,
              });
              
              // Create inventory movement
              await InventoryMovement.create({
                productId: item.productId,
                productName: product.name,
                type: "sale",
                qty: -item.qty,
                previousStock,
                newStock,
                reference: invoice.number,
                sellingPrice: item.price,
                userEmail: user.email,
                userId: user.id,
                note: `Invoice ${invoice.number}`,
              });
              
              console.log(`✅ Stock updated for ${product.name}`);
            }
          } catch (stockError) {
            console.error(`❌ Error updating stock for item ${item.productId}:`, stockError);
            // Continue with other items even if one fails
          }
        }
        
        return NextResponse.json({
          success: true,
          data: invoice,
          message: `Invoice ${invoice.number} created successfully`,
        }, { status: 201 });
        
      } catch (error: any) {
        console.error("❌ Error creating invoice:", error);
        console.error("Error stack:", error.stack);
        
        // Check for validation errors
        if (error.name === 'ValidationError') {
          const errors = Object.values(error.errors).map((err: any) => err.message);
          console.log("Validation errors:", errors);
          return NextResponse.json({
            success: false,
            error: errors.join(', '),
          }, { status: 400 });
        }
        
        return NextResponse.json({
          success: false,
          error: error.message || "Failed to create invoice",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}