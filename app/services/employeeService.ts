// app/services/employeeService.ts
import { IEmployee } from "@/app/models/Employee";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface EmployeeResponse {
  success: boolean;
  data?: IEmployee | IEmployee[];
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

export const employeeService = {
  // Get all employees
  async getEmployees(params?: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<EmployeeResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append("search", params.search);
      if (params?.role && params.role !== "all") queryParams.append("role", params.role);
      if (params?.status && params.status !== "all") queryParams.append("status", params.status);
      if (params?.page) queryParams.append("page", String(params.page));
      if (params?.limit) queryParams.append("limit", String(params.limit));

      const url = buildApiUrl(`/api/employees${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Error fetching employees:", error);
      return {
        success: false,
        error: "Failed to fetch employees",
      };
    }
  },

  // Get single employee
  async getEmployee(id: string): Promise<EmployeeResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/employees/${id}`));
      return await response.json();
    } catch (error) {
      console.error("Error fetching employee:", error);
      return {
        success: false,
        error: "Failed to fetch employee",
      };
    }
  },

  // Create employee (also creates a user account)
  async createEmployee(data: any): Promise<EmployeeResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/employees"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Create employee failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create employee",
        };
      }

      return result;
    } catch (error) {
      console.error("Error creating employee:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create employee",
      };
    }
  },

  // Update employee (also updates the linked user)
  async updateEmployee(id: string, data: any): Promise<EmployeeResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/employees/${id}`), {
        method: "PUT",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Update employee failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update employee",
        };
      }

      return result;
    } catch (error) {
      console.error("Error updating employee:", error);
      return {
        success: false,
        error: "Failed to update employee",
      };
    }
  },

  // Delete employee (also deletes the linked user)
  async deleteEmployee(id: string): Promise<EmployeeResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/employees/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Delete employee failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete employee",
        };
      }

      return result;
    } catch (error) {
      console.error("Error deleting employee:", error);
      return {
        success: false,
        error: "Failed to delete employee",
      };
    }
  },

  // Get employee stats
  async getStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(buildApiUrl("/api/employees/stats"));
      return await response.json();
    } catch (error) {
      console.error("Error fetching employee stats:", error);
      return {
        success: false,
        error: "Failed to fetch employee stats",
      };
    }
  },
};