// app/hooks/useOrders.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { orderService } from "@/app/services/orderService";
import { IOrder } from "@/app/models/Order";
import { toast } from "sonner";

interface UseOrdersReturn {
  orders: IOrder[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchOrders: (params?: {
    customerEmail?: string;
    orderStatus?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  getOrder: (id: string) => Promise<IOrder | null>;
  getOrderByNumber: (number: string) => Promise<IOrder | null>;
  createOrder: (data: Partial<IOrder>) => Promise<IOrder | null>;
  updateOrderStatus: (id: string, orderStatus: string) => Promise<boolean>;
  updatePaymentStatus: (id: string, paymentStatus: string) => Promise<boolean>;
  cancelOrder: (id: string, reason?: string) => Promise<boolean>;
  getStats: () => Promise<any>;
}

export function useOrders(): UseOrdersReturn {
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>();

  const fetchOrders = useCallback(async (params?: {
    customerEmail?: string;
    orderStatus?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await orderService.getOrders(params);

      if (result.success && result.data) {
        setOrders(result.data as IOrder[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch orders");
        toast.error(result.error || "Failed to fetch orders");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getOrder = useCallback(async (id: string): Promise<IOrder | null> => {
    try {
      const result = await orderService.getOrder(id);
      if (result.success && result.data) {
        return result.data as IOrder;
      } else {
        toast.error(result.error || "Order not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  const getOrderByNumber = useCallback(async (number: string): Promise<IOrder | null> => {
    try {
      const result = await orderService.getOrderByNumber(number);
      if (result.success && result.data) {
        return result.data as IOrder;
      } else {
        toast.error(result.error || "Order not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  const createOrder = useCallback(async (data: Partial<IOrder>): Promise<IOrder | null> => {
    try {
      const result = await orderService.createOrder(data);
      if (result.success && result.data) {
        const newOrder = result.data as IOrder;
        setOrders(prev => [newOrder, ...prev]);
        toast.success(result.message || "Order created successfully");
        return newOrder;
      } else {
        toast.error(result.error || "Failed to create order");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  const updateOrderStatus = useCallback(async (id: string, orderStatus: string): Promise<boolean> => {
    try {
      const result = await orderService.updateOrderStatus(id, orderStatus);
      if (result.success) {
        setOrders(prev =>
          prev.map(order =>
            order._id === id ? { ...order, orderStatus: orderStatus as any } : order
          )
        );
        toast.success(result.message || "Order status updated");
        return true;
      } else {
        toast.error(result.error || "Failed to update order status");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  const updatePaymentStatus = useCallback(async (id: string, paymentStatus: string): Promise<boolean> => {
    try {
      const result = await orderService.updatePaymentStatus(id, paymentStatus);
      if (result.success) {
        setOrders(prev =>
          prev.map(order =>
            order._id === id ? { ...order, paymentStatus: paymentStatus as any } : order
          )
        );
        toast.success(result.message || "Payment status updated");
        return true;
      } else {
        toast.error(result.error || "Failed to update payment status");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  const cancelOrder = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    try {
      const result = await orderService.cancelOrder(id, reason);
      if (result.success) {
        setOrders(prev =>
          prev.map(order =>
            order._id === id ? { ...order, orderStatus: "cancelled" as const } : order
          )
        );
        toast.success(result.message || "Order cancelled");
        return true;
      } else {
        toast.error(result.error || "Failed to cancel order");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  const getStats = useCallback(async () => {
    try {
      const result = await orderService.getStats();
      if (result.success) {
        return result.data;
      } else {
        toast.error(result.error || "Failed to fetch stats");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    pagination,
    fetchOrders,
    getOrder,
    getOrderByNumber,
    createOrder,
    updateOrderStatus,
    updatePaymentStatus,
    cancelOrder,
    getStats,
  };
}