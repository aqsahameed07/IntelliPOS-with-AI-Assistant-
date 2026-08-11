// app/(customer)/shop/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useProducts } from "@/app/hooks/useProducts";
import { useCustomerCart } from "@/app/hooks/useCart";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Package, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ShopPage() {
  const { products, loading, fetchProducts } = useProducts();
  const { user } = useAuth();
  
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  
  const { add, totalItems } = useCustomerCart(userId, userEmail);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = useMemo(() => {
    const cats = products
      .filter((p) => p.status === "active")
      .map((p) => p.category);
    return Array.from(new Set(cats));
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.status === "active" &&
        !p.isDeleted &&
        (category === "all" || p.category === category) &&
        (q === "" || p.name.toLowerCase().includes(q.toLowerCase()))
    );

    switch (sort) {
      case "price_low":
        list = [...list].sort((a, b) => a.sellingPrice - b.sellingPrice);
        break;
      case "price_high":
        list = [...list].sort((a, b) => b.sellingPrice - a.sellingPrice);
        break;
      case "newest":
        list = [...list].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      // Remove "popular" case if sales doesn't exist on product
      // case "popular":
      //   list = [...list].sort((a, b) => (b.sales || 0) - (a.sales || 0));
      //   break;
      case "name_asc":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        list = [...list].sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }
    return list;
  }, [products, q, category, sort]);

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-8 text-primary-foreground">
        <h1 className="text-3xl font-semibold">
          Welcome back, {user?.name?.split(" ")[0] || "Guest"}
        </h1>
        <p className="mt-2 max-w-xl text-primary-foreground/80">
          Discover premium office essentials with free delivery on orders over $200.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products by name..."
            className="pl-8"
          />
        </div>
        
        {/* Category Select - Fixed onValueChange */}
        <Select 
          value={category} 
          onValueChange={(value) => setCategory(value || "all")}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Sort Select - Fixed onValueChange and removed "popular" option */}
        <Select 
          value={sort} 
          onValueChange={(value) => setSort(value || "newest")}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest Arrivals</SelectItem>
            {/* Remove "popular" option if sales doesn't exist */}
            {/* <SelectItem value="popular">Most Popular</SelectItem> */}
            <SelectItem value="price_low">Price: Low to High</SelectItem>
            <SelectItem value="price_high">Price: High to Low</SelectItem>
            <SelectItem value="name_asc">Name: A to Z</SelectItem>
            <SelectItem value="name_desc">Name: Z to A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{filtered.length}</span> products
        {category !== "all" && ` in "${category}"`}
        {q && ` matching "${q}"`}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p) => {
          const imageUrl = p.image || (p.gallery && p.gallery.length > 0 ? p.gallery[0] : null);
          return (
            <Card
              key={p._id}
              className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Link href={`/shop/product/${p._id}`} className="block">
                <div className="aspect-square overflow-hidden bg-muted">
                  {imageUrl ? (
                    <img
                      src={imageUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_FRONTEND_URL || ''}${imageUrl}` : imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>
              </Link>
              <CardContent className="space-y-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.brand || p.category}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">${p.sellingPrice}</span>
                  {p.stock === 0 ? (
                    <Badge variant="destructive">Out of Stock</Badge>
                  ) : p.stock <= 5 ? (
                    <Badge variant="secondary">Only {p.stock} left</Badge>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={p.stock === 0}
                  onClick={async () => {
                    const success = await add(p._id, 1);
                    if (success) {
                      toast.success(`${p.name} added to cart`);
                    }
                  }}
                >
                  <ShoppingCart className="mr-2 h-3.5 w-3.5" />
                  {p.stock === 0 ? "Unavailable" : "Add to Cart"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No products found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}