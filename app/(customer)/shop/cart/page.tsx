// app/(customer)/shop/cart/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProducts } from "@/app/hooks/useProducts";
import { useCustomerCart } from "@/app/hooks/useCart";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Minus, Plus, Trash2, ShoppingCart, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const { user } = useAuth();
  const { products, loading: productsLoading, fetchProducts } = useProducts();
  
  // ✅ Pass both userId AND userEmail
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const { items, totalItems, add, setQty, remove, clear, loading: cartLoading } = useCustomerCart(userId, userEmail);
  
  const router = useRouter();
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const lines = items
    .map((i) => ({
      ...i,
      product: products.find((p) => p._id === i.productId)!,
    }))
    .filter((l) => l.product);

  const subtotal = lines.reduce((s, l) => s + l.product.sellingPrice * l.qty, 0);
  const discount = couponApplied ? subtotal * 0.1 : 0;
  const shipping = subtotal > 200 || subtotal === 0 ? 0 : 12;
  const tax = (subtotal - discount) * 0.05;
  const total = subtotal - discount + shipping + tax;

  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() === "SAVE10") {
      setCouponApplied(true);
      toast.success("Coupon applied — 10% off");
    } else {
      toast.error("Invalid coupon code");
    }
  };

  const handleCheckout = () => {
    router.push("/shop/checkout");
  };

  const handleUpdateQty = async (productId: string, newQty: number) => {
    if (newQty <= 0) {
      await remove(productId);
    } else {
      await setQty(productId, newQty);
    }
  };

  const handleRemove = async (productId: string) => {
    await remove(productId);
  };

  if ((productsLoading || cartLoading) && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Your Cart ({totalItems} items)</h1>
      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse products and add some items."
          action={
            <Button render={<Link href="/shop" />}>Start shopping</Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="divide-y p-0">
              {lines.map((l) => {
                const imageUrl = l.product.image || 
                  (l.product.gallery && l.product.gallery.length > 0 ? l.product.gallery[0] : null);
                return (
                  <div key={l.productId} className="flex items-center gap-4 p-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {imageUrl ? (
                        <img
                          src={imageUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_FRONTEND_URL || ''}${imageUrl}` : imageUrl}
                          alt={l.product.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Package className="m-4 h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/shop/product/${l.product._id}`}
                        className="font-medium hover:underline"
                      >
                        {l.product.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        ${l.product.sellingPrice} each
                      </p>
                      {l.qty >= l.product.stock && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          Max stock
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 rounded-md border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleUpdateQty(l.productId, l.qty - 1)}
                        disabled={cartLoading}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm">{l.qty}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={l.qty >= l.product.stock || cartLoading}
                        onClick={() => handleUpdateQty(l.productId, l.qty + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="w-20 text-right font-semibold">
                      ${(l.product.sellingPrice * l.qty).toFixed(2)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(l.productId)}
                      disabled={cartLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-20">
            <CardContent className="space-y-3 p-6">
              <p className="font-semibold">Order Summary</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Coupon (try SAVE10)"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                />
                <Button variant="outline" onClick={applyCoupon}>
                  Apply
                </Button>
              </div>
              <div className="space-y-1 border-t pt-3 text-sm">
                <Row label="Subtotal" val={`$${subtotal.toFixed(2)}`} />
                {discount > 0 && (
                  <Row label="Coupon" val={`- $${discount.toFixed(2)}`} />
                )}
                <Row
                  label="Shipping"
                  val={shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}
                />
                <Row label="Tax" val={`$${tax.toFixed(2)}`} />
                <Row label="Total" val={`$${total.toFixed(2)}`} bold />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={lines.length === 0}
              >
                Proceed to Checkout
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, val, bold }: { label: string; val: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between ${
        bold ? "text-base font-semibold" : "text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span className={bold ? "text-foreground" : ""}>{val}</span>
    </div>
  );
}