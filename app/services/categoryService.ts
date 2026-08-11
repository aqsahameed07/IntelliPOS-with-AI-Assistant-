// app/services/categoryService.ts
import { ICategory } from "@/app/models/Category";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export interface CategoryResponse {
  success: boolean;
  data?: ICategory | ICategory[];
  error?: string;
  message?: string;
}

// Helper function to get auth token from cookies or localStorage
const getAuthToken = (): string | null => {
  // Try to get from cookies (if using Next.js cookies)
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'session') {
        return value;
      }
    }
  }
  
  // Fallback to localStorage if using JWT in localStorage
  try {
    const session = localStorage.getItem('erp:session');
    if (session) {
      const user = JSON.parse(session);
      // If you store token in session
      return user?.token || null;
    }
  } catch {
    return null;
  }
  
  return null;
};

// Custom fetch wrapper with authentication
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers as HeadersInit | undefined),
  });
  
  // Add authorization header if token exists
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies
  });
  
  // Handle 401 Unauthorized
  if (response.status === 401) {
    // You might want to trigger a logout or token refresh here
    console.error('Authentication failed for:', url);
    
    // If you have a global auth context, you could trigger logout
    // const { logout } = useAuth(); // Can't use hooks here
    // Instead, dispatch an event that your auth provider listens to
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  
  return response;
};

export const categoryService = {
  // Get all categories (Public - no auth required)
  async getAll(params?: { 
    status?: string; 
    search?: string;
    includeDeleted?: boolean;
  }): Promise<CategoryResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.includeDeleted) queryParams.append('includeDeleted', 'true');
      
      const url = buildApiUrl(`/api/categories${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error fetching categories:', error);
      return {
        success: false,
        error: "Failed to fetch categories",
      };
    }
  },

  // Get single category by ID (Public)
  async getById(id: string, includeDeleted = false): Promise<CategoryResponse> {
    try {
      const query = includeDeleted ? "?includeDeleted=true" : "";
      const response = await fetch(buildApiUrl(`/api/categories/${id}${query}`));
      return await response.json();
    } catch (error) {
      console.error('Error fetching category:', error);
      return {
        success: false,
        error: "Failed to fetch category",
      };
    }
  },

  // Create new category (Admin/Employee only)
  async create(data: Partial<ICategory>): Promise<CategoryResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/categories"), {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Create category failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create category",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error creating category:', error);
      return {
        success: false,
        error: "Failed to create category",
      };
    }
  },

  // Update category (Admin/Employee only)
  async update(id: string, data: Partial<ICategory>): Promise<CategoryResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/categories/${id}`), {
        method: "PUT",
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Update category failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to update category",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error updating category:', error);
      return {
        success: false,
        error: "Failed to update category",
      };
    }
  },

  // Soft delete category (Admin only)
  async delete(id: string): Promise<CategoryResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/categories/${id}`), {
        method: "DELETE",
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Delete category failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to delete category",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting category:', error);
      return {
        success: false,
        error: "Failed to delete category",
      };
    }
  },

  // Bulk operations (optional)
  async bulkCreate(categories: Partial<ICategory>[]): Promise<CategoryResponse> {
    try {
      const response = await authFetch(buildApiUrl("/api/categories/bulk"), {
        method: "POST",
        body: JSON.stringify({ categories }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Bulk create failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to create categories",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error bulk creating categories:', error);
      return {
        success: false,
        error: "Failed to create categories",
      };
    }
  },

  // Restore soft-deleted category (Admin only)
  async restore(id: string): Promise<CategoryResponse> {
    try {
      const response = await authFetch(buildApiUrl(`/api/categories/${id}/restore`), {
        method: "PATCH",
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Restore category failed:', result);
        return {
          success: false,
          error: result.error || result.message || "Failed to restore category",
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error restoring category:', error);
      return {
        success: false,
        error: "Failed to restore category",
      };
    }
  },
};

// Optional: Add a listener for auth events in your app
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    // Redirect to login or show a toast
    console.log('Authentication expired. Please login again.');
    // You could dispatch a custom event that your app listens to
    // or use a toast notification here
  });
}