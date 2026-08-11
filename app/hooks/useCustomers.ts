// app/hooks/useCustomers.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { customerService } from "@/app/services/customerService";
import { ICustomer } from "@/app/models/Customer";
import { toast } from "sonner";

interface UseCustomersReturn {
  customers: ICustomer[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchCustomers: (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  searchCustomers: (searchTerm: string) => ICustomer[];
  getCustomer: (id: string) => Promise<ICustomer | null>;
  getCustomerByEmail: (email: string) => Promise<ICustomer | null>;
  createCustomer: (data: Partial<ICustomer> & { password?: string }, options?: { onSuccess?: () => void }) => Promise<ICustomer | null>;
  updateCustomer: (params: { id: string; data: Partial<ICustomer> }, options?: { onSuccess?: () => void }) => Promise<ICustomer | null>;
  deleteCustomer: (params: { id: string }, options?: { onSuccess?: () => void }) => Promise<boolean>;
  updateTotalPurchases: (id: string, amount: number) => Promise<boolean>;
  getStats: () => any;
}

export function useCustomers(): UseCustomersReturn {
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  // Fetch customers
  const fetchCustomers = useCallback(async (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await customerService.getCustomers(params);

      if (result.success && result.data) {
        setCustomers(result.data as ICustomer[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch customers");
        toast.error(result.error || "Failed to fetch customers");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search customers locally
  const searchCustomers = useCallback((searchTerm: string): ICustomer[] => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.phone?.includes(term)
    );
  }, [customers]);

  // Get single customer
  const getCustomer = useCallback(async (id: string): Promise<ICustomer | null> => {
    try {
      const result = await customerService.getCustomer(id);
      if (result.success && result.data) {
        return result.data as ICustomer;
      } else {
        toast.error(result.error || "Customer not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Get customer by email
  const getCustomerByEmail = useCallback(async (email: string): Promise<ICustomer | null> => {
    try {
      const result = await customerService.getCustomerByEmail(email);
      if (result.success && result.data) {
        return result.data as ICustomer;
      } else {
        return null;
      }
    } catch (err) {
      console.error("Error fetching customer by email:", err);
      return null;
    }
  }, []);

  // Create customer
  const createCustomer = useCallback(async (
    data: Partial<ICustomer> & { password?: string },
    options?: { onSuccess?: () => void }
  ): Promise<ICustomer | null> => {
    try {
      const result = await customerService.createCustomer(data);
      if (result.success && result.data) {
        const newCustomer = result.data as ICustomer;
        setCustomers(prev => [newCustomer, ...prev]);
        toast.success(result.message || "Customer created successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchCustomers();
        return newCustomer;
      } else {
        toast.error(result.error || "Failed to create customer");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchCustomers]);

  // Update customer
  const updateCustomer = useCallback(async (
    params: { id: string; data: Partial<ICustomer> },
    options?: { onSuccess?: () => void }
  ): Promise<ICustomer | null> => {
    try {
      const result = await customerService.updateCustomer(params.id, params.data);
      if (result.success && result.data) {
        const updatedCustomer = result.data as ICustomer;
        setCustomers(prev =>
          prev.map(c => (c._id === params.id ? updatedCustomer : c))
        );
        toast.success(result.message || "Customer updated successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchCustomers();
        return updatedCustomer;
      } else {
        toast.error(result.error || "Failed to update customer");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchCustomers]);

  // Delete customer
  const deleteCustomer = useCallback(async (
    params: { id: string },
    options?: { onSuccess?: () => void }
  ): Promise<boolean> => {
    try {
      const result = await customerService.deleteCustomer(params.id);
      if (result.success) {
        setCustomers(prev => prev.filter(c => c._id !== params.id));
        toast.success(result.message || "Customer deleted successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchCustomers();
        return true;
      } else {
        toast.error(result.error || "Failed to delete customer");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, [fetchCustomers]);

  // Update total purchases
  const updateTotalPurchases = useCallback(async (id: string, amount: number): Promise<boolean> => {
    try {
      const result = await customerService.updateTotalPurchases(id, amount);
      if (result.success) {
        await fetchCustomers();
        return true;
      } else {
        toast.error(result.error || "Failed to update total purchases");
        return false;
      }
    } catch (err) {
      console.error("Error updating total purchases:", err);
      return false;
    }
  }, [fetchCustomers]);

  // Get stats
  const getStats = useCallback(() => {
    const total = customers.length;
    const active = customers.filter(c => c.status === "active").length;
    const inactive = customers.filter(c => c.status === "inactive").length;
    return { total, active, inactive };
  }, [customers]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers,
    loading,
    error,
    pagination,
    fetchCustomers,
    searchCustomers,
    getCustomer,
    getCustomerByEmail,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    updateTotalPurchases,
    getStats,
  };
}