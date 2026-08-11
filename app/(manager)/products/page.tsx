// app/(manager)/products/page.tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useProducts } from "@/app/hooks/useProducts";
import { useCategories } from "@/app/hooks/useCategories";
import { useVendors } from "@/app/hooks/useVendors";
import type { IProduct } from "@/app/models/Product";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Search, Eye, Pencil, Trash2, Grid3x3, List, Package, Upload, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { compressImageFile, isDisplayableImage } from "@/lib/image-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FormState = {
  name: string; category: string; sku: string; barcode: string; brand: string; supplierId: string;
  description: string; image: string; gallery: string[];
  purchasePrice: string; sellingPrice: string; discount: string; tax: string;
  unit: string; tags: string; stock: string; minStock: string; status: "active" | "inactive";
};

const emptyForm: FormState = {
  name: "", category: "", sku: "", barcode: "", brand: "", supplierId: "",
  description: "", image: "", gallery: [],
  purchasePrice: "", sellingPrice: "", discount: "0", tax: "5",
  unit: "Piece", tags: "", stock: "0", minStock: "5", status: "active",
};

const UNITS = ["Piece", "Box", "Kg", "Litre", "Pack", "Set"];

const genSKU = (name: string) =>
  name.split(/\s+/).slice(0, 3).map((w) => w.slice(0, 3).toUpperCase()).join("-") + "-" + Math.floor(Math.random()*900+100);

export default function ProductsPage() {
  const { 
    products, 
    loading, 
    error, 
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    updateStock
  } = useProducts();
  
  const { categories: categoryList, fetchCategories } = useCategories();
  const { vendors, fetchVendors, loading: vendorsLoading } = useVendors();
  const { user } = useAuth();
  const canDelete = user?.role === "Admin";

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [detail, setDetail] = useState<IProduct | null>(null);
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    productId: string | null; 
    productName: string 
  }>({
    open: false,
    productId: null,
    productName: ""
  });

  const CATEGORIES = categoryList.filter((c) => c.status === "active").map((c) => c.name);
  
  // Get frontend URL from env
  const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  
  // Initial fetch
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchVendors();
  }, [fetchProducts, fetchCategories, fetchVendors]);

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const categories = Array.from(new Set([...CATEGORIES, ...products.map((p) => p.category)]));

  const filtered = useMemo(() => products.filter((p) =>
    (category === "all" || p.category === category) &&
    (!lowOnly || p.stock <= p.minStock) &&
    (q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()) || (p.brand ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [products, q, category, lowOnly]);

  const openAdd = () => {
    setForm({ 
      ...emptyForm, 
      category: CATEGORIES[0] ?? "Uncategorized",
      sku: genSKU("Product")
    });
    setErrors({}); 
    setDialog({ mode: "add" });
  };

  const openEdit = (p: IProduct) => {
    setForm({
      name: p.name, category: p.category, sku: p.sku, barcode: p.barcode ?? "", brand: p.brand ?? "",
      supplierId: p.supplierId ?? "", description: p.description, image: p.image ?? "", gallery: p.gallery ?? [],
      purchasePrice: String(p.purchasePrice), sellingPrice: String(p.sellingPrice),
      discount: String(p.discount ?? 0), tax: String(p.tax ?? 0), unit: p.unit ?? "Piece",
      tags: (p.tags ?? []).join(", "), stock: String(p.stock), minStock: String(p.minStock), status: p.status,
    });
    setErrors({});
    setDialog({ mode: "edit", id: p._id });
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const src = await compressImageFile(f);
      setForm((s) => ({ ...s, image: src }));
      toast.success("Image attached");
    } catch {
      toast.error("Could not read that image");
    }
  };

  const handleGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    e.target.value = "";
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map((f) => compressImageFile(f, 700, 0.7)));
      setForm((s) => ({ ...s, gallery: [...s.gallery, ...urls].slice(0, 4) }));
    } catch {
      toast.error("Could not read those images");
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.sellingPrice || Number(form.sellingPrice) < 0) e.sellingPrice = "Invalid";
    if (!form.purchasePrice || Number(form.purchasePrice) < 0) e.purchasePrice = "Invalid";
    if (form.image && !isDisplayableImage(form.image)) {
      e.image = "Please provide a valid image URL or upload a file.";
    }
    
    // Check for duplicate SKU when adding
    if (dialog?.mode === "add") {
      const exists = products.some(
        (p) => p.sku.toLowerCase() === form.sku.trim().toLowerCase()
      );
      if (exists) e.sku = "SKU already exists";
    }
    
    setErrors(e); 
    if (Object.keys(e).length) return;

    setIsSubmitting(true);

    const data = {
      name: form.name.trim(),
      category: form.category || "Uncategorized",
      sku: form.sku.trim() || genSKU(form.name),
      barcode: form.barcode.trim() || undefined,
      brand: form.brand.trim() || undefined,
      supplierId: form.supplierId || undefined,
      description: form.description || "",
      image: form.image || undefined,
      gallery: form.gallery || [],
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice),
      discount: Number(form.discount) || 0,
      tax: Number(form.tax) || 0,
      unit: form.unit || "Piece",
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
      status: form.status,
    };

    try {
      let result = null;
      
      if (dialog?.mode === "add") {
        result = await addProduct(data);
        if (result) {
          toast.success("Product added successfully");
        }
      } else if (dialog?.id) {
        result = await updateProduct(dialog.id, data);
        if (result) {
          toast.success("Product updated successfully");
        }
      }
      
      if (result) {
        setDialog(null);
        await fetchProducts();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (product: IProduct) => {
    setDeleteDialog({
      open: true,
      productId: product._id,
      productName: product.name
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.productId) return;
    
    const success = await deleteProduct(deleteDialog.productId);
    if (success) {
      toast.success(`Product "${deleteDialog.productName}" deleted successfully`);
      setDeleteDialog({ open: false, productId: null, productName: "" });
      await fetchProducts();
    } else {
      toast.error("Failed to delete product");
    }
  };

  // Helper function to get full image URL from gallery or image field
  const getProductImageUrl = (product: IProduct) => {
    // First check if there's a direct image
    if (product.image) {
      if (product.image.startsWith('http://') || product.image.startsWith('https://') || product.image.startsWith('data:')) {
        return product.image;
      }
      const cleanSrc = product.image.startsWith('/') ? product.image.substring(1) : product.image;
      return `${FRONTEND_URL}/${cleanSrc}`;
    }
    
    // Then check gallery array for first image
    if (product.gallery && product.gallery.length > 0) {
      const firstImage = product.gallery[0];
      if (firstImage.startsWith('http://') || firstImage.startsWith('https://') || firstImage.startsWith('data:')) {
        return firstImage;
      }
      const cleanSrc = firstImage.startsWith('/') ? firstImage.substring(1) : firstImage;
      return `${FRONTEND_URL}/${cleanSrc}`;
    }
    
    return null;
  };

  // Helper for form images (preview)
  const getFormImageUrl = (src?: string) => {
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return src;
    }
    const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
    return `${FRONTEND_URL}/${cleanSrc}`;
  };

  // Loading state
  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your catalog with images, pricing, and inventory rules."
        action={
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add product</Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, brand…" className="pl-8" />
            </div>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>Low stock only</Button>
            <div className="ml-auto flex rounded-md border">
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="rounded-r-none" onClick={() => setView("grid")}><Grid3x3 className="h-4 w-4" /></Button>
              <Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="rounded-l-none" onClick={() => setView("table")}><List className="h-4 w-4" /></Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Package} title="No products found" description="Try changing filters or add a new product." action={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add product</Button>} />
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => {
                const low = p.stock <= p.minStock;
                const imageUrl = getProductImageUrl(p);
                return (
                  <Card key={p._id} className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="aspect-square w-full overflow-hidden bg-muted">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            console.error('Image failed to load:', imageUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.category} · {p.sku}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetail(p)}>
                              <Eye className="mr-2 h-4 w-4" />View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="mr-2 h-4 w-4" />Edit
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteClick(p)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold">${p.sellingPrice}</p>
                        <Badge variant={low ? "destructive" : "secondary"}>{p.stock} in stock</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
                        <Button variant="outline" size="sm" className="ml-auto h-7" onClick={() => setDetail(p)}>Details</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Category</th>
                    <th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const imageUrl = getProductImageUrl(p);
                    return (
                      <tr key={p._id} className="border-t">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-muted">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    console.error('Image failed to load:', imageUrl);
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="flex items-center justify-center w-full h-full">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs">{p.sku}</td>
                        <td className="p-3">{p.category}</td>
                        <td className="p-3">${p.sellingPrice}</td>
                        <td className="p-3"><Badge variant={p.stock <= p.minStock ? "destructive" : "secondary"}>{p.stock}</Badge></td>
                        <td className="p-3"><Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge></td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetail(p)}>
                                <Eye className="mr-2 h-4 w-4" />View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(p)}>
                                <Pencil className="mr-2 h-4 w-4" />Edit
                              </DropdownMenuItem>
                              {canDelete && (
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteClick(p)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Add/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>Complete inventory-ready product details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-start gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {form.image ? (
                  <img
                    src={getFormImageUrl(form.image) || form.image}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                {form.image && (
                  <Button size="icon" variant="secondary" className="absolute right-1 top-1 h-6 w-6" onClick={() => setForm({ ...form, image: "" })}><X className="h-3 w-3" /></Button>
                )}
              </div>
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImage} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Main image</Button>
                <Input
                  placeholder="…or paste image URL"
                  className="h-8 text-xs"
                  value={form.image.startsWith("data:") ? "" : form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                />
                {errors.image && <p className="text-xs text-destructive">{errors.image}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {form.gallery.map((g, i) => (
                    <div key={i} className="relative h-12 w-12 overflow-hidden rounded border bg-muted">
                      {g ? (
                        <img
                          src={getFormImageUrl(g) || g}
                          alt={`Gallery ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <button type="button" className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5" onClick={() => setForm({ ...form, gallery: form.gallery.filter((_, j) => j !== i) })}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={handleGallery} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => galleryRef.current?.click()}><Plus className="mr-1 h-3 w-3" />Gallery</Button>
                </div>
              </div>
            </div>

            <Field label="Name" error={errors.name} className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Category" error={errors.category}>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.length > 0 ? (
                    CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)
                  ) : (
                    <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Brand"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
            <Field label="SKU" error={errors.sku}><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Barcode"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
            <Field label="Supplier / Vendor">
              <Select value={form.supplierId || "none"} onValueChange={(v) => setForm({ ...form, supplierId: v === "none" ? "" : (v ?? "") })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {vendorsLoading ? (
                    <SelectItem value="loading" disabled>Loading vendors...</SelectItem>
                  ) : (
                    vendors.map((v) => (
                      <SelectItem key={v._id} value={v._id}>{v.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Unit">
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v ?? "Piece" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Cost price" error={errors.purchasePrice}><Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></Field>
            <Field label="Selling price" error={errors.sellingPrice}><Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></Field>
            <Field label="Discount %"><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></Field>
            <Field label="Tax %"><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></Field>
            <Field label="Opening stock"><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
            <Field label="Low-stock threshold"><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tags (comma separated)" className="sm:col-span-2">
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="new, popular, sale" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog?.mode === "edit" ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>SKU {detail?.sku} · {detail?.category}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                {getProductImageUrl(detail) ? (
                  <img
                    src={getProductImageUrl(detail)!}
                    alt={detail.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              {(detail.gallery?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detail.gallery!.map((g, i) => {
                    const galleryUrl = getFormImageUrl(g);
                    return (
                      <div key={i} className="h-14 w-14 rounded-md border overflow-hidden bg-muted">
                        {galleryUrl ? (
                          <img
                            src={galleryUrl}
                            alt={`${detail.name} ${i + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{detail.description || "No description."}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Brand" value={detail.brand || "—"} />
                <Info label="Barcode" value={detail.barcode || "—"} />
                <Info label="Cost price" value={`$${detail.purchasePrice}`} />
                <Info label="Selling price" value={`$${detail.sellingPrice}`} />
                <Info label="Discount" value={`${detail.discount ?? 0}%`} />
                <Info label="Tax" value={`${detail.tax ?? 0}%`} />
                <Info label="Stock" value={String(detail.stock)} />
                <Info label="Min stock" value={String(detail.minStock)} />
                <Info label="Unit" value={detail.unit ?? "Piece"} />
                <Info label="Status" value={detail.status} />
              </div>
              {(detail.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - OUTSIDE the dropdown */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, productId: null, productName: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.productName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}