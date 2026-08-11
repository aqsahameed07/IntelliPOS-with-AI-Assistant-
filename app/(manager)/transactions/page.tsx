// app/(manager)/transactions/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useInvoices } from "@/app/hooks/useInvoices";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  renderInvoiceHtml,
  printInvoice,
  downloadInvoice,
} from "@/lib/invoice-utils";
import type { IInvoice } from "@/app/models/Invoice";
import {
  Search,
  Printer,
  Download,
  Receipt,
  Eye,
  Undo2,
  Loader2,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function TransactionsPage() {
  const { 
    invoices, 
    loading, 
    fetchInvoices,
    updatePaymentStatus,
    cancelInvoice
  } = useInvoices();
  
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [preview, setPreview] = useState<IInvoice | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const stats = useMemo(() => {
    const active = invoices.filter((i) => i.status !== "cancelled");
    return {
      total: active.length,
      paid: active.filter((i) => i.paymentStatus === "paid").length,
      pending: active.filter((i) => i.paymentStatus === "pending").length,
      cancelled: invoices.filter((i) => i.status === "cancelled").length,
      revenue: active
        .filter((i) => i.paymentStatus === "paid")
        .reduce((sum, i) => sum + (i.grandTotal || 0), 0),
    };
  }, [invoices]);

  const filtered = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (status === "all" || i.paymentStatus === status) &&
          (q === "" ||
            i.number.toLowerCase().includes(q.toLowerCase()) ||
            i.customerName.toLowerCase().includes(q.toLowerCase()))
      ),
    [invoices, q, status]
  );

  const handleUpdatePaymentStatus = async (id: string, newStatus: string) => {
    setUpdating(id);
    try {
      const success = await updatePaymentStatus(id, newStatus);
      if (success) {
        toast.success(`Payment status updated to ${newStatus}`);
        await fetchInvoices();
      }
    } catch (error) {
      toast.error("Failed to update payment status");
    } finally {
      setUpdating(null);
    }
  };

  const handleCancelInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this invoice? This will restore stock.")) return;
    
    setUpdating(id);
    try {
      const success = await cancelInvoice(id, "Cancelled by user");
      if (success) {
        toast.success("Invoice cancelled successfully");
        await fetchInvoices();
      }
    } catch (error) {
      toast.error("Failed to cancel invoice");
    } finally {
      setUpdating(null);
    }
  };

  // Loading state
  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="All invoices generated from the POS."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={Receipt} />
        <StatCard label="Paid" value={stats.paid} icon={CheckCircle2} />
        <StatCard label="Pending" value={stats.pending} icon={Clock} />
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
                placeholder="Search invoice # or customer…"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Complete a sale in Billing to see it here."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Items</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i._id} className="border-t">
                      <td className="p-3 font-mono text-xs">{i.number}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(i.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">{i.customerName}</td>
                      <td className="p-3">{i.items?.length || 0}</td>
                      <td className="p-3 font-semibold">
                        ${i.grandTotal?.toFixed(2) || '0.00'}
                      </td>
                      <td className="p-3 capitalize">{i.paymentMethod}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              i.paymentStatus === "paid" 
                                ? "default" 
                                : i.paymentStatus === "pending" 
                                ? "secondary" 
                                : "destructive"
                            }
                          >
                            {i.paymentStatus}
                          </Badge>
                          {i.status === "cancelled" && (
                            <Badge variant="outline" className="text-red-500">
                              Cancelled
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPreview(i)}
                            title="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => printInvoice(i)}
                            title="Print Invoice"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => downloadInvoice(i)}
                            title="Download Invoice"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {i.status !== "cancelled" && (
                            <>
                              {i.paymentStatus === "pending" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleUpdatePaymentStatus(i._id, "paid")}
                                  disabled={updating === i._id}
                                  title="Mark as Paid"
                                >
                                  {updating === i._id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Receipt className="h-4 w-4 text-green-500" />
                                  )}
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleCancelInvoice(i._id)}
                                disabled={updating === i._id}
                                title="Cancel Invoice"
                              >
                                <Undo2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice {preview?.number}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div dangerouslySetInnerHTML={{ __html: renderInvoiceHtml(preview) }} />
              <div className="flex gap-2 border-t pt-3">
                <Button variant="outline" onClick={() => printInvoice(preview)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => downloadInvoice(preview)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}