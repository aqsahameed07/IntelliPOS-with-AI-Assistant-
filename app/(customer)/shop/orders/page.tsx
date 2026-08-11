// app/(customer)/shop/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOrders } from "@/app/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ShoppingBag, Loader2 } from "lucide-react";

export default function MyOrders() {
  const { user } = useAuth();
  const { orders, loading, fetchOrders } = useOrders();
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);

  // Fetch orders on mount
  useEffect(() => {
    if (user?.email) {
      fetchOrders({ customerEmail: user.email });
    }
  }, [user?.email, fetchOrders]);

  // Filter orders for the current user
  useEffect(() => {
    if (orders.length > 0 && user?.email) {
      const filtered = orders.filter((o) => o.customerEmail === user.email);
      setCustomerOrders(filtered);
    } else {
      setCustomerOrders([]);
    }
  }, [orders, user?.email]);

  // Loading state
  if (loading && customerOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Orders</h1>
      {customerOrders.length === 0 ? (
        <EmptyState 
          icon={ShoppingBag} 
          title="No orders yet" 
          description="Start shopping to place your first order."
          action={
            <Button render={<Link href="/shop" />}>Start shopping</Button>
          } 
        />
      ) : (
        <div className="space-y-3">
          {customerOrders.map((o) => {
            const status = o.orderStatus || o.status || "pending";
            const paymentStatus = o.paymentStatus || "pending";
            
            // Determine status color
            let statusColor: "default" | "success" | "warning" | "destructive" = "default";
            if (status === "delivered" || status === "paid") statusColor = "success";
            else if (status === "pending" || status === "processing") statusColor = "warning";
            else if (status === "cancelled" || status === "failed") statusColor = "destructive";
            
            return (
              <Card key={o._id || o.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-sm font-semibold">{o.number}</p>
                      <StatusBadge status={status} />
                      {paymentStatus && paymentStatus !== status && (
                        <StatusBadge status={paymentStatus} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString()} · {o.items?.length || 0} item{(o.items?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="font-semibold">${(o.grandTotal || 0).toFixed(2)}</p>
                  <Button variant="outline" size="sm" render={<Link href={`/shop/orders/${o._id || o.id}`} />}>
                    Details
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}