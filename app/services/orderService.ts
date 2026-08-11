// app/services/orderService.ts
import { IOrder } from "@/app/models/Order";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface OrderResponse {
  success: boolean;
  data?: IOrder | IOrder[];
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

export const orderService = {
  // Get all orders
  async getOrders(params?: {
    customerEmail?: string;
    orderStatus?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<OrderResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.customerEmail)
        queryParams.append("customerEmail", params.customerEmail);
      if (params?.orderStatus && params.orderStatus !== "all")
        queryParams.append("orderStatus", params.orderStatus);
      if (params?.paymentStatus && params.paymentStatus !== "all")
        queryParams.append("paymentStatus", params.paymentStatus);
      if (params?.startDate) queryParams.append("startDate", params.startDate);
      if (params?.endDate) queryParams.append("endDate", params.endDate);
      if (params?.page) queryParams.append("page", String(params.page));
      if (params?.limit) queryParams.append("limit", String(params.limit));

      const url = buildApiUrl(`/api/orders${queryParams.toString() ? `?${queryParams.toString()}` : ""}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Error fetching orders:", error);
      return {
        success: false,
        error: "Failed to fetch orders",
      };
    }
  },

  // Get single order
  async getOrder(id: string): Promise<OrderResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/orders/${id}`));
      return await response.json();
    } catch (error) {
      console.error("Error fetching order:", error);
      return {
        success: false,
        error: "Failed to fetch order",
      };
    }
  },

  // Get order by number
  async getOrderByNumber(number: string): Promise<OrderResponse> {
    try {
      const response = await fetch(buildApiUrl(`/api/orders/lookup/${number}`));
      return await response.json();
    } catch (error) {
      console.error("Error fetching order:", error);
      return {
        success: false,
        error: "Failed to fetch order",
      };
    }
  },

  // Create order
  async createOrder(data: Partial<IOrder>): Promise<OrderResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/orders"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Create order failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create order",
        };
      }

      return result;
    } catch (error) {
      console.error("Error creating order:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create order",
      };
    }
  },

  // Update order status
  async updateOrderStatus(
    id: string,
    orderStatus: string
  ): Promise<OrderResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/orders/${id}/status`), {
        method: "PATCH",
        body: JSON.stringify({ orderStatus }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Update order status failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update order status",
        };
      }

      return result;
    } catch (error) {
      console.error("Error updating order status:", error);
      return {
        success: false,
        error: "Failed to update order status",
      };
    }
  },

  // Update payment status
  async updatePaymentStatus(
    id: string,
    paymentStatus: string
  ): Promise<OrderResponse> {
    try {
      const response = await authFetch(
        buildApiUrl(`/api/orders/${id}/payment`),
        {
          method: "PATCH",
          body: JSON.stringify({ paymentStatus }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Update payment status failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update payment status",
        };
      }

      return result;
    } catch (error) {
      console.error("Error updating payment status:", error);
      return {
        success: false,
        error: "Failed to update payment status",
      };
    }
  },

  // Cancel order
  async cancelOrder(id: string, reason?: string): Promise<OrderResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/orders/${id}/cancel`), {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Cancel order failed:", result);
        return {
          success: false,
          error: result.error || result.message || "Failed to cancel order",
        };
      }

      return result;
    } catch (error) {
      console.error("Error cancelling order:", error);
      return {
        success: false,
        error: "Failed to cancel order",
      };
    }
  },

  // Get order stats
  async getStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(buildApiUrl("/api/orders/stats"));
      return await response.json();
    } catch (error) {
      console.error("Error fetching order stats:", error);
      return {
        success: false,
        error: "Failed to fetch order stats",
      };
    }
  },
};