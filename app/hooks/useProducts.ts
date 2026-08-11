// app/hooks/useProducts.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { productService } from "@/app/services/productService";
import { IProduct } from "@/app/models/Product";
import { toast } from "sonner";

interface UseProductsReturn {
  products: IProduct[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchProducts: (params?: {
    search?: string;
    category?: string;
    status?: string;
    minStock?: number;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  addProduct: (data: Partial<IProduct>) => Promise<IProduct | null>;
  updateProduct: (id: string, data: Partial<IProduct>) => Promise<IProduct | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  getProductById: (id: string) => Promise<IProduct | null>;
  updateStock: (id: string, stock: number) => Promise<boolean>;
  adjustStock: (id: string, adjustment: number) => Promise<boolean>;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>();

  // Fetch all products
  const fetchProducts = useCallback(async (params?: {
    search?: string;
    category?: string;
    status?: string;
    minStock?: number;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await productService.getAll(params);
      
      if (result.success && result.data) {
        setProducts(result.data as IProduct[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch products");
        toast.error(result.error || "Failed to fetch products");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add new product
  const addProduct = useCallback(async (data: Partial<IProduct>): Promise<IProduct | null> => {
    try {
      const result = await productService.create(data);
      
      if (result.success && result.data) {
        const newProduct = result.data as IProduct;
        setProducts(prev => [newProduct, ...prev]);
        toast.success("Product created successfully");
        return newProduct;
      } else {
        toast.error(result.error || "Failed to create product");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Update product
  const updateProduct = useCallback(async (id: string, data: Partial<IProduct>): Promise<IProduct | null> => {
    try {
      const result = await productService.update(id, data);
      
      if (result.success && result.data) {
        const updatedProduct = result.data as IProduct;
        setProducts(prev => 
          prev.map(p => p._id === id ? updatedProduct : p)
        );
        toast.success("Product updated successfully");
        return updatedProduct;
      } else {
        toast.error(result.error || "Failed to update product");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Delete product
  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await productService.delete(id);
      
      if (result.success) {
        setProducts(prev => prev.filter(p => p._id !== id));
        toast.success("Product deleted successfully");
        return true;
      } else {
        toast.error(result.error || "Failed to delete product");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  // Get single product by ID
  const getProductById = useCallback(async (id: string): Promise<IProduct | null> => {
    try {
      const result = await productService.getById(id);
      
      if (result.success && result.data) {
        return result.data as IProduct;
      } else {
        toast.error(result.error || "Product not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Update stock
  const updateStock = useCallback(async (id: string, stock: number): Promise<boolean> => {
    try {
      const result = await productService.updateStock(id, stock);
      
      if (result.success && result.data) {
        const updated = result.data as IProduct;
        setProducts(prev => 
          prev.map(p => p._id === id ? updated : p)
        );
        toast.success("Stock updated successfully");
        return true;
      } else {
        toast.error(result.error || "Failed to update stock");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  // Adjust stock
  const adjustStock = useCallback(async (id: string, adjustment: number): Promise<boolean> => {
    try {
      const result = await productService.adjustStock(id, adjustment);
      
      if (result.success && result.data) {
        const updated = result.data as IProduct;
        setProducts(prev => 
          prev.map(p => p._id === id ? updated : p)
        );
        toast.success("Stock adjusted successfully");
        return true;
      } else {
        toast.error(result.error || "Failed to adjust stock");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    pagination,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    updateStock,
    adjustStock,
  };
}