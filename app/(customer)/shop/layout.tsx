// app/(customer)/shop/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCustomerCart } from "@/app/hooks/useCart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Boxes, ShoppingCart, User, LogOut, Package } from "lucide-react";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Get cart data from database
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const { totalItems, fetchCart } = useCustomerCart(userId, userEmail);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.role !== "Customer") {
      router.replace("/dashboard");
    }
  }, [ready, user, router]);

  // Fetch cart when user changes
  useEffect(() => {
    if (userId) {
      fetchCart();
    }
  }, [userId, fetchCart]);

  // Listen for cart updates
  useEffect(() => {
    const handleCartUpdate = () => {
      if (userId) {
        fetchCart();
      }
    };
    window.addEventListener('cartUpdated', handleCartUpdate);
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [userId, fetchCart]);

  if (!ready || !user || user.role !== "Customer") {
    return null;
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = (path: string) => {
    if (path === "/shop" && pathname === "/shop") return true;
    if (path !== "/shop" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/shop" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="font-semibold">Nimbus Shop</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            <Link
              href="/shop"
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                isActive("/shop") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Shop
            </Link>
            <Link
              href="/shop/orders"
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                isActive("/shop/orders") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              My orders
            </Link>
            <Link
              href="/shop/profile"
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                isActive("/shop/profile") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Profile
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/shop/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Cart</span>
                {totalItems > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center px-1.5 text-xs">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger >
                <div className="cursor-pointer">
                  <Button variant="ghost" className="h-9 gap-2 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </div>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem >
                    <Link href="/shop/profile">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem >
                    <Link href="/shop/orders">
                      <Package className="mr-2 h-4 w-4" />
                      My orders
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      router.replace("/login");
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}