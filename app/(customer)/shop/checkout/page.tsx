// app/(customer)/shop/checkout/page.tsx
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { products, loading: productsLoading, fetchProducts } = useProducts();
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const { items, totalItems, clear, fetchCart, loading: cartLoading } = useCustomerCart(userId, userEmail);
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ship, setShip] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    city: "",
    zip: "",
  });
  const [payment, setPayment] = useState<"cash" | "card" | "bank">("card");
  const [placedOrder, setPlacedOrder] = useState<{ number: string; id: string } | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
    fetchCart();
  }, [fetchProducts, fetchCart]);

  const lines = items
    .map((i) => ({
      ...i,
      product: products.find((p) => p._id === i.productId)!,
    }))
    .filter((l) => l.product);

  const subtotal = lines.reduce((s, l) => s + l.product.sellingPrice * l.qty, 0);
  const shipping = subtotal > 200 || subtotal === 0 ? 0 : 12;
  const tax = subtotal * 0.05;
  const total = subtotal + shipping + tax;

  // Loading state
  if ((productsLoading || cartLoading) && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (lines.length === 0 && !placedOrder) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Your cart is empty.{' '}
          <Link href="/shop" className="text-primary hover:underline">
            Continue shopping
          </Link>
        </CardContent>
      </Card>
    );
  }

  const nextFromShip = () => {
    if (!ship.name || !ship.phone || !ship.address || !ship.city) {
      toast.error("Please complete all shipping fields");
      return;
    }
    setStep(2);
  };

  const placeOrder = async () => {
    // Check stock
    for (const l of lines) {
      if (l.qty > l.product.stock) {
        toast.error(`Not enough stock for ${l.product.name}`);
        return;
      }
    }

    setIsPlacingOrder(true);

    try {
      // Prepare order items
      const orderItems = lines.map((l) => {
        const gross = l.product.sellingPrice * l.qty;
        const taxAmt = gross * 0.05;
        return {
          productId: l.product._id,
          name: l.product.name,
          qty: l.qty,
          price: l.product.sellingPrice,
          discount: 0,
          tax: 5,
          lineTotal: Math.round((gross + taxAmt) * 100) / 100,
        };
      });

      // Create order via API
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerEmail: userEmail,
          customerName: user?.name || ship.name,
          customerPhone: ship.phone,
          customerAddress: `${ship.address}, ${ship.city} ${ship.zip}`,
          items: orderItems,
          subtotal: Math.round(subtotal * 100) / 100,
          tax: Math.round(tax * 100) / 100,
          shipping: shipping,
          discount: 0,
          grandTotal: Math.round(total * 100) / 100,
          paymentMethod: payment,
          paymentStatus: payment === "cash" ? "pending" : "paid",
          shippingAddress: ship,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Failed to place order");
      }

      // ✅ Clear cart from database after successful order
      const clearResult = await clear();
     

      // ✅ Also clear any local storage cart
      if (typeof window !== "undefined") {
        localStorage.removeItem("customer_cart");
        window.dispatchEvent(new Event("cartUpdated"));
      }

      setPlacedOrder({ 
        number: orderData.data.number, 
        id: orderData.data._id 
      });
      setStep(3);
      toast.success("Order placed successfully! Cart cleared.");
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to place order");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Success state
  if (placedOrder) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Order placed!</h2>
            <p className="mt-1 text-muted-foreground">
              Your order <span className="font-mono">{placedOrder.number}</span>{' '}
              has been received.
            </p>
          </div>
          <div className="flex gap-2">
            <Button render={<Link href={`/shop/orders/${placedOrder.id}`} />}>
              View order
            </Button>
            <Button variant="outline" onClick={() => router.push("/shop")}>
              Continue shopping
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Checkout ({totalItems} items)</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        <StepPill n={1} label="Shipping" active={step >= 1} />
        <div className="h-px flex-1 bg-border" />
        <StepPill n={2} label="Review" active={step >= 2} />
        <div className="h-px flex-1 bg-border" />
        <StepPill n={3} label="Done" active={step === 3} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="p-6">
            {/* Step 1: Shipping */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="font-semibold">Shipping Information</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Full name" className="sm:col-span-2">
                    <Input
                      value={ship.name}
                      onChange={(e) => setShip({ ...ship, name: e.target.value })}
                      placeholder="Enter your full name"
                    />
                  </FormField>
                  <FormField label="Phone">
                    <Input
                      value={ship.phone}
                      onChange={(e) => setShip({ ...ship, phone: e.target.value })}
                      placeholder="Enter phone number"
                      type="tel"
                    />
                  </FormField>
                  <FormField label="ZIP Code">
                    <Input
                      value={ship.zip}
                      onChange={(e) => setShip({ ...ship, zip: e.target.value })}
                      placeholder="Enter ZIP code"
                    />
                  </FormField>
                  <FormField label="Address" className="sm:col-span-2">
                    <Input
                      value={ship.address}
                      onChange={(e) => setShip({ ...ship, address: e.target.value })}
                      placeholder="Enter street address"
                    />
                  </FormField>
                  <FormField label="City" className="sm:col-span-2">
                    <Input
                      value={ship.city}
                      onChange={(e) => setShip({ ...ship, city: e.target.value })}
                      placeholder="Enter city"
                    />
                  </FormField>
                </div>

                <FormField label="Payment Method">
                  <Select
                    value={payment}
                    onValueChange={(v) => setPayment(v as "cash" | "card" | "bank")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">Credit / Debit Card</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash on Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="flex justify-end pt-2">
                  <Button onClick={nextFromShip}>Review Order</Button>
                </div>
              </div>
            )}

            {/* Step 2: Review */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="font-semibold">Review Your Order</p>

                <div className="space-y-2 rounded-md border p-3 text-sm">
                  <p className="font-medium">{ship.name}</p>
                  <p className="text-muted-foreground">
                    {ship.address}, {ship.city} {ship.zip}
                  </p>
                  <p className="text-muted-foreground">
                    {ship.phone} · {payment}
                  </p>
                </div>

                <div className="rounded-md border divide-y">
                  {lines.map((l) => (
                    <div
                      key={l.productId}
                      className="flex justify-between p-3 text-sm"
                    >
                      <span>
                        {l.product.name} × {l.qty}
                      </span>
                      <span>${(l.product.sellingPrice * l.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={placeOrder} disabled={isPlacingOrder}>
                    {isPlacingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Place Order
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary Sidebar */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-2 p-6 text-sm">
            <p className="font-semibold">Order Summary</p>
            <Row label="Subtotal" val={`$${subtotal.toFixed(2)}`} />
            <Row
              label="Shipping"
              val={shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}
            />
            <Row label="Tax" val={`$${tax.toFixed(2)}`} />
            <div className="border-t pt-2">
              <Row label="Total" val={`$${total.toFixed(2)}`} bold />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper Components
function StepPill({
  n,
  label,
  active,
}: {
  n: number;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground"
      }`}
    >
      <span className="text-xs font-semibold">{n}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({
  label,
  val,
  bold,
}: {
  label: string;
  val: string;
  bold?: boolean;
}) {
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