// app/services/inventoryService.ts
import { IInventoryMovement } from "@/app/models/InventoryMovement";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface InventoryMovementResponse {
  success: boolean;
  data?: IInventoryMovement | IInventoryMovement[];
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface InventoryStats {
  totalSKUs: number;
  stockValue: number;
  lowStock: number;
  outOfStock: number;
  totalMovements: number;
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

export const inventoryService = {
  // Get all movements with filters
  async getMovements(params?: {
    productId?: string;
    vendorId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<InventoryMovementResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.productId) queryParams.append('productId', params.productId);
      if (params?.vendorId) queryParams.append('vendorId', params.vendorId);
      if (params?.type && params.type !== 'all') queryParams.append('type', params.type);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.includeDeleted) queryParams.append('includeDeleted', 'true');
      
      const url = buildApiUrl(`/api/inventory/movements${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error fetching movements:', error);
      return {
        success: false,
        error: "Failed to fetch inventory movements",
      };
    }
  },

  // Get inventory stats
  async getStats(): Promise<{ success: boolean; data?: InventoryStats; error?: string }> {
    try {
      const response = await fetch(buildApiUrl('/api/inventory/stats'));
      return await response.json();
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
      return {
        success: false,
        error: "Failed to fetch inventory stats",
      };
    }
  },

  // Create a new movement (purchase)
  async createPurchase(data: {
    productId: string;
    qty: number;
    vendorId: string;
    cost?: number;
    note?: string;
  }): Promise<InventoryMovementResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/inventory/movements"), {
        method: "POST",
        body: JSON.stringify({ ...data, type: "purchase" }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Create purchase failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create purchase",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error creating purchase:', error);
      return {
        success: false,
        error: "Failed to create purchase",
      };
    }
  },

  // Create an adjustment
  async createAdjustment(data: {
    productId: string;
    qty: number;
    note?: string;
  }): Promise<InventoryMovementResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/inventory/movements"), {
        method: "POST",
        body: JSON.stringify({ ...data, type: "adjustment" }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Create adjustment failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create adjustment",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error creating adjustment:', error);
      return {
        success: false,
        error: "Failed to create adjustment",
      };
    }
  },

  // Delete a movement (Admin only)
  async deleteMovement(id: string): Promise<InventoryMovementResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/inventory/movements/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Delete movement failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete movement",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting movement:', error);
      return {
        success: false,
        error: "Failed to delete movement",
      };
    }
  },

  // Get movements for a specific product
  async getProductMovements(productId: string, limit?: number): Promise<InventoryMovementResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('productId', productId);
      if (limit) queryParams.append('limit', String(limit));
      
      const url = buildApiUrl(`/api/inventory/movements?${queryParams.toString()}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error fetching product movements:', error);
      return {
        success: false,
        error: "Failed to fetch product movements",
      };
    }
  },
};