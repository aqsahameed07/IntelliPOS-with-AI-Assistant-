// app/hooks/useInvoices.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { invoiceService } from "@/app/services/invoiceService";
import { IInvoice } from "@/app/models/Invoice";
import { toast } from "sonner";

interface UseInvoicesReturn {
  invoices: IInvoice[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchInvoices: (params?: {
    customerId?: string;
    status?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  getInvoice: (id: string) => Promise<IInvoice | null>;
  getInvoiceByNumber: (number: string) => Promise<IInvoice | null>;
  createInvoice: (data: Partial<IInvoice>) => Promise<IInvoice | null>;
  updateInvoice: (id: string, data: Partial<IInvoice>) => Promise<IInvoice | null>;
  cancelInvoice: (id: string, reason?: string) => Promise<boolean>;
  updatePaymentStatus: (id: string, paymentStatus: string, paymentReference?: string) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<boolean>;
  getStats: () => Promise<any>;
}

export function useInvoices(): UseInvoicesReturn {
  const [invoices, setInvoices] = useState<IInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>();

  // Fetch all invoices
  const fetchInvoices = useCallback(async (params?: {
    customerId?: string;
    status?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await invoiceService.getInvoices(params);
      
      if (result.success && result.data) {
        setInvoices(result.data as IInvoice[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch invoices");
        toast.error(result.error || "Failed to fetch invoices");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get single invoice
  const getInvoice = useCallback(async (id: string): Promise<IInvoice | null> => {
    try {
      const result = await invoiceService.getInvoice(id);
      
      if (result.success && result.data) {
        return result.data as IInvoice;
      } else {
        toast.error(result.error || "Invoice not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Get invoice by number
  const getInvoiceByNumber = useCallback(async (number: string): Promise<IInvoice | null> => {
    try {
      const result = await invoiceService.getInvoiceByNumber(number);
      
      if (result.success && result.data) {
        return result.data as IInvoice;
      } else {
        toast.error(result.error || "Invoice not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Create invoice
  const createInvoice = useCallback(async (data: Partial<IInvoice>): Promise<IInvoice | null> => {
    try {
      const result = await invoiceService.createInvoice(data);
      
      if (result.success && result.data) {
        const newInvoice = result.data as IInvoice;
        setInvoices(prev => [newInvoice, ...prev]);
        toast.success(result.message || "Invoice created successfully");
        return newInvoice;
      } else {
        toast.error(result.error || "Failed to create invoice");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Update invoice
  const updateInvoice = useCallback(async (id: string, data: Partial<IInvoice>): Promise<IInvoice | null> => {
    try {
      const result = await invoiceService.updateInvoice(id, data);
      
      if (result.success && result.data) {
        const updatedInvoice = result.data as IInvoice;
        setInvoices(prev => 
          prev.map(inv => inv._id === id ? updatedInvoice : inv)
        );
        toast.success(result.message || "Invoice updated successfully");
        return updatedInvoice;
      } else {
        toast.error(result.error || "Failed to update invoice");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Cancel invoice
  const cancelInvoice = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    try {
      const result = await invoiceService.cancelInvoice(id, reason);
      
      if (result.success) {
        setInvoices(prev => 
          prev.map(inv => 
            inv._id === id ? ({ ...inv, status: "cancelled" as const } as IInvoice) : inv
          )
        );
        toast.success(result.message || "Invoice cancelled successfully");
        return true;
      } else {
        toast.error(result.error || "Failed to cancel invoice");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, []);

  // Update payment status
  const updatePaymentStatus = useCallback(async (id: string, paymentStatus: string, paymentReference?: string): Promise<boolean> => {
    try {
      const result = await invoiceService.updatePaymentStatus(id, paymentStatus, paymentReference);
      
      if (result.success) {
        setInvoices(prev => 
          prev.map(inv => 
            inv._id === id ? ({ ...inv, paymentStatus: paymentStatus as IInvoice["paymentStatus"] } as IInvoice) : inv
          )
        );
        toast.success(result.message || "Payment status updated successfully");
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

  // Delete invoice
  const deleteInvoice = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await invoiceService.deleteInvoice(id);
      
      if (result.success) {
        setInvoices(prev => prev.filter(inv => inv._id !== id));
        toast.success(result.message || "Invoice deleted successfully");
        return true;
      } else {
        toast.error(result.error || "Failed to delete invoice");
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
      const result = await invoiceService.getStats();
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
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    pagination,
    fetchInvoices,
    getInvoice,
    getInvoiceByNumber,
    createInvoice,
    updateInvoice,
    cancelInvoice,
    updatePaymentStatus,
    deleteInvoice,
    getStats,
  };
}