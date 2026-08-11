// app/(customer)/shop/orders/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOrders } from "@/app/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusTimeline } from "@/components/status-timeline";
import { StatusBadge } from "@/components/status-badge";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function MyOrderDetail() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { orders, loading, fetchOrders } = useOrders();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch orders on mount
  useEffect(() => {
    if (user?.email) {
      fetchOrders({ customerEmail: user.email });
    }
  }, [user?.email, fetchOrders]);

  // Find the specific order
  useEffect(() => {
    if (orders.length > 0 && id) {
      const found = orders.find(
        (o) => (o._id === id || o.id === id) && o.customerEmail === user?.email
      );
      setOrder(found || null);
      setIsLoading(false);
    } else if (!loading) {
      setIsLoading(false);
    }
  }, [orders, id, user?.email, loading]);

  // Loading state
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Order not found.
          <div className="mt-4">
            <Button render={<Link href="/shop/orders" />}>Back to orders</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine status color
  const orderStatus = order.orderStatus || order.status || "pending";
  let statusColor: "default" | "success" | "warning" | "destructive" = "default";
  if (orderStatus === "delivered" || orderStatus === "paid") statusColor = "success";
  else if (orderStatus === "pending" || orderStatus === "processing") statusColor = "warning";
  else if (orderStatus === "cancelled" || orderStatus === "failed") statusColor = "destructive";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/shop/orders" />}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to orders
      </Button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Order {order.number}</h1>
        <StatusBadge status={orderStatus} />
        {order.paymentStatus && order.paymentStatus !== orderStatus && (
          <StatusBadge status={order.paymentStatus} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-6">
            <p className="font-semibold">Items</p>
            <div className="rounded-md border divide-y">
              {order.items?.map((i: any) => (
                <div key={i.productId} className="flex justify-between p-3 text-sm">
                  <span>
                    {i.name} × {i.qty}
                  </span>
                  <span className="font-medium">${(i.lineTotal || i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <Row label="Subtotal" val={`$${(order.subtotal || 0).toFixed(2)}`} />
              <Row label="Shipping" val={`$${(order.shipping || 0).toFixed(2)}`} />
              <Row label="Tax" val={`$${(order.tax || 0).toFixed(2)}`} />
              <Row label="Discount" val={`-$${(order.discount || 0).toFixed(2)}`} />
              <Row label="Total" val={`$${(order.grandTotal || 0).toFixed(2)}`} bold />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-6 text-sm">
              <p className="font-semibold">Shipping Information</p>
              {order.shippingAddress ? (
                <>
                  <p>{order.shippingAddress.name}</p>
                  <p className="text-muted-foreground">
                    {order.shippingAddress.address}, {order.shippingAddress.city}{' '}
                    {order.shippingAddress.zip}
                  </p>
                  <p className="text-muted-foreground">{order.shippingAddress.phone}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No shipping address provided</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="mb-4 text-sm font-semibold">Order Status</p>
              <StatusTimeline 
                current={orderStatus} 
                history={order.statusHistory || [
                  { status: "pending", date: order.createdAt, label: "Order placed" },
                  ...(orderStatus === "processing" ? [{ status: "processing", date: new Date().toISOString(), label: "Processing" }] : []),
                  ...(orderStatus === "shipped" ? [{ status: "processing", date: order.createdAt, label: "Processing" }, { status: "shipped", date: new Date().toISOString(), label: "Shipped" }] : []),
                  ...(orderStatus === "delivered" ? [{ status: "processing", date: order.createdAt, label: "Processing" }, { status: "shipped", date: new Date().toISOString(), label: "Shipped" }, { status: "delivered", date: new Date().toISOString(), label: "Delivered" }] : []),
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-6 text-sm">
              <p className="font-semibold">Payment Details</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize">{order.paymentMethod || "Not specified"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`capitalize ${order.paymentStatus === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                  {order.paymentStatus || "pending"}
                </span>
              </div>
              {order.notes && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-muted-foreground">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, val, bold }: { label: string; val: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between ${
        bold
          ? "text-base font-semibold border-t pt-2"
          : "text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span className={bold ? "text-foreground" : ""}>{val}</span>
    </div>
  );
}