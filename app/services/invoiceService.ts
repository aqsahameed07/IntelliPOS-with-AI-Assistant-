// app/services/invoiceService.ts
import { IInvoice } from "@/app/models/Invoice";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface InvoiceResponse {
  success: boolean;
  data?: IInvoice | IInvoice[];
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

export const invoiceService = {
  // Get all invoices
  async getInvoices(params?: {
    customerId?: string;
    status?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<InvoiceResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.customerId) queryParams.append('customerId', params.customerId);
      if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params?.paymentStatus && params.paymentStatus !== 'all') queryParams.append('paymentStatus', params.paymentStatus);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.includeDeleted) queryParams.append('includeDeleted', 'true');
      
      const url = buildApiUrl(`/api/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return {
        success: false,
        error: "Failed to fetch invoices",
      };
    }
  },

  // Get single invoice
  async getInvoice(id: string): Promise<InvoiceResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/invoices/${id}`));
      return await response.json();
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return {
        success: false,
        error: "Failed to fetch invoice",
      };
    }
  },

  // Get invoice by number
  async getInvoiceByNumber(number: string): Promise<InvoiceResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/invoices/lookup/${number}`));
      return await response.json();
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return {
        success: false,
        error: "Failed to fetch invoice",
      };
    }
  },

  // Create invoice
  async createInvoice(data: Partial<IInvoice>): Promise<InvoiceResponse> {
    try {
      console.log('Creating invoice with data:', JSON.stringify(data, null, 2));
      
      const response = await authFetch(buildApiUrl("/api/invoices"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('Invoice creation response:', result);
      
      if (!response.ok) {
        console.error('Create invoice failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create invoice",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error creating invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create invoice",
      };
    }
  },

  // Update invoice
  async updateInvoice(id: string, data: Partial<IInvoice>): Promise<InvoiceResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/invoices/${id}`), {
        method: "PUT",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Update invoice failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update invoice",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error updating invoice:', error);
      return {
        success: false,
        error: "Failed to update invoice",
      };
    }
  },

  // Cancel invoice
  async cancelInvoice(id: string, reason?: string): Promise<InvoiceResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/invoices/${id}/cancel`), {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Cancel invoice failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to cancel invoice",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      return {
        success: false,
        error: "Failed to cancel invoice",
      };
    }
  },

  // Update payment status
  async updatePaymentStatus(id: string, paymentStatus: string, paymentReference?: string): Promise<InvoiceResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/invoices/${id}/payment`), {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus, paymentReference }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Update payment failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update payment",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error updating payment:', error);
      return {
        success: false,
        error: "Failed to update payment",
      };
    }
  },

  // Delete invoice (Admin only)
  async deleteInvoice(id: string): Promise<InvoiceResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/invoices/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Delete invoice failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete invoice",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      return {
        success: false,
        error: "Failed to delete invoice",
      };
    }
  },

  // Get invoice statistics
  async getStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(buildApiUrl('/api/invoices/stats'));
      return await response.json();
    } catch (error) {
      console.error('Error fetching invoice stats:', error);
      return {
        success: false,
        error: "Failed to fetch invoice stats",
      };
    }
  },
};

// Also export as default for compatibility
export default invoiceService;