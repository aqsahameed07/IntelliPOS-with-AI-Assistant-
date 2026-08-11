// app/(manager)/inventory/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useProducts } from "@/app/hooks/useProducts";
import { useInventory } from "@/app/hooks/useInventory";
import { useVendors } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Package, AlertTriangle, DollarSign, Archive, Plus, Minus, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function InventoryPage() {
  const { products, loading: productsLoading, fetchProducts } = useProducts();
  const { 
    movements, 
    loading: movementsLoading, 
    stats, 
    fetchMovements, 
    fetchStats,
    addAdjustment 
  } = useInventory();
  const { items: vendors } = useVendors();
  const { user } = useAuth();

  const [dialog, setDialog] = useState<null | { mode: "adjust"; productId: string; productName: string }>(null);
  const [qty, setQty] = useState("1");
  const [vendorId, setVendorId] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [adjustSign, setAdjustSign] = useState<"+" | "-">("+");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
    fetchMovements();
    fetchStats();
  }, [fetchProducts, fetchMovements, fetchStats]);

  // Find product by ID
  const getProductById = (id: string) => products.find(p => p._id === id);

  const openAdjust = (productId: string, productName: string) => {
    setDialog({ mode: "adjust", productId, productName });
    setQty("1");
    setAdjustSign("+");
    setNote("");
  };

  const submit = async () => {
    if (!dialog) return;
    
    const n = Number(qty);
    if (!n || n <= 0) {
      toast.error("Enter a positive quantity");
      return;
    }

    setIsSubmitting(true);

    try {
      const signed = adjustSign === "+" ? n : -n;
      const product = getProductById(dialog.productId);
      
      if (signed < 0 && product && product.stock + signed < 0) {
        toast.error("Cannot go below zero");
        setIsSubmitting(false);
        return;
      }
      
      const result = await addAdjustment({
        productId: dialog.productId,
        qty: signed,
        note: note || undefined,
      });

      if (result) {
        toast.success("Stock adjusted");
        setDialog(null);
        await fetchMovements();
        await fetchStats();
        await fetchProducts(); // Refresh products to update stock
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process inventory change");
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
      <PageHeader title="Inventory" description="Track stock levels, purchases and adjustments." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total SKUs" value={stats.totalSKUs} icon={Package} />
        <StatCard label="Stock value" value={`$${stats.stockValue.toLocaleString()}`} icon={DollarSign} hint="At cost price" />
        <StatCard label="Low stock" value={stats.lowStock} icon={AlertTriangle} />
        <StatCard label="Out of stock" value={stats.outOfStock} icon={Archive} />
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock levels</TabsTrigger>
          <TabsTrigger value="movements">Movement log</TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Stock</th>
                      <th className="p-3">Value</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const status = p.stock === 0 ? "Out" : p.stock <= p.minStock ? "Low" : "OK";
                      return (
                        <tr key={p._id} className="border-t">
                          <td className="p-3 font-medium">{p.name}</td>
                          <td className="p-3 font-mono text-xs">{p.sku}</td>
                          <td className="p-3">
                            <Badge variant={status === "OK" ? "secondary" : "destructive"}>{p.stock}</Badge>
                          </td>
                          <td className="p-3">${(p.stock * p.purchasePrice).toLocaleString()}</td>
                          <td className="p-3">
                            <Badge variant={status === "OK" ? "default" : status === "Low" ? "secondary" : "destructive"}>
                              {status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => openAdjust(p._id, p.name)}>
                                <Minus className="mr-1 h-3.5 w-3.5" />Adjust
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsLoading ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          No movements yet.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => {
                        const product = getProductById(m.productId);
                        const vendor = vendors.find((v) => v.id === m.vendorId);
                        const positive = m.qty > 0;
                        return (
                          <tr key={m._id} className="border-t">
                            <td className="p-3 text-xs text-muted-foreground">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3">{product?.name ?? "—"}</td>
                            <td className="p-3 capitalize">{m.type}</td>
                            <td className={`p-3 font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                              {positive ? <ArrowUpRight className="inline h-3.5 w-3.5" /> : <ArrowDownRight className="inline h-3.5 w-3.5" />} {m.qty}
                            </td>
                            <td className="p-3">{vendor?.name ?? "—"}</td>
                            <td className="p-3 font-mono text-xs">{m.reference ?? "—"}</td>
                            <td className="p-3 text-muted-foreground">{m.note ?? "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adjust — {dialog?.productName}
            </DialogTitle>
            <DialogDescription>
              Manual stock correction (damage, loss, count).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant={adjustSign === "+" ? "default" : "outline"} 
                onClick={() => setAdjustSign("+")}
              >
                <Plus className="mr-1 h-4 w-4" />Increase
              </Button>
              <Button 
                type="button" 
                variant={adjustSign === "-" ? "default" : "outline"} 
                onClick={() => setAdjustSign("-")}
              >
                <Minus className="mr-1 h-4 w-4" />Decrease
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input 
                type="number" 
                value={qty} 
                onChange={(e) => setQty(e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input 
                value={note} 
                onChange={(e) => setNote(e.target.value)} 
                placeholder="Optional" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}