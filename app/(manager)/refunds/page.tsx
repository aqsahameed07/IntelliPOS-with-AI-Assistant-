// app/(manager)/refunds/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useRefunds } from "@/app/hooks/useRefunds";
import { useInvoices } from "@/app/hooks/useInvoices";
import { useProducts } from "@/app/hooks/useProducts";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Search, RotateCcw, Undo2, Eye, ArrowLeftRight, Loader2, X } from "lucide-react";
import { format } from "date-fns";

// Types
interface RefundLine {
  productId: string;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
  restock: boolean;
}

interface ExchangeLine {
  productId: string;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
}

interface RowState {
  qty: number;
  restock: boolean;
}

export default function RefundsPage() {
  const { user } = useAuth();
  const { invoices, loading: invoicesLoading, fetchInvoices } = useInvoices();
  const { refunds, loading: refundsLoading, createRefund, fetchRefunds } = useRefunds();
  const { products, fetchProducts } = useProducts();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isInvoiceSelectOpen, setIsInvoiceSelectOpen] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchRefunds();
    fetchProducts();
  }, []);

  const filtered = useMemo(
    () =>
      refunds.filter(
        (r) =>
          (typeFilter === "all" || r.type === typeFilter) &&
          (q === "" ||
            r.number?.toLowerCase().includes(q.toLowerCase()) ||
            r.invoiceNumber?.toLowerCase().includes(q.toLowerCase()) ||
            r.customerName?.toLowerCase().includes(q.toLowerCase())),
      ),
    [refunds, q, typeFilter],
  );

  // Refunded quantities per invoice/product
  const refundedMap = useMemo(() => {
    const map = new Map<string, number>();
    refunds.forEach((r) =>
      r.returnedItems?.forEach((li: any) => {
        const key = `${r.invoiceId}:${li.productId}`;
        map.set(key, (map.get(key) ?? 0) + li.qty);
      }),
    );
    return map;
  }, [refunds]);

  const eligibleInvoices = invoices.filter(
    (i) => i.paymentStatus !== "refunded" && i.status !== "cancelled" && i.status !== "deleted"
  );

  const totals = useMemo(() => {
    const count = refunds.length;
    const totalRefunded = refunds.reduce((s, r) => s + Math.max(0, r.netRefund || 0), 0);
    const totalExchanged = refunds.reduce((s, r) => s + (r.exchangeSubtotal || 0), 0);
    return { count, totalRefunded, totalExchanged };
  }, [refunds]);

  const handleInvoiceSelect = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsInvoiceSelectOpen(false);
    setIsRefundDialogOpen(true);
  };

  // Loading state
  if (refundsLoading && refunds.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds & Exchanges"
        description="Process full/partial refunds and exchanges against existing invoices."
        action={
          <>
            <Button onClick={() => setIsInvoiceSelectOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              New refund / exchange
            </Button>

            {/* Invoice Selection Dialog */}
            <Dialog open={isInvoiceSelectOpen} onOpenChange={setIsInvoiceSelectOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Select an invoice</DialogTitle>
                  <DialogDescription>
                    Choose an invoice to process a refund or exchange against.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                  {eligibleInvoices.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No invoices available for refund.
                    </p>
                  ) : (
                    eligibleInvoices.map((inv) => (
                      <button
                        key={inv._id}
                        onClick={() => handleInvoiceSelect(inv)}
                        className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-accent hover:border-primary transition-all"
                      >
                        <div>
                          <p className="font-mono font-semibold">{inv.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {inv.customerName} · {format(new Date(inv.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${inv.grandTotal?.toFixed(2) || '0.00'}</p>
                          {inv.paymentStatus === "partially_refunded" && (
                            <Badge variant="outline" className="text-xs">Partially refunded</Badge>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInvoiceSelectOpen(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatBox label="Refunds processed" value={totals.count.toString()} />
        <StatBox label="Total refunded" value={`$${totals.totalRefunded.toFixed(2)}`} />
        <StatBox label="Exchange value" value={`$${totals.totalExchanged.toFixed(2)}`} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search refund #, invoice #, or customer…"
                className="pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="full">Full refund</SelectItem>
                <SelectItem value="partial">Partial refund</SelectItem>
                <SelectItem value="exchange">Exchange</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Undo2}
              title="No refunds yet"
              description="Process a refund against any invoice to see it here."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Refund #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Items</th>
                    <th className="p-3">Net refund</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r._id} className="border-t">
                      <td className="p-3 font-mono text-xs">{r.number}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {format(new Date(r.createdAt), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="p-3 font-mono text-xs">{r.invoiceNumber}</td>
                      <td className="p-3">{r.customerName}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="capitalize">
                          {r.type}
                        </Badge>
                      </td>
                      <td className="p-3">{r.returnedItems?.reduce((s: number, i: any) => s + i.qty, 0) || 0}</td>
                      <td className="p-3 font-semibold">
                        {r.netRefund >= 0
                          ? `$${r.netRefund.toFixed(2)}`
                          : `-$${Math.abs(r.netRefund).toFixed(2)}`}
                      </td>
                      <td className="p-3 capitalize">{r.refundMethod?.replace(/_/g, " ") || "—"}</td>
                      <td className="p-3">
                        <Badge variant={r.status === "processed" ? "default" : "secondary"}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button size="icon" variant="ghost" onClick={() => setPreview(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      {selectedInvoice && (
        <RefundDialog
          invoice={selectedInvoice}
          onClose={() => {
            setIsRefundDialogOpen(false);
            setSelectedInvoice(null);
          }}
          open={isRefundDialogOpen}
          refundedMap={refundedMap}
          products={products}
          user={user}
          onCreateRefund={async (data) => {
            const result = await createRefund(data);
            if (result) {
              await fetchRefunds();
              await fetchInvoices();
              setIsRefundDialogOpen(false);
              setSelectedInvoice(null);
            }
            return result;
          }}
        />
      )}

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Refund {preview?.number}</DialogTitle>
          </DialogHeader>
          {preview && <RefundReceipt r={preview} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Refund Dialog Component
function RefundDialog({
  invoice,
  onClose,
  open,
  refundedMap,
  products,
  user,
  onCreateRefund,
}: {
  invoice: any;
  onClose: () => void;
  open: boolean;
  refundedMap: Map<string, number>;
  products: any[];
  user: any;
  onCreateRefund: (data: any) => Promise<any>;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    invoice.items?.forEach((i: any) => {
      init[i.productId] = { qty: 0, restock: true };
    });
    return init;
  });
  const [exchanges, setExchanges] = useState<ExchangeLine[]>([]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "bank" | "store_credit" | "exchange_only">("cash");
  const [settlement, setSettlement] = useState<"cash" | "card" | "bank">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxFor = (item: any) => item.qty - (refundedMap.get(`${invoice._id}:${item.productId}`) ?? 0);

  const setAllMax = () => {
    const next: Record<string, RowState> = {};
    invoice.items?.forEach((i: any) => {
      next[i.productId] = { qty: maxFor(i), restock: rows[i.productId]?.restock ?? true };
    });
    setRows(next);
  };

  // Calculations
  const invoiceSubtotal = invoice.subtotal || 1;
  const taxRate = invoice.tax / invoiceSubtotal;
  const returnedItems: RefundLine[] = invoice.items
    ?.filter((i: any) => (rows[i.productId]?.qty ?? 0) > 0)
    .map((i: any) => {
      const r = rows[i.productId];
      const lineTotal = i.price * r.qty;
      return {
        productId: i.productId,
        name: i.name,
        qty: r.qty,
        price: i.price,
        lineTotal,
        restock: r.restock,
      };
    }) || [];

  const refundSubtotal = returnedItems.reduce((s, l) => s + l.lineTotal, 0);
  const taxAdjustment = +(refundSubtotal * taxRate).toFixed(2);

  const exchangedItems: ExchangeLine[] = exchanges
    .filter((e) => e.qty > 0 && e.productId)
    .map((e) => {
      const p = products.find((x) => x._id === e.productId);
      const price = p?.sellingPrice ?? 0;
      return {
        productId: e.productId,
        name: p?.name ?? "Unknown",
        qty: e.qty,
        price,
        lineTotal: +(price * e.qty).toFixed(2),
      };
    });

  const exchangeSubtotal = exchangedItems.reduce((s, l) => s + l.lineTotal, 0);
  const exchangeTax = +exchangedItems
    .reduce((s, l) => {
      const p = products.find((x) => x._id === l.productId);
      return s + l.lineTotal * ((p?.tax ?? 0) / 100);
    }, 0)
    .toFixed(2);

  const returnCredit = +(refundSubtotal + taxAdjustment).toFixed(2);
  const exchangeTotal = +(exchangeSubtotal + exchangeTax).toFixed(2);
  const netRefund = +(returnCredit - exchangeTotal).toFixed(2);
  const amountDue = netRefund < 0 ? +Math.abs(netRefund).toFixed(2) : 0;

  const totalReturnedUnits = returnedItems.reduce((s, l) => s + l.qty, 0);
  const totalInvoiceUnits = invoice.items?.reduce((s: number, i: any) => s + i.qty, 0) || 0;
  const priorReturned = invoice.items?.reduce(
    (s: number, i: any) => s + (refundedMap.get(`${invoice._id}:${i.productId}`) ?? 0),
    0,
  ) || 0;

  const type: "full" | "partial" | "exchange" =
    exchangedItems.length > 0
      ? "exchange"
      : totalReturnedUnits + priorReturned >= totalInvoiceUnits
        ? "full"
        : "partial";

  const incompleteExchange = exchanges.some((e) => !e.productId || e.qty <= 0);
  const canSubmit = returnedItems.length > 0 && reason.trim().length > 0 && !incompleteExchange;

  const submit = async () => {
    if (!canSubmit || isSubmitting) return;
    
    setIsSubmitting(true);
    
    const refundData = {
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      employeeEmail: user?.email || invoice.employeeEmail,
      employeeName: user?.name || invoice.employeeName,
      type,
      reason,
      returnedItems,
      exchangedItems,
      refundSubtotal: +refundSubtotal.toFixed(2),
      exchangeSubtotal: +exchangeSubtotal.toFixed(2),
      taxAdjustment,
      exchangeTax,
      netRefund,
      amountDue,
      settlementMethod: amountDue > 0 ? settlement : undefined,
      refundMethod: type === "exchange" && netRefund <= 0 ? "exchange_only" : method,
      status: "processed",
      notes,
    };

    try {
      const result = await onCreateRefund(refundData);
      if (result) {
        toast.success(`Refund ${result.number} processed successfully`);
        onClose();
      }
    } catch (error) {
      toast.error("Failed to process refund");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Refund / Exchange — {invoice.number}{" "}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {invoice.customerName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Returned items</p>
            <Button type="button" size="sm" variant="outline" onClick={setAllMax}>
              Return all
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Price</th>
                  <th className="p-2 text-right">Sold</th>
                  <th className="p-2 text-right">Available</th>
                  <th className="p-2 text-right">Return qty</th>
                  <th className="p-2 text-center">Restock</th>
                  <th className="p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((i: any) => {
                  const max = maxFor(i);
                  const state = rows[i.productId] ?? { qty: 0, restock: true };
                  return (
                    <tr key={i.productId} className="border-t">
                      <td className="p-2">{i.name}</td>
                      <td className="p-2 text-right">${i.price.toFixed(2)}</td>
                      <td className="p-2 text-right">{i.qty}</td>
                      <td className="p-2 text-right">{max}</td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={max}
                          value={state.qty}
                          disabled={max === 0}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value || "0", 10);
                            const qty = Math.max(0, Math.min(max, isNaN(raw) ? 0 : raw));
                            setRows({ ...rows, [i.productId]: { ...state, qty } });
                          }}
                          className="ml-auto h-8 w-20 text-right"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Checkbox
                          checked={state.restock}
                          onCheckedChange={(v) =>
                            setRows({ ...rows, [i.productId]: { ...state, restock: !!v } })
                          }
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        ${(i.price * state.qty).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" /> Exchange items (optional)
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setExchanges([...exchanges, { productId: "", qty: 1 }])}
              >
                Add item
              </Button>
            </div>
            {exchanges.length > 0 && (
              <div className="space-y-2 rounded-md border p-3">
                {exchanges.map((ex, idx) => {
                  const p = products.find((x) => x._id === ex.productId);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={ex.productId}
                        onValueChange={(v) => {
                          const next = [...exchanges];
                          next[idx] = { ...next[idx], productId: v };
                          setExchanges(next);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Pick product…" />
                        </SelectTrigger>
                        <SelectContent>
                          {products
                            .filter((pr) => pr.status === "active" && pr.stock > 0)
                            .map((pr) => (
                              <SelectItem key={pr._id} value={pr._id}>
                                {pr.name} — ${pr.sellingPrice.toFixed(2)} · {pr.stock} in stock
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        max={p?.stock ?? 1}
                        value={ex.qty}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value || "1", 10);
                          const qty = Math.max(1, Math.min(p?.stock ?? 999, isNaN(raw) ? 1 : raw));
                          const next = [...exchanges];
                          next[idx] = { ...next[idx], qty };
                          setExchanges(next);
                        }}
                        className="h-9 w-20 text-right"
                      />
                      <span className="w-20 text-right text-sm font-medium">
                        ${((p?.sellingPrice ?? 0) * ex.qty).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExchanges(exchanges.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Defective / damaged">Defective / damaged</SelectItem>
                  <SelectItem value="Wrong item">Wrong item</SelectItem>
                  <SelectItem value="Not as described">Not as described</SelectItem>
                  <SelectItem value="Customer changed mind">Customer changed mind</SelectItem>
                  <SelectItem value="Size / fit issue">Size / fit issue</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Refund method</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as any)}
                disabled={netRefund <= 0}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card (reversal)</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="store_credit">Store credit</SelectItem>
                  <SelectItem value="exchange_only">Exchange only</SelectItem>
                </SelectContent>
              </Select>
              {netRefund <= 0 && (
                <p className="text-xs text-muted-foreground">
                  Nothing to pay back — the exchange covers the return credit.
                </p>
              )}
            </div>
          </div>

          {amountDue > 0 && (
            <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
              <p className="text-sm font-semibold">
                Customer pays the difference — ${amountDue.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                The returned goods are credited at ${returnCredit.toFixed(2)} and a new invoice is
                raised for the replacement items (${exchangeTotal.toFixed(2)}).
              </p>
              <div className="max-w-xs space-y-1">
                <Label>Collect via</Label>
                <Select value={settlement} onValueChange={(v) => setSettlement(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="ml-auto max-w-xs space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
            <Row label="Refund subtotal" val={`$${refundSubtotal.toFixed(2)}`} />
            <Row label="Tax refunded" val={`$${taxAdjustment.toFixed(2)}`} />
            <Row label="Return credit" val={`$${returnCredit.toFixed(2)}`} />
            <Row label="Exchange value" val={`-$${exchangeSubtotal.toFixed(2)}`} />
            {exchangeTax > 0 && <Row label="Exchange tax" val={`-$${exchangeTax.toFixed(2)}`} />}
            <div className="mt-1 flex justify-between border-t pt-1 text-base font-semibold">
              <span>{netRefund >= 0 ? "Net refund to customer" : "Customer pays"}</span>
              <span>${Math.abs(netRefund).toFixed(2)}</span>
            </div>
            <div className="pt-1">
              <Badge variant="outline" className="capitalize">
                {type} {type === "exchange" ? "" : "refund"}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || isSubmitting} onClick={submit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Process {type}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper Components
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{val}</span>
    </div>
  );
}

function RefundReceipt({ r }: { r: any }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex justify-between">
        <div>
          <p className="font-mono font-semibold">{r.number}</p>
          <p className="text-xs text-muted-foreground">
            Against {r.invoiceNumber} · {format(new Date(r.createdAt), "MMM d, yyyy HH:mm")}
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="capitalize">
            {r.type}
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {r.refundMethod?.replace(/_/g, " ") || "—"}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="font-semibold">Customer</p>
          <p>{r.customerName}</p>
        </div>
        <div>
          <p className="font-semibold">Processed by</p>
          <p>{r.employeeName}</p>
        </div>
      </div>
      <div>
        <p className="mb-1 font-semibold">Returned</p>
        <div className="rounded-md border">
          {r.returnedItems?.map((li: any) => (
            <div key={li.productId} className="flex justify-between border-b p-2 last:border-b-0">
              <span>
                {li.name} × {li.qty}
                {li.restock ? " · restocked" : " · not restocked"}
              </span>
              <span className="font-medium">${li.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      {r.exchangedItems?.length > 0 && (
        <div>
          <p className="mb-1 font-semibold">Exchanged for</p>
          <div className="rounded-md border">
            {r.exchangedItems.map((li: any) => (
              <div key={li.productId} className="flex justify-between border-b p-2 last:border-b-0">
                <span>
                  {li.name} × {li.qty}
                </span>
                <span className="font-medium">${li.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="ml-auto max-w-xs space-y-1">
        <Row label="Refund subtotal" val={`$${r.refundSubtotal?.toFixed(2) || '0.00'}`} />
        <Row label="Tax refunded" val={`$${r.taxAdjustment?.toFixed(2) || '0.00'}`} />
        <Row label="Exchange value" val={`-$${r.exchangeSubtotal?.toFixed(2) || '0.00'}`} />
        {!!r.exchangeTax && <Row label="Exchange tax" val={`-$${r.exchangeTax.toFixed(2)}`} />}
        <div className="mt-1 flex justify-between border-t pt-1 text-base font-semibold">
          <span>{r.netRefund >= 0 ? "Net refund" : "Customer paid"}</span>
          <span>${Math.abs(r.netRefund || 0).toFixed(2)}</span>
        </div>
        {!!r.amountDue && r.amountDue > 0 && (
          <p className="pt-1 text-right text-xs text-muted-foreground capitalize">
            Collected via {r.settlementMethod ?? "cash"}
            {r.exchangeInvoiceNumber ? ` · ${r.exchangeInvoiceNumber}` : ""}
          </p>
        )}
      </div>
      {r.reason && <p className="text-xs text-muted-foreground">Reason: {r.reason}</p>}
      {r.notes && <p className="text-xs text-muted-foreground">Notes: {r.notes}</p>}
    </div>
  );
}