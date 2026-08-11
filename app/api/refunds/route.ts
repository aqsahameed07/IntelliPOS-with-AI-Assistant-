// app/api/refunds/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Refund } from "@/app/models/Refund";
import { Invoice } from "@/app/models/Invoice";
import { Product } from "@/app/models/Product";
import { InventoryMovement } from "@/app/models/InventoryMovement";
import { withAuth } from "@/lib/authMiddleware";

// GET - Fetch all refunds
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('invoiceId');
    const customerId = searchParams.get('customerId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
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
    
    if (invoiceId) {
      query.invoiceId = invoiceId;
    }
    
    if (customerId) {
      query.customerId = customerId;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }
    
    const [refunds, total] = await Promise.all([
      Refund.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Refund.countDocuments(query),
    ]);
    
    return NextResponse.json({
      success: true,
      data: refunds,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching refunds:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch refunds",
    }, { status: 500 });
  }
}

// POST - Create a new refund
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();
        
        const body = await request.json();
        console.log("📝 Received refund data:", JSON.stringify(body, null, 2));
        
        // Validate required fields
        if (!body.invoiceId) {
          return NextResponse.json({
            success: false,
            error: "Invoice ID is required",
          }, { status: 400 });
        }
        
        if (!body.returnedItems || body.returnedItems.length === 0) {
          return NextResponse.json({
            success: false,
            error: "At least one item must be returned",
          }, { status: 400 });
        }
        
        if (!body.reason) {
          return NextResponse.json({
            success: false,
            error: "Reason for refund is required",
          }, { status: 400 });
        }
        
        // Get the original invoice
        const invoice = await Invoice.findOne({
          _id: body.invoiceId,
          isDeleted: false,
        });
        
        if (!invoice) {
          return NextResponse.json({
            success: false,
            error: "Invoice not found",
          }, { status: 404 });
        }
        
        // Generate refund number
        const count = await Refund.countDocuments();
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const seq = String(count + 1).padStart(4, '0');
        const refundNumber = `REF-${year}${month}${day}-${seq}`;
        
        // Create refund
        const refundData = {
          number: refundNumber,
          invoiceId: body.invoiceId,
          invoiceNumber: invoice.number,
          customerId: body.customerId || invoice.customerId,
          customerName: body.customerName || invoice.customerName,
          employeeEmail: user.email,
          employeeName: user.name || "Staff",
          type: body.type || "partial",
          reason: body.reason,
          returnedItems: body.returnedItems,
          exchangedItems: body.exchangedItems || [],
          refundSubtotal: body.refundSubtotal,
          exchangeSubtotal: body.exchangeSubtotal || 0,
          taxAdjustment: body.taxAdjustment || 0,
          exchangeTax: body.exchangeTax || 0,
          netRefund: body.netRefund,
          amountDue: body.amountDue || 0,
          settlementMethod: body.settlementMethod,
          refundMethod: body.refundMethod || "cash",
          status: "processed",
          exchangeInvoiceId: body.exchangeInvoiceId,
          exchangeInvoiceNumber: body.exchangeInvoiceNumber,
          notes: body.notes,
          createdBy: user.id,
          updatedBy: user.id,
        };
        
        const refund = await Refund.create(refundData);
        console.log(`✅ Refund created: ${refund.number}`);
        
        // Process returned items (restock)
        for (const item of body.returnedItems) {
          if (item.restock && item.qty > 0) {
            const product = await Product.findOne({
              _id: item.productId,
              isDeleted: false,
            });
            
            if (product) {
              const previousStock = product.stock;
              const newStock = product.stock + item.qty;
              
              await Product.findByIdAndUpdate(item.productId, {
                stock: newStock,
                updatedBy: user.id,
              });
              
              await InventoryMovement.create({
                productId: item.productId,
                productName: product.name,
                type: "return",
                qty: item.qty,
                previousStock,
                newStock,
                reference: refund.number,
                note: `Return from ${invoice.number}`,
                userEmail: user.email,
                userId: user.id,
              });
            }
          }
        }
        
        // Process exchanged items (deduct stock)
        if (body.exchangedItems && body.exchangedItems.length > 0) {
          for (const item of body.exchangedItems) {
            const product = await Product.findOne({
              _id: item.productId,
              isDeleted: false,
            });
            
            if (product) {
              const previousStock = product.stock;
              const newStock = product.stock - item.qty;
              
              if (newStock < 0) {
                return NextResponse.json({
                  success: false,
                  error: `Insufficient stock for "${product.name}"`,
                }, { status: 400 });
              }
              
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
                reference: refund.number,
                note: `Exchange for ${invoice.number}`,
                userEmail: user.email,
                userId: user.id,
              });
            }
          }
        }
        
        // Update invoice status
        // Calculate total returned units for this invoice
        const allRefunds = await Refund.find({
          invoiceId: body.invoiceId,
          isDeleted: false,
          status: "processed",
        });
        
        let totalReturned = 0;
        for (const r of allRefunds) {
          for (const item of r.returnedItems) {
            totalReturned += item.qty;
          }
        }
        
        const totalInvoiceUnits = invoice.items.reduce((sum: number, item: any) => sum + item.qty, 0);
        const newStatus = totalReturned >= totalInvoiceUnits ? "refunded" : "partially_refunded";
        
        await Invoice.findByIdAndUpdate(body.invoiceId, {
          paymentStatus: newStatus,
          updatedBy: user.id,
        });
        
        return NextResponse.json({
          success: true,
          data: refund,
          message: `Refund ${refund.number} processed successfully`,
        }, { status: 201 });
        
      } catch (error: any) {
        console.error("❌ Error creating refund:", error);
        return NextResponse.json({
          success: false,
          error: error.message || "Failed to create refund",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}