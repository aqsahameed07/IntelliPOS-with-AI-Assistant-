// app/services/refundService.ts
import { IRefund } from "@/app/models/Refund";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface RefundResponse {
  success: boolean;
  data?: IRefund | IRefund[];
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
  
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers as HeadersInit | undefined),
  });

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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

export const refundService = {
  // Get all refunds
  async getRefunds(params?: {
    invoiceId?: string;
    customerId?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<RefundResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.invoiceId) queryParams.append('invoiceId', params.invoiceId);
      if (params?.customerId) queryParams.append('customerId', params.customerId);
      if (params?.type && params.type !== 'all') queryParams.append('type', params.type);
      if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.includeDeleted) queryParams.append('includeDeleted', 'true');
      
      const url = buildApiUrl(`/api/refunds${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error fetching refunds:', error);
      return {
        success: false,
        error: "Failed to fetch refunds",
      };
    }
  },

  // Get single refund
  async getRefund(id: string): Promise<RefundResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/refunds/${id}`));
      return await response.json();
    } catch (error) {
      console.error('Error fetching refund:', error);
      return {
        success: false,
        error: "Failed to fetch refund",
      };
    }
  },

  // Get refunds by invoice
  async getRefundsByInvoice(invoiceId: string): Promise<RefundResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/refunds/invoice/${invoiceId}`));
      return await response.json();
    } catch (error) {
      console.error('Error fetching refunds by invoice:', error);
      return {
        success: false,
        error: "Failed to fetch refunds",
      };
    }
  },

  // Create refund
  async createRefund(data: Partial<IRefund>): Promise<RefundResponse> {
    try {
    
      
      const response = await authFetch(buildApiUrl("/api/refunds"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();
     
      
      if (!response.ok) {
        console.error('Create refund failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create refund",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error creating refund:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create refund",
      };
    }
  },

  // Update refund
  async updateRefund(id: string, data: Partial<IRefund>): Promise<RefundResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/refunds/${id}`), {
        method: "PUT",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Update refund failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update refund",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error updating refund:', error);
      return {
        success: false,
        error: "Failed to update refund",
      };
    }
  },

  // Cancel refund
  async cancelRefund(id: string, reason?: string): Promise<RefundResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/refunds/${id}/cancel`), {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Cancel refund failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to cancel refund",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error cancelling refund:', error);
      return {
        success: false,
        error: "Failed to cancel refund",
      };
    }
  },

  // Delete refund (Admin only)
  async deleteRefund(id: string): Promise<RefundResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/refunds/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Delete refund failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete refund",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting refund:', error);
      return {
        success: false,
        error: "Failed to delete refund",
      };
    }
  },

  // Get refund stats
  async getStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(buildApiUrl('/api/refunds/stats'));
      return await response.json();
    } catch (error) {
      console.error('Error fetching refund stats:', error);
      return {
        success: false,
        error: "Failed to fetch refund stats",
      };
    }
  },
};