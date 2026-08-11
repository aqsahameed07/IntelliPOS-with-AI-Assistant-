// app/(manager)/orders/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useOrders } from "@/app/hooks/useOrders";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, ORDER_STATUSES } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Search, ShoppingBag, Clock, Package, CheckCircle2, XCircle, DollarSign, Loader2 } from "lucide-react";

export default function OrdersPage() {
  const { orders, loading, fetchOrders } = useOrders();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  // Fetch orders on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Stats calculation
  const stats = useMemo(() => {
    const orderStatuses = orders.map(o => o.orderStatus || o.status || "pending");
    
    return {
      total: orders.length,
      pending: orders.filter((o) => (o.orderStatus || o.status) === "pending").length,
      processing: orders.filter((o) => {
        const s = o.orderStatus || o.status;
        return ["confirmed", "processing", "packed", "shipped", "out_for_delivery"].includes(s);
      }).length,
      delivered: orders.filter((o) => (o.orderStatus || o.status) === "delivered").length,
      cancelled: orders.filter((o) => {
        const s = o.orderStatus || o.status;
        return ["cancelled", "returned", "refunded"].includes(s);
      }).length,
      revenue: orders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((s, o) => s + (o.grandTotal || 0), 0),
    };
  }, [orders]);

  // Filter orders
  const filtered = useMemo(() => {
    const orderStatus = (o: any) => o.orderStatus || o.status || "pending";
    
    return orders.filter((o) => {
      const matchesStatus = status === "all" || orderStatus(o) === status;
      const matchesSearch = q === "" || 
        o.number?.toLowerCase().includes(q.toLowerCase()) || 
        o.customerName?.toLowerCase().includes(q.toLowerCase()) || 
        o.customerEmail?.toLowerCase().includes(q.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [orders, q, status]);

  // Loading state
  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Orders" 
        description="Manage customer orders and fulfillment." 
      />
      
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Total" value={stats.total} icon={ShoppingBag} />
        <StatCard label="Pending" value={stats.pending} icon={Clock} />
        <StatCard label="In transit" value={stats.processing} icon={Package} />
        <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} />
        <StatCard label="Cancelled" value={stats.cancelled} icon={XCircle} />
        <StatCard label="Revenue" value={`$${stats.revenue.toLocaleString()}`} icon={DollarSign} />
      </div>
      
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                placeholder="Search order # or customer…" 
                className="pl-8" 
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState 
              icon={ShoppingBag} 
              title="No orders yet" 
              description="Orders placed by customers appear here." 
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Order</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Items</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const orderStatus = o.orderStatus || o.status || "pending";
                    const customerName = o.customerName || "Unknown";
                    const customerEmail = o.customerEmail || "No email";
                    const itemCount = o.items?.length || 0;
                    const grandTotal = o.grandTotal || 0;
                    
                    return (
                      <tr key={o._id || o.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{o.number || "N/A"}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{customerName}</p>
                          <p className="text-xs text-muted-foreground">{customerEmail}</p>
                        </td>
                        <td className="p-3">{itemCount}</td>
                        <td className="p-3 font-semibold">${grandTotal.toFixed(2)}</td>
                        <td className="p-3">
                          <StatusBadge status={orderStatus} />
                        </td>
                        <td className="p-3 text-right">
                          <Link href={`/orders/${o._id || o.id}`} passHref>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}