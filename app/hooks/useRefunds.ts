// app/hooks/useRefunds.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { refundService } from "@/app/services/refundService";
import { IRefund } from "@/app/models/Refund";
import { toast } from "sonner";

interface UseRefundsReturn {
  refunds: IRefund[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchRefunds: (params?: {
    invoiceId?: string;
    customerId?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  getRefund: (id: string) => Promise<IRefund | null>;
  getRefundsByInvoice: (invoiceId: string) => Promise<IRefund[]>;
  createRefund: (data: Partial<IRefund>) => Promise<IRefund | null>;
  updateRefund: (id: string, data: Partial<IRefund>) => Promise<IRefund | null>;
  cancelRefund: (id: string, reason?: string) => Promise<boolean>;
  deleteRefund: (id: string) => Promise<boolean>;
  getStats: () => Promise<any>;
}

export function useRefunds(): UseRefundsReturn {
  const [refunds, setRefunds] = useState<IRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>();

  // Fetch all refunds
  const fetchRefunds = useCallback(async (params?: {
    invoiceId?: string;
    customerId?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await refundService.getRefunds(params);
      
      if (result.success && result.data) {
        setRefunds(result.data as IRefund[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch refunds");
        toast.error(result.error || "Failed to fetch refunds");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single refund
  const getRefund = useCallback(async (id: string): Promise<IRefund | null> => {
    try {
      const result = await refundService.getRefund(id);
      
      if (result.success && result.data) {
        return result.data as IRefund;
      } else {
        toast.error(result.error || "Refund not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Get refunds by invoice
  const getRefundsByInvoice = useCallback(async (invoiceId: string): Promise<IRefund[]> => {
    try {
      const result = await refundService.getRefundsByInvoice(invoiceId);
      
      if (result.success && result.data) {
        return result.data as IRefund[];
      } else {
        toast.error(result.error || "Failed to fetch refunds");
        return [];
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return [];
    }
  }, []);

  // Create refund
  const createRefund = useCallback(async (data: Partial<IRefund>): Promise<IRefund | null> => {
    try {
      const result = await refundService.createRefund(data);
      
      if (result.success && result.data) {
        const newRefund = result.data as IRefund;
        setRefunds(prev => [newRefund, ...prev]);
        toast.success(result.message || "Refund processed successfully");
        return newRefund;
      } else {
        toast.error(result.error || "Failed to create refund");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Update refund
  const updateRefund = useCallback(async (id: string, data: Partial<IRefund>): Promise<IRefund | null> => {
    try {
      const result = await refundService.updateRefund(id, data);
      
      if (result.success && result.data) {
        const updatedRefund = result.data as IRefund;
        setRefunds(prev => 
          prev.map(r => r._id === id ? updatedRefund : r)
        );
        toast.success(result.message || "Refund updated successfully");
        return updatedRefund;
      } else {
        toast.error(result.error || "Failed to update refund");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Cancel refund
  const cancelRefund = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    try {
      const result = await refundService.cancelRefund(id, reason);
      
      if (result.success) {
        setRefunds(prev => 
          prev.map(r => 
            r._id === id ? ({ ...r, status: "cancelled" as const } as IRefund) : r
          )
        );
        toast.success(result.message || "Refund cancelled successfully");
        return true;
      } else {
        toast.error(result.error || "Failed to cancel refund");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  // Delete refund
  const deleteRefund = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await refundService.deleteRefund(id);
      
      if (result.success) {
        setRefunds(prev => prev.filter(r => r._id !== id));
        toast.success(result.message || "Refund deleted successfully");
        return true;
      } else {
        toast.error(result.error || "Failed to delete refund");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  // Get stats
  const getStats = useCallback(async () => {
    try {
      const result = await refundService.getStats();
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

  // Auto-fetch on mount
  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  return {
    refunds,
    loading,
    error,
    pagination,
    fetchRefunds,
    getRefund,
    getRefundsByInvoice,
    createRefund,
    updateRefund,
    cancelRefund,
    deleteRefund,
    getStats,
  };
}