// app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { saveBase64Image, isBase64Image } from "@/lib/server-image-utils";
import { Product } from "@/app/models/Product";
import { withAuth } from "@/lib/authMiddleware";

// GET - Fetch single product by ID (Public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id: paramId } = await params;
    const id = paramId || request.nextUrl.pathname.split("/").pop() || "";
    const includeDeleted = request.nextUrl.searchParams.get("includeDeleted") === "true";
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Product ID is required",
      }, { status: 400 });
    }
    
    const query: Record<string, unknown> = { _id: id };
    if (!includeDeleted) {
      query.isDeleted = false;
    }
    
    const product = await Product.findOne(query);
    
    if (!product) {
      return NextResponse.json({
        success: false,
        error: "Product not found",
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: product,
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch product",
    }, { status: 500 });
  }
}

// PUT - Update product by ID (Admin and Employee only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();
        
        const { id: paramId } = await params;
        const id = paramId || request.nextUrl.pathname.split("/").pop() || "";
        const body = await request.json();
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Product ID is required",
          }, { status: 400 });
        }
        
        // Check if product exists
        const existingProduct = await Product.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!existingProduct) {
          return NextResponse.json({
            success: false,
            error: "Product not found",
          }, { status: 404 });
        }
        
        // Check for duplicate SKU
        if (body.sku && body.sku !== existingProduct.sku) {
          const duplicate = await Product.findOne({
            sku: body.sku,
            isDeleted: false,
            _id: { $ne: id },
          });
          
          if (duplicate) {
            return NextResponse.json({
              success: false,
              error: "Product with this SKU already exists",
            }, { status: 409 });
          }
        }
        
// Handle image
let image = body.image;
if (image && isBase64Image(image)) {
  image = await saveBase64Image(image, "product", "products");
}

// Handle gallery
let gallery = body.gallery;
if (gallery && Array.isArray(gallery) && gallery.length > 0) {
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
        
        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
          id,
          {
            name: body.name?.trim(),
            category: body.category,
            sku: body.sku?.trim(),
            barcode: body.barcode?.trim() || undefined,
            brand: body.brand?.trim() || undefined,
            supplierId: body.supplierId || undefined,
            description: body.description || "",
            image: image || undefined,
            gallery: gallery || [],
            purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) : undefined,
            sellingPrice: body.sellingPrice !== undefined ? Number(body.sellingPrice) : undefined,
            discount: body.discount !== undefined ? Number(body.discount) : undefined,
            tax: body.tax !== undefined ? Number(body.tax) : undefined,
            unit: body.unit,
            tags: tags,
            stock: body.stock !== undefined ? Number(body.stock) : undefined,
            minStock: body.minStock !== undefined ? Number(body.minStock) : undefined,
            status: body.status,
            updatedBy: user.id,
          },
          { new: true, runValidators: true }
        );
        
        return NextResponse.json({
          success: true,
          data: updatedProduct,
          message: "Product updated successfully",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error updating product:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update product",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}

// DELETE - Soft delete product by ID (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();
        
        const { id: paramId } = await params;
        const id = paramId || request.nextUrl.pathname.split("/").pop() || "";
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Product ID is required",
          }, { status: 400 });
        }
        
        // Check if product exists
        const product = await Product.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!product) {
          return NextResponse.json({
            success: false,
            error: "Product not found or already deleted",
          }, { status: 404 });
        }
        
        // Soft delete
        await Product.findByIdAndUpdate(id, {
          isDeleted: true,
          status: "inactive",
          deletedBy: user.id,
          deletedAt: new Date(),
        });
        
        return NextResponse.json({
          success: true,
          message: "Product deleted successfully",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error deleting product:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to delete product",
        }, { status: 500 });
      }
    },
    ["Admin"]
  );
}

// PATCH - Update product stock (Admin and Employee only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (user) => {
      try {
        await connectDB();
        
        const { id: paramId } = await params;
        const id = paramId || request.nextUrl.pathname.split("/").pop() || "";
        const { stock, adjustment } = await request.json();
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: "Product ID is required",
          }, { status: 400 });
        }
        
        if (stock === undefined && adjustment === undefined) {
          return NextResponse.json({
            success: false,
            error: "Stock or adjustment value is required",
          }, { status: 400 });
        }
        
        // Check if product exists
        const product = await Product.findOne({
          _id: id,
          isDeleted: false,
        });
        
        if (!product) {
          return NextResponse.json({
            success: false,
            error: "Product not found",
          }, { status: 404 });
        }
        
        let newStock = product.stock;
        if (adjustment !== undefined) {
          newStock = Math.max(0, product.stock + adjustment);
        } else if (stock !== undefined) {
          newStock = Math.max(0, stock);
        }
        
        const updatedProduct = await Product.findByIdAndUpdate(
          id,
          {
            stock: newStock,
            updatedBy: user.id,
          },
          { new: true }
        );
        
        return NextResponse.json({
          success: true,
          data: {
            stock: updatedProduct.stock,
            minStock: updatedProduct.minStock,
            isLowStock: updatedProduct.stock <= updatedProduct.minStock,
          },
          message: "Stock updated successfully",
        }, { status: 200 });
        
      } catch (error) {
        console.error("Error updating stock:", error);
        return NextResponse.json({
          success: false,
          error: "Failed to update stock",
        }, { status: 500 });
      }
    },
    ["Admin", "Employee"]
  );
}