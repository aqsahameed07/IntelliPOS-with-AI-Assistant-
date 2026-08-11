// app/hooks/useEmployees.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { employeeService } from "@/app/services/employeeService";
import { IEmployee } from "@/app/models/Employee";
import { toast } from "sonner";

interface UseEmployeesReturn {
  employees: IEmployee[];
  loading: boolean;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchEmployees: (params?: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  searchEmployees: (searchTerm: string) => IEmployee[];
  getEmployee: (id: string) => Promise<IEmployee | null>;
  createEmployee: (data: any, options?: { onSuccess?: () => void }) => Promise<IEmployee | null>;
  updateEmployee: (params: { id: string; data: any }, options?: { onSuccess?: () => void }) => Promise<IEmployee | null>;
  deleteEmployee: (params: { id: string }, options?: { onSuccess?: () => void }) => Promise<boolean>;
  getStats: () => any;
}

export function useEmployees(): UseEmployeesReturn {
  const [employees, setEmployees] = useState<IEmployee[]>([]);
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

  // Fetch employees
  const fetchEmployees = useCallback(async (params?: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await employeeService.getEmployees(params);

      if (result.success && result.data) {
        setEmployees(result.data as IEmployee[]);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        setError(result.error || "Failed to fetch employees");
        toast.error(result.error || "Failed to fetch employees");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search employees locally
  const searchEmployees = useCallback((searchTerm: string): IEmployee[] => {
    if (!searchTerm.trim()) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter((e) =>
      e.name?.toLowerCase().includes(term) ||
      e.email?.toLowerCase().includes(term) ||
      e.department?.toLowerCase().includes(term)
    );
  }, [employees]);

  // Get single employee
  const getEmployee = useCallback(async (id: string): Promise<IEmployee | null> => {
    try {
      const result = await employeeService.getEmployee(id);
      if (result.success && result.data) {
        return result.data as IEmployee;
      } else {
        toast.error(result.error || "Employee not found");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, []);

  // Create employee
  const createEmployee = useCallback(async (
    data: any,
    options?: { onSuccess?: () => void }
  ): Promise<IEmployee | null> => {
    try {
      const result = await employeeService.createEmployee(data);
      if (result.success && result.data) {
        const newEmployee = result.data as IEmployee;
        setEmployees(prev => [newEmployee, ...prev]);
        toast.success(result.message || "Employee created successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchEmployees();
        return newEmployee;
      } else {
        toast.error(result.error || "Failed to create employee");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchEmployees]);

  // Update employee
  const updateEmployee = useCallback(async (
    params: { id: string; data: any },
    options?: { onSuccess?: () => void }
  ): Promise<IEmployee | null> => {
    try {
      const result = await employeeService.updateEmployee(params.id, params.data);
      if (result.success && result.data) {
        const updatedEmployee = result.data as IEmployee;
        setEmployees(prev =>
          prev.map(e => (e._id === params.id ? updatedEmployee : e))
        );
        toast.success(result.message || "Employee updated successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchEmployees();
        return updatedEmployee;
      } else {
        toast.error(result.error || "Failed to update employee");
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return null;
    }
  }, [fetchEmployees]);

  // Delete employee
  const deleteEmployee = useCallback(async (
    params: { id: string },
    options?: { onSuccess?: () => void }
  ): Promise<boolean> => {
    try {
      const result = await employeeService.deleteEmployee(params.id);
      if (result.success) {
        setEmployees(prev => prev.filter(e => e._id !== params.id));
        toast.success(result.message || "Employee deleted successfully");
        if (options?.onSuccess) options.onSuccess();
        await fetchEmployees();
        return true;
      } else {
        toast.error(result.error || "Failed to delete employee");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
      return false;
    }
  }, [fetchEmployees]);

  // Get stats
  const getStats = useCallback(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === "active").length;
    const inactive = employees.filter(e => e.status === "inactive").length;
    return { total, active, inactive };
  }, [employees]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    loading,
    error,
    pagination,
    fetchEmployees,
    searchEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getStats,
  };
}