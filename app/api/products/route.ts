// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { saveBase64Image, isBase64Image } from "@/lib/server-image-utils";
import { Product } from "@/app/models/Product";
import { withAuth } from "@/lib/authMiddleware";
import { logActivity } from "@/lib/activity-logger";

// GET - Fetch all products (Public)
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const minStock = searchParams.get('minStock');
    const lowStock = searchParams.get('lowStock') === 'true';
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    
    // Build query
    const query: Record<string, unknown> = {};
    
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Search by name, sku, or brand
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Low stock filter
    if (lowStock) {
      query.$expr = { $lte: ["$stock", "$minStock"] };
    }
    
    // Min stock threshold
    if (minStock) {
      query.stock = { $lte: parseInt(minStock) };
    }
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);
    
    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch products",
    }, { status: 500 });
  }
}

// POST - Create a new product (Admin and Employee only)
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
            error: "Product name is required",
          }, { status: 400 });
        }
        
        if (!body.sku) {
          return NextResponse.json({
            success: false,
            error: "SKU is required",
          }, { status: 400 });
        }
        
        if (body.sellingPrice === undefined || body.sellingPrice === null) {
          return NextResponse.json({
            success: false,
            error: "Selling price is required",
          }, { status: 400 });
        }
        
        // Check for duplicate SKU
        const existingProduct = await Product.findOne({
          sku: body.sku,
          isDeleted: false,
        });
        
        if (existingProduct) {
          return NextResponse.json({
            success: false,
            error: "Product with this SKU already exists",
          }, { status: 409 });
        }
        
     
// Handle image - use folder: "products"
let image = body.image;
if (image && isBase64Image(image)) {
  image = await saveBase64Image(image, "product", "products");
}

// Handle gallery
let gallery = body.gallery || [];
if (gallery.length > 0) {
  gallery = await Promise.all(
    gallery.map(async (img: string) => {
      if (isBase64Image(img)) {
        return await saveBase64Image(img, "product", "products");
      }
      return img;
    })
  );
}
        
        // Handle tags
        let tags = body.tags;
        if (typeof tags === 'string') {
          tags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
        
        const product = await Product.create({
          name: body.name.trim(),
          category: body.category || "Uncategorized",
          sku: body.sku.trim(),
          barcode: body.barcode?.trim() || undefined,
          brand: body.brand?.trim() || undefined,
          supplierId: body.supplierId || undefined,
          description: body.description || "",
          image: image || undefined,
          gallery: gallery || [],
          purchasePrice: Number(body.purchasePrice) || 0,
          sellingPrice: Number(body.sellingPrice),
          discount: Number(body.discount) || 0,
          tax: Number(body.tax) || 0,
          unit: body.unit || "Piece",
          tags: tags || [],
          stock: Number(body.stock) || 0,
          minStock: Number(body.minStock) || 5,
          status: body.status || "active",
          createdBy: user.id,
          updatedBy: user.id,
        });

        await logActivity(user, "product", `Product "${product.name}" created`, {
          productId: product._id,
          name: product.name,
          sku: product.sku,
        });
        
        return NextResponse.json({
          success: true,
          data: product,
          message: "Product created successfully",
        }, { status: 201 });
        
      } catch (error) {
        console.error("Error creating product:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to create product",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}