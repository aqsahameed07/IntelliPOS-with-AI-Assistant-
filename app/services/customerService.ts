// app/services/customerService.ts
import { ICustomer } from "@/app/models/Customer";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface CustomerResponse {
  success: boolean;
  data?: ICustomer | ICustomer[];
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
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "session") {
        return value;
      }
    }
  }
  return null;
};

const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();

  const headers = new Headers({
    "Content-Type": "application/json",
    ...(options.headers as HeadersInit | undefined),
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    window.dispatchEvent(new Event("auth:unauthorized"));
  }

  return response;
};

export const customerService = {
  // Get all customers
  async getCustomers(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<CustomerResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append("search", params.search);
      if (params?.status && params.status !== "all") queryParams.append("status", params.status);
      if (params?.page) queryParams.append("page", String(params.page));
      if (params?.limit) queryParams.append("limit", String(params.limit));
      if (params?.includeDeleted) queryParams.append("includeDeleted", "true");

      const url = buildApiUrl(`/api/customers${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Error fetching customers:", error);
      return {
        success: false,
        error: "Failed to fetch customers",
      };
    }
  },

  // Get single customer
  async getCustomer(id: string): Promise<CustomerResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/customers/${id}`));
      return await response.json();
    } catch (error) {
      console.error("Error fetching customer:", error);
      return {
        success: false,
        error: "Failed to fetch customer",
      };
    }
  },

  // Get customer by email
  async getCustomerByEmail(email: string): Promise<CustomerResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/customers/email/${email}`));
      return await response.json();
    } catch (error) {
      console.error("Error fetching customer by email:", error);
      return {
        success: false,
        error: "Failed to fetch customer",
      };
    }
  },

  // Create customer (also creates a user account)
  async createCustomer(data: Partial<ICustomer> & { password?: string }): Promise<CustomerResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/customers"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Create customer failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create customer",
        };
      }

      return result;
    } catch (error) {
      console.error("Error creating customer:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create customer",
      };
    }
  },

  // Update customer
  async updateCustomer(id: string, data: Partial<ICustomer>): Promise<CustomerResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/customers/${id}`), {
        method: "PUT",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Update customer failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update customer",
        };
      }

      return result;
    } catch (error) {
      console.error("Error updating customer:", error);
      return {
        success: false,
        error: "Failed to update customer",
      };
    }
  },

  // Delete customer
  async deleteCustomer(id: string): Promise<CustomerResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/customers/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Delete customer failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete customer",
        };
      }

      return result;
    } catch (error) {
      console.error("Error deleting customer:", error);
      return {
        success: false,
        error: "Failed to delete customer",
      };
    }
  },

  // Update customer total purchases
  async updateTotalPurchases(id: string, amount: number): Promise<CustomerResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/customers/${id}/purchases`), {
        method: "PATCH",
        body: JSON.stringify({ amount }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Update total purchases failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update total purchases",
        };
      }

      return result;
    } catch (error) {
      console.error("Error updating total purchases:", error);
      return {
        success: false,
        error: "Failed to update total purchases",
      };
    }
  },

  // Get customer stats
  async getStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(buildApiUrl("/api/customers/stats"));
      return await response.json();
    } catch (error) {
      console.error("Error fetching customer stats:", error);
      return {
        success: false,
        error: "Failed to fetch customer stats",
      };
    }
  },
};