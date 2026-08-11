// app/(manager)/billing/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useProducts } from "@/app/hooks/useProducts";
import { useInvoices } from "@/app/hooks/useInvoices";
import type { IInvoiceItem } from "@/app/models/Invoice";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, Receipt, Printer, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { renderInvoiceHtml, printInvoice, downloadInvoice } from "@/lib/invoice-utils";

type Line = { productId: string; qty: number };

export default function BillingPage() {
  const { products, loading: productsLoading, fetchProducts } = useProducts();
  const { createInvoice } = useInvoices();
  const { user } = useAuth();

  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bank" | "pending">("cash");
  const [orderDiscount, setOrderDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [invoicePreview, setInvoicePreview] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const results = useMemo(() => {
    if (!q) return products.slice(0, 12);
    return products.filter((p) => 
      p.name.toLowerCase().includes(q.toLowerCase()) || 
      p.sku.toLowerCase().includes(q.toLowerCase()) || 
      (p.barcode ?? "").includes(q)
    ).slice(0, 20);
  }, [products, q]);

  const addLine = (p: any) => {
    if (p.stock <= 0) { 
      toast.error("Out of stock"); 
      return; 
    }
    const existing = lines.find((l) => l.productId === p._id);
    if (existing) {
      if (existing.qty >= p.stock) { 
        toast.error("No more stock available"); 
        return; 
      }
      setLines(lines.map((l) => (l.productId === p._id ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setLines([...lines, { productId: p._id, qty: 1 }]);
    }
  };

  const setQty = (id: string, qty: number) => {
    const p = products.find((x) => x._id === id);
    if (!p) return;
    if (qty <= 0) {
      setLines(lines.filter((l) => l.productId !== id));
      return;
    }
    if (qty > p.stock) { 
      toast.error(`Only ${p.stock} in stock`); 
      return; 
    }
    setLines(lines.map((l) => (l.productId === id ? { ...l, qty } : l)));
  };

  const items: IInvoiceItem[] = lines.map((l) => {
    const p = products.find((x) => x._id === l.productId)!;
    const gross = p.sellingPrice * l.qty;
    const discountAmt = (gross * (p.discount ?? 0)) / 100;
    const afterDisc = gross - discountAmt;
    const taxAmt = (afterDisc * (p.tax ?? 0)) / 100;
    return {
      productId: p._id, 
      name: p.name, 
      qty: l.qty, 
      price: p.sellingPrice,
      discount: p.discount ?? 0, 
      tax: p.tax ?? 0,
      lineTotal: Math.round((afterDisc + taxAmt) * 100) / 100,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const lineDisc = items.reduce((s, i) => s + (i.price * i.qty * i.discount) / 100, 0);
  const orderDiscAmt = (subtotal - lineDisc) * (Number(orderDiscount) || 0) / 100;
  const taxable = subtotal - lineDisc - orderDiscAmt;
  const tax = items.reduce((s, i) => s + ((i.price * i.qty - (i.price * i.qty * i.discount) / 100) * i.tax) / 100, 0);
  const grand = Math.max(0, Math.round((taxable + tax) * 100) / 100);

  const complete = async () => {
    if (items.length === 0) { 
      toast.error("Add at least one product"); 
      return; 
    }
    
    setIsSubmitting(true);

    try {
      // Validate all products have stock
      for (const item of items) {
        const product = products.find(p => p._id === item.productId);
        if (!product) {
          toast.error(`Product "${item.name}" not found`);
          setIsSubmitting(false);
          return;
        }
        if (product.stock < item.qty) {
          toast.error(`Insufficient stock for "${product.name}". Available: ${product.stock}`);
          setIsSubmitting(false);
          return;
        }
      }

      const invoiceData = {
        customerName: customerName || "Walk-in customer",
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        employeeEmail: user?.email || "",
        employeeName: user?.name || "Staff",
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round((lineDisc + orderDiscAmt) * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        grandTotal: grand,
        paymentMethod,
        notes,
      };

      const result = await createInvoice(invoiceData);
      
      if (result) {
        toast.success(`Invoice ${result.number} created`);
        setLines([]);
        setNotes("");
        setOrderDiscount("0");
        setCustomerName("Walk-in customer");
        setCustomerEmail("");
        setCustomerPhone("");
        setInvoicePreview(result);
        // Refresh products to update stock
        await fetchProducts();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (productsLoading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Billing (POS)" 
        description="Create invoices and complete sales at the counter." 
      />
      
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Product Grid */}
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search product name, SKU or barcode…" 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                className="pl-8" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((p) => (
                <button 
                  key={p._id} 
                  disabled={p.stock <= 0} 
                  onClick={() => addLine(p)}
                  className="group flex flex-col rounded-lg border p-3 text-left transition-all hover:border-primary hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="mb-2 aspect-square overflow-hidden rounded bg-muted">
                    {p.image ? (
                      <img src={p.image} className="h-full w-full object-cover" alt={p.name} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Receipt className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sku}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">${p.sellingPrice}</span>
                    <Badge variant={p.stock <= 0 ? "destructive" : "secondary"} className="text-[10px]">
                      {p.stock}
                    </Badge>
                  </div>
                </button>
              ))}
              {results.length === 0 && (
                <div className="col-span-full">
                  <EmptyState icon={Search} title="No products match" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Cart · {lines.length} item{lines.length !== 1 ? "s" : ""}
              </p>
              {lines.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setLines([])}>
                  Clear
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {lines.length === 0 && (
                <p className="text-sm text-muted-foreground">Click a product to add it.</p>
              )}
              {lines.map((l) => {
                const p = products.find((x) => x._id === l.productId);
                if (!p) return null;
                return (
                  <div key={l.productId} className="flex items-center gap-2 rounded-md border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">${p.sellingPrice} × {l.qty}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={() => setQty(l.productId, l.qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{l.qty}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={() => setQty(l.productId, l.qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={() => setLines(lines.filter((x) => x.productId !== l.productId))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Input 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder="Customer name"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input 
                    value={customerEmail} 
                    onChange={(e) => setCustomerEmail(e.target.value)} 
                    placeholder="Email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input 
                    value={customerPhone} 
                    onChange={(e) => setCustomerPhone(e.target.value)} 
                    placeholder="Phone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Payment</Label>
                  <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Order discount %</Label>
                  <Input 
                    type="number" 
                    value={orderDiscount} 
                    onChange={(e) => setOrderDiscount(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea 
                  rows={2} 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-1 border-t pt-3 text-sm">
              <Row label="Subtotal" val={`$${subtotal.toFixed(2)}`} />
              <Row label="Discount" val={`- $${(lineDisc + orderDiscAmt).toFixed(2)}`} />
              <Row label="Tax" val={`$${tax.toFixed(2)}`} />
              <Row label="Grand total" val={`$${grand.toFixed(2)}`} bold />
            </div>

            <Button 
              className="w-full" 
              size="lg" 
              onClick={complete} 
              disabled={lines.length === 0 || isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Receipt className="mr-2 h-4 w-4" />
              Generate invoice
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!invoicePreview} onOpenChange={(o) => !o && setInvoicePreview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice {invoicePreview?.number}</DialogTitle>
          </DialogHeader>
          {invoicePreview && (
            <div className="space-y-4">
              <div dangerouslySetInnerHTML={{ __html: renderInvoiceHtml(invoicePreview) }} />
              <div className="flex gap-2 border-t pt-3">
                <Button variant="outline" onClick={() => printInvoice(invoicePreview)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => downloadInvoice(invoicePreview)}>
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

function Row({ label, val, bold }: { label: string; val: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={bold ? "text-foreground" : ""}>{val}</span>
    </div>
  );
}