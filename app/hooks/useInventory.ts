// app/hooks/useInventory.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { inventoryService } from "@/app/services/inventoryService";
import { IInventoryMovement } from "@/app/models/InventoryMovement";
import { toast } from "sonner";

interface UseInventoryReturn {
  movements: IInventoryMovement[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    totalSKUs: number;
    stockValue: number;
    lowStock: number;
    outOfStock: number;
    totalMovements: number;
  };
  fetchMovements: (params?: {
    productId?: string;
    vendorId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  fetchStats: () => Promise<void>;
  addPurchase: (data: {
    productId: string;
    qty: number;
    vendorId: string;
    cost?: number;
    note?: string;
  }) => Promise<IInventoryMovement | null>;
  addAdjustment: (data: {
    productId: string;
    qty: number;
    note?: string;
  }) => Promise<IInventoryMovement | null>;
  deleteMovement: (id: string) => Promise<boolean>;
  getProductMovements: (productId: string, limit?: number) => Promise<IInventoryMovement[]>;
}

export function useInventory(): UseInventoryReturn {
  const [movements, setMovements] = useState<IInventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>();
  const [stats, setStats] = useState({
    totalSKUs: 0,
    stockValue: 0,
    lowStock: 0,
    outOfStock: 0,
    totalMovements: 0,
  });

  // Fetch all movements
  const fetchMovements = useCallback(async (params?: {
    productId?: string;
    vendorId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await inventoryService.getMovements(params);
      
      if (result.success && result.data) {
        setMovements(result.data as IInventoryMovement[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch inventory movements");
        toast.error(result.error || "Failed to fetch inventory movements");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch inventory stats
  const fetchStats = useCallback(async () => {
    try {
      const result = await inventoryService.getStats();
      
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        toast.error(result.error || "Failed to fetch inventory stats");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    }
  }, []);

  // Add purchase
  const addPurchase = useCallback(async (data: {
    productId: string;
    qty: number;
    vendorId: string;
    cost?: number;
    note?: string;
  }): Promise<IInventoryMovement | null> => {
    try {
      const result = await inventoryService.createPurchase(data);
      
      if (result.success && result.data) {
        const newMovement = result.data as IInventoryMovement;
        setMovements(prev => [newMovement, ...prev]);
        toast.success("Purchase recorded successfully");
        await fetchStats();
        return newMovement;
      } else {
        toast.error(result.error || "Failed to record purchase");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchStats]);

  // Add adjustment
  const addAdjustment = useCallback(async (data: {
    productId: string;
    qty: number;
    note?: string;
  }): Promise<IInventoryMovement | null> => {
    try {
      const result = await inventoryService.createAdjustment(data);
      
      if (result.success && result.data) {
        const newMovement = result.data as IInventoryMovement;
        setMovements(prev => [newMovement, ...prev]);
        toast.success("Adjustment recorded successfully");
        await fetchStats();
        return newMovement;
      } else {
        toast.error(result.error || "Failed to record adjustment");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchStats]);

  // Delete movement
  const deleteMovement = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await inventoryService.deleteMovement(id);
      
      if (result.success) {
        setMovements(prev => prev.filter(m => m._id !== id));
        toast.success("Movement deleted successfully");
        await fetchStats();
        return true;
      } else {
        toast.error(result.error || "Failed to delete movement");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, [fetchStats]);

  // Get product movements
  const getProductMovements = useCallback(async (productId: string, limit?: number): Promise<IInventoryMovement[]> => {
    try {
      const result = await inventoryService.getProductMovements(productId, limit);
      
      if (result.success && result.data) {
        return result.data as IInventoryMovement[];
      } else {
        toast.error(result.error || "Failed to fetch product movements");
        return [];
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return [];
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchMovements();
    fetchStats();
  }, [fetchMovements, fetchStats]);

  return {
    movements,
    loading,
    error,
    pagination,
    stats,
    fetchMovements,
    fetchStats,
    addPurchase,
    addAdjustment,
    deleteMovement,
    getProductMovements,
  };
}