// app/services/productService.ts
import { IProduct } from "@/app/models/Product";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface ProductResponse {
  success: boolean;
  data?: IProduct | IProduct[];
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Helper function to get auth token
const getAuthToken = (): string | null => {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'session') {
        return value;
      }
    }
  }
  
  try {
    const session = localStorage.getItem('erp:session');
    if (session) {
      const user = JSON.parse(session);
      return user?.token || null;
    }
  } catch {
    return null;
  }
  
  return null;
};

const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  
  if (response.status === 401) {
    console.error('Authentication failed for:', url);
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  
  return response;
};

export const productService = {
  // Get all products with filters (Public)
  async getAll(params?: {
    search?: string;
    category?: string;
    status?: string;
    minStock?: number;
    lowStock?: boolean;
    includeDeleted?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ProductResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append('search', params.search);
      if (params?.category && params.category !== 'all') queryParams.append('category', params.category);
      if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params?.minStock !== undefined) queryParams.append('minStock', String(params.minStock));
      if (params?.lowStock) queryParams.append('lowStock', 'true');
      if (params?.includeDeleted) queryParams.append('includeDeleted', 'true');
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.limit) queryParams.append('limit', String(params.limit));
      
      const url = buildApiUrl(`/api/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error fetching products:', error);
      return {
        success: false,
        error: "Failed to fetch products",
      };
    }
  },

  // Get single product by ID (Public)
  async getById(id: string, includeDeleted = false): Promise<ProductResponse> {
    try {
      const query = includeDeleted ? "?includeDeleted=true" : "";
      const response = await fetch(buildApiUrl(`/api/products/${id}${query}`));
      return await response.json();
    } catch (error) {
      console.error('Error fetching product:', error);
      return {
        success: false,
        error: "Failed to fetch product",
      };
    }
  },

  // Create new product (Admin/Employee only)
  async create(data: Partial<IProduct>): Promise<ProductResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/products"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Create product failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create product",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error creating product:', error);
      return {
        success: false,
        error: "Failed to create product",
      };
    }
  },

  // Update product (Admin/Employee only)
  async update(id: string, data: Partial<IProduct>): Promise<ProductResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/products/${id}`), {
        method: "PUT",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Update product failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update product",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error updating product:', error);
      return {
        success: false,
        error: "Failed to update product",
      };
    }
  },

  // Soft delete product (Admin only)
  async delete(id: string): Promise<ProductResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/products/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Delete product failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete product",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting product:', error);
      return {
        success: false,
        error: "Failed to delete product",
      };
    }
  },

  // Update product stock (Admin/Employee only)
  async updateStock(id: string, stock: number): Promise<ProductResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/products/${id}`), {
        method: "PATCH",
        body: JSON.stringify({ stock }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Update stock failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update stock",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error updating stock:', error);
      return {
        success: false,
        error: "Failed to update stock",
      };
    }
  },

  // Adjust product stock (Admin/Employee only)
  async adjustStock(id: string, adjustment: number): Promise<ProductResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/products/${id}`), {
        method: "PATCH",
        body: JSON.stringify({ adjustment }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Adjust stock failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to adjust stock",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error adjusting stock:', error);
      return {
        success: false,
        error: "Failed to adjust stock",
      };
    }
  },

  // Restore soft-deleted product (Admin only)
  async restore(id: string): Promise<ProductResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/products/${id}/restore`), {
        method: "PATCH",
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Restore product failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to restore product",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error restoring product:', error);
      return {
        success: false,
        error: "Failed to restore product",
      };
    }
  },
};