// app/services/cartService.ts
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL?.replace(/\/$/, "") || "";

const buildApiUrl = (path: string) => {
  if (!FRONTEND_URL) return path;
  return `${FRONTEND_URL}${path}`;
};

export const cartService = {
  async getCart(userId: string) {
    try {
      console.log("Fetching cart for userId:", userId);
      const response = await fetch(buildApiUrl(`/api/cart?userId=${userId}`), {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error("Cart API error:", text);
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Cart data:", data);
      return data;
    } catch (error) {
      console.error("Error fetching cart:", error);
      return {
        success: false,
        error: "Failed to fetch cart",
      };
    }
  },

  async addToCart(userId: string, productId: string, qty: number = 1, userEmail?: string) {
    try {
      const payload = { 
        userId, 
        productId, 
        qty,
        userEmail: userEmail || "" 
      };
      console.log("📤 Sending to API:", payload);
      
      const response = await fetch(buildApiUrl("/api/cart"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error("Cart API error:", text);
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Add to cart response:", data);
      return data;
    } catch (error) {
      console.error("Error adding to cart:", error);
      return {
        success: false,
        error: "Failed to add to cart",
      };
    }
  },

  async updateQty(userId: string, productId: string, qty: number) {
    try {
      const response = await fetch(buildApiUrl("/api/cart"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ userId, productId, qty }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error updating cart:", error);
      return {
        success: false,
        error: "Failed to update cart",
      };
    }
  },

  async removeFromCart(userId: string, productId: string) {
    try {
      const response = await fetch(buildApiUrl("/api/cart"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ userId, productId }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error removing from cart:", error);
      return {
        success: false,
        error: "Failed to remove from cart",
      };
    }
  },

  async clearCart(userId: string) {
    try {
      const response = await fetch(buildApiUrl("/api/cart/clear"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error clearing cart:", error);
      return {
        success: false,
        error: "Failed to clear cart",
      };
    }
  },
};