// app/services/vendorService.ts
import { IVendor } from "@/app/models/Vendor";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface VendorResponse {
  success: boolean;
  data?: IVendor | IVendor[];
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

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
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

export const vendorService = {
  // Get all vendors
  async getVendors(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<VendorResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append("search", params.search);
      if (params?.status && params.status !== "all") queryParams.append("status", params.status);
      if (params?.page) queryParams.append("page", String(params.page));
      if (params?.limit) queryParams.append("limit", String(params.limit));

      const url = buildApiUrl(`/api/vendors${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Error fetching vendors:", error);
      return {
        success: false,
        error: "Failed to fetch vendors",
      };
    }
  },

  // Get single vendor
  async getVendor(id: string): Promise<VendorResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/vendors/${id}`));
      return await response.json();
    } catch (error) {
      console.error("Error fetching vendor:", error);
      return {
        success: false,
        error: "Failed to fetch vendor",
      };
    }
  },

  // Create vendor
  async createVendor(data: Partial<IVendor>): Promise<VendorResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/vendors"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Create vendor failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create vendor",
        };
      }

      return result;
    } catch (error) {
      console.error("Error creating vendor:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create vendor",
      };
    }
  },

  // Update vendor
  async updateVendor(id: string, data: Partial<IVendor>): Promise<VendorResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/vendors/${id}`), {
        method: "PUT",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Update vendor failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update vendor",
        };
      }

      return result;
    } catch (error) {
      console.error("Error updating vendor:", error);
      return {
        success: false,
        error: "Failed to update vendor",
      };
    }
  },

  // Delete vendor
  async deleteVendor(id: string): Promise<VendorResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/vendors/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Delete vendor failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete vendor",
        };
      }

      return result;
    } catch (error) {
      console.error("Error deleting vendor:", error);
      return {
        success: false,
        error: "Failed to delete vendor",
      };
    }
  },

  // Get vendor stats
  async getStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(buildApiUrl("/api/vendors/stats"));
      return await response.json();
    } catch (error) {
      console.error("Error fetching vendor stats:", error);
      return {
        success: false,
        error: "Failed to fetch vendor stats",
      };
    }
  },
};