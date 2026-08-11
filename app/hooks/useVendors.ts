// app/hooks/useVendors.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { vendorService } from "@/app/services/vendorService";
import { IVendor } from "@/app/models/Vendor";
import { toast } from "sonner";

interface UseVendorsReturn {
  vendors: IVendor[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchVendors: (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  searchVendors: (searchTerm: string) => IVendor[];
  getVendor: (id: string) => Promise<IVendor | null>;
  createVendor: (data: Partial<IVendor>, options?: { onSuccess?: () => void }) => Promise<IVendor | null>;
  updateVendor: (params: { id: string; data: Partial<IVendor> }, options?: { onSuccess?: () => void }) => Promise<IVendor | null>;
  deleteVendor: (params: { id: string }, options?: { onSuccess?: () => void }) => Promise<boolean>;
  getStats: () => any;
}

export function useVendors(): UseVendorsReturn {
  const [vendors, setVendors] = useState<IVendor[]>([]);
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

  // Fetch vendors
  const fetchVendors = useCallback(async (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await vendorService.getVendors(params);

      if (result.success && result.data) {
        setVendors(result.data as IVendor[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch vendors");
        toast.error(result.error || "Failed to fetch vendors");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search vendors locally
  const searchVendors = useCallback((searchTerm: string): IVendor[] => {
    if (!searchTerm.trim()) return vendors;
    const term = searchTerm.toLowerCase();
    return vendors.filter((v) =>
      v.name?.toLowerCase().includes(term) ||
      v.email?.toLowerCase().includes(term) ||
      v.contactName?.toLowerCase().includes(term) ||
      v.phone?.includes(term)
    );
  }, [vendors]);

  // Get single vendor
  const getVendor = useCallback(async (id: string): Promise<IVendor | null> => {
    try {
      const result = await vendorService.getVendor(id);
      if (result.success && result.data) {
        return result.data as IVendor;
      } else {
        toast.error(result.error || "Vendor not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Create vendor
  const createVendor = useCallback(async (
    data: Partial<IVendor>,
    options?: { onSuccess?: () => void }
  ): Promise<IVendor | null> => {
    try {
      const result = await vendorService.createVendor(data);
      if (result.success && result.data) {
        const newVendor = result.data as IVendor;
        setVendors(prev => [newVendor, ...prev]);
        toast.success(result.message || "Vendor created successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchVendors();
        return newVendor;
      } else {
        toast.error(result.error || "Failed to create vendor");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchVendors]);

  // Update vendor
  const updateVendor = useCallback(async (
    params: { id: string; data: Partial<IVendor> },
    options?: { onSuccess?: () => void }
  ): Promise<IVendor | null> => {
    try {
      const result = await vendorService.updateVendor(params.id, params.data);
      if (result.success && result.data) {
        const updatedVendor = result.data as IVendor;
        setVendors(prev =>
          prev.map(v => (v._id === params.id ? updatedVendor : v))
        );
        toast.success(result.message || "Vendor updated successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchVendors();
        return updatedVendor;
      } else {
        toast.error(result.error || "Failed to update vendor");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchVendors]);

  // Delete vendor
  const deleteVendor = useCallback(async (
    params: { id: string },
    options?: { onSuccess?: () => void }
  ): Promise<boolean> => {
    try {
      const result = await vendorService.deleteVendor(params.id);
      if (result.success) {
        setVendors(prev => prev.filter(v => v._id !== params.id));
        toast.success(result.message || "Vendor deleted successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchVendors();
        return true;
      } else {
        toast.error(result.error || "Failed to delete vendor");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, [fetchVendors]);

  // Get stats
  const getStats = useCallback(() => {
    const total = vendors.length;
    const active = vendors.filter(v => v.status === "active").length;
    const inactive = vendors.filter(v => v.status === "inactive").length;
    return { total, active, inactive };
  }, [vendors]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  return {
    vendors,
    loading,
    error,
    pagination,
    fetchVendors,
    searchVendors,
    getVendor,
    createVendor,
    updateVendor,
    deleteVendor,
    getStats,
  };
}