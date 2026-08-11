// app/(manager)/orders/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useOrders } from "@/app/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, ORDER_STATUSES } from "@/components/status-badge";
import { StatusTimeline } from "@/components/status-timeline";
import { ArrowLeft, Printer, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type OrderStatus = "pending" | "confirmed" | "processing" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "returned" | "refunded";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const { orders, loading, fetchOrders, updateOrderStatus, cancelOrder } = useOrders();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch orders on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Find the specific order
  useEffect(() => {
    if (orders.length > 0 && id) {
      const found = orders.find((o) => o._id === id || o.id === id);
      setOrder(found || null);
      setIsLoading(false);
    } else if (!loading) {
      setIsLoading(false);
    }
  }, [orders, id, loading]);

  // Handle loading state
  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/orders" passHref>
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Order not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const orderStatus = order.orderStatus || order.status || "pending";
  const isCancellable = !["cancelled", "returned", "refunded", "delivered"].includes(orderStatus);
  const isUpdatable = !["cancelled", "returned", "refunded", "delivered"].includes(orderStatus);

  const handleCancel = async () => {
    if (!isCancellable) {
      toast.error("Order can't be cancelled");
      return;
    }

    setIsUpdating(true);
    try {
      const success = await cancelOrder(order._id || order.id, "Cancelled by admin");
      if (success) {
        toast.success("Order cancelled and stock restored");
        // Refresh order data
        await fetchOrders();
        // Update local order state
        setOrder({ ...order, orderStatus: "cancelled", status: "cancelled" });
      }
    } catch (error) {
      toast.error("Failed to cancel order");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!isUpdatable) {
      toast.error("This order cannot be updated");
      return;
    }

    setIsUpdating(true);
    try {
      const success = await updateOrderStatus(order._id || order.id, newStatus);
      if (success) {
        toast.success(`Status updated to ${newStatus}`);
        // Refresh order data
        await fetchOrders();
        // Update local order state
        setOrder({ ...order, orderStatus: newStatus, status: newStatus });
      }
    } catch (error) {
      toast.error("Failed to update order status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <PageHeader
        title={`Order ${order.number || "N/A"}`}
        description={`Placed ${order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A"}`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Select 
              value={orderStatus} 
              onValueChange={(v) => handleStatusChange(v as OrderStatus)}
              disabled={!isUpdatable || isUpdating}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={!isCancellable || isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Cancel
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Items</p>
              <StatusBadge status={orderStatus} />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((i: any) => (
                    <tr key={i.productId} className="border-t">
                      <td className="p-3">{i.name}</td>
                      <td className="p-3">{i.qty}</td>
                      <td className="p-3">${i.price}</td>
                      <td className="p-3 font-medium">${(i.lineTotal || i.price * i.qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto space-y-1 text-sm max-w-xs">
              <Row label="Subtotal" val={`$${(order.subtotal || 0).toFixed(2)}`} />
              <Row label="Tax" val={`$${(order.tax || 0).toFixed(2)}`} />
              <Row label="Shipping" val={`$${(order.shipping || 0).toFixed(2)}`} />
              <Row label="Discount" val={`- $${(order.discount || 0).toFixed(2)}`} />
              <Row label="Grand total" val={`$${(order.grandTotal || 0).toFixed(2)}`} bold />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm font-semibold">Customer</p>
              <div className="text-sm">
                <p className="font-medium">{order.customerName || "Unknown"}</p>
                <p className="text-muted-foreground">{order.customerEmail || "No email"}</p>
                {order.customerPhone && (
                  <p className="text-muted-foreground">{order.customerPhone}</p>
                )}
              </div>
              {order.shippingAddress && (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Shipping address</p>
                  <p className="text-muted-foreground">{order.shippingAddress.address}</p>
                  <p className="text-muted-foreground">
                    {order.shippingAddress.city} · {order.shippingAddress.zip}
                  </p>
                  <p className="text-muted-foreground">{order.shippingAddress.phone}</p>
                </div>
              )}
              <div className="border-t pt-2 text-sm">
                <p className="font-medium">Payment</p>
                <p className="capitalize text-muted-foreground">
                  {order.paymentMethod || "Not specified"} · {order.paymentStatus || "pending"}
                </p>
              </div>
              {order.notes && (
                <div className="border-t pt-2 text-sm">
                  <p className="font-medium">Notes</p>
                  <p className="text-muted-foreground">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="mb-4 text-sm font-semibold">Timeline</p>
              <StatusTimeline 
                current={orderStatus} 
                history={order.statusHistory || [
                  { status: "pending", date: order.createdAt, label: "Order placed" },
                  ...(orderStatus === "confirmed" ? [{ status: "confirmed", date: new Date().toISOString(), label: "Confirmed" }] : []),
                  ...(orderStatus === "processing" ? [{ status: "confirmed", date: order.createdAt, label: "Confirmed" }, { status: "processing", date: new Date().toISOString(), label: "Processing" }] : []),
                  ...(orderStatus === "shipped" ? [{ status: "confirmed", date: order.createdAt, label: "Confirmed" }, { status: "processing", date: new Date().toISOString(), label: "Processing" }, { status: "shipped", date: new Date().toISOString(), label: "Shipped" }] : []),
                  ...(orderStatus === "delivered" ? [{ status: "confirmed", date: order.createdAt, label: "Confirmed" }, { status: "processing", date: new Date().toISOString(), label: "Processing" }, { status: "shipped", date: new Date().toISOString(), label: "Shipped" }, { status: "delivered", date: new Date().toISOString(), label: "Delivered" }] : []),
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, val, bold }: { label: string; val: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold border-t pt-2" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={bold ? "text-foreground" : ""}>{val}</span>
    </div>
  );
}