// app/(manager)/vendors/page.tsx
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useVendors } from "@/app/hooks/useVendors";
import { useProducts } from "@/app/hooks/useProducts";
import { useInventory } from "@/app/hooks/useInventory";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Search, Eye, Pencil, Trash2, Truck, Loader2, Upload, X } from "lucide-react";
import { EntityImage } from "@/components/entity-image";
import { compressImageFile } from "@/lib/image-utils";
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
  name: string; 
  contactName: string; 
  email: string; 
  phone: string; 
  address: string; 
  gstin: string; 
  notes: string;
  image: string;
};

const emptyForm: FormState = { 
  name: "", 
  contactName: "", 
  email: "", 
  phone: "", 
  address: "", 
  gstin: "", 
  notes: "",
  image: "",
};

export default function VendorsPage() {
  const {
    vendors,
    loading,
    fetchVendors,
    createVendor,
    updateVendor,
    deleteVendor,
    searchVendors,
    getStats,
  } = useVendors();

  const { products, fetchProducts } = useProducts();
  const { movements, fetchMovements } = useInventory();

  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    vendorId: string | null; 
    vendorName: string 
  }>({
    open: false,
    vendorId: null,
    vendorName: ""
  });

  // Fetch data on mount
  useEffect(() => {
    fetchVendors();
    fetchProducts();
    fetchMovements();
  }, []);

  const stats = getStats();

  const filtered = useMemo(() => {
    if (!q.trim()) return vendors;
    return searchVendors(q);
  }, [vendors, q, searchVendors]);

  const openAdd = () => { 
    setForm(emptyForm); 
    setDialog({ mode: "add" }); 
  };

  const openEdit = (v: any) => {
    setForm({ 
      name: v.name, 
      contactName: v.contactName || "", 
      email: v.email, 
      phone: v.phone, 
      address: v.address || "", 
      gstin: v.gstin || "", 
      notes: v.notes || "",
      image: v.image || "",
    });
    setDialog({ mode: "edit", id: v._id });
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

  const validate = () => {
    if (!form.name.trim()) {
      toast.error("Vendor name is required");
      return false;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (!form.phone.trim()) {
      toast.error("Phone is required");
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const vendorData = {
        name: form.name.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        gstin: form.gstin.trim(),
        notes: form.notes.trim(),
        image: form.image ? form.image.trim() : undefined,
        status: "active" as const,
      };

      if (dialog?.mode === "add") {
        const result = await createVendor(vendorData);
        if (result) {
          toast.success("Vendor added successfully");
          setDialog(null);
          await fetchVendors();
        }
      } else if (dialog?.id) {
        const result = await updateVendor({ id: dialog.id, data: vendorData });
        if (result) {
          toast.success("Vendor updated successfully");
          setDialog(null);
          await fetchVendors();
        }
      }
    } catch (error) {
      toast.error("Failed to save vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (vendor: any) => {
    setDeleteDialog({
      open: true,
      vendorId: vendor._id,
      vendorName: vendor.name
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.vendorId) return;
    
    const success = await deleteVendor({ id: deleteDialog.vendorId });
    if (success) {
      toast.success(`Vendor "${deleteDialog.vendorName}" deleted successfully`);
      setDeleteDialog({ open: false, vendorId: null, vendorName: "" });
      await fetchVendors();
    } else {
      toast.error("Failed to delete vendor");
    }
  };

  // Loading state
  if (loading && vendors.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Vendors" 
        description={`${stats.total} total vendors · ${stats.active} active`}
        action={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add vendor
          </Button>
        } 
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search vendors…" 
              className="pl-8" 
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState 
              icon={Truck} 
              title="No vendors yet" 
              description="Add your first supplier to start tracking purchases." 
              action={
                <Button onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add vendor
                </Button>
              } 
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 w-16" />
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Products</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const productCount = products.filter((p) => p.supplierId === v._id).length;
                    return (
                      <tr key={v._id} className="border-t">
                        <td className="p-3">
                          <EntityImage
                            src={v.image}
                            alt={v.name}
                            icon={Truck}
                            className="h-10 w-10 rounded-md"
                          />
                        </td>
                        <td className="p-3 font-medium">{v.name}</td>
                        <td className="p-3">{v.contactName || "—"}</td>
                        <td className="p-3">{v.email}</td>
                        <td className="p-3">{v.phone}</td>
                        <td className="p-3">{productCount}</td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetail(v)}>
                                <Eye className="mr-2 h-4 w-4" />View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(v)}>
                                <Pencil className="mr-2 h-4 w-4" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteClick(v)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
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
       <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit vendor" : "Add vendor"}
            </DialogTitle>
            <DialogDescription>
              Supplier details for purchase orders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-4 sm:col-span-2">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border">
                <EntityImage
                  src={form.image}
                  alt="Vendor preview"
                  icon={Truck}
                  className="h-full w-full"
                />
                {form.image && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => setForm({ ...form, image: "" })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImage}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload image
                </Button>
                <Input
                  placeholder="…or paste image URL"
                  value={form.image.startsWith("data:") ? "" : form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                />
              </div>
            </div>
            <FormField label="Vendor name" className="sm:col-span-2">
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                placeholder="Enter vendor name"
              />
            </FormField>
            <FormField label="Contact person">
              <Input 
                value={form.contactName} 
                onChange={(e) => setForm({ ...form, contactName: e.target.value })} 
                placeholder="Enter contact name"
              />
            </FormField>
            <FormField label="Phone">
              <Input 
                value={form.phone} 
                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                placeholder="Enter phone number"
              />
            </FormField>
            <FormField label="Email" className="sm:col-span-2">
              <Input 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
                placeholder="Enter email address"
              />
            </FormField>
            <FormField label="GSTIN / Tax ID">
              <Input 
                value={form.gstin} 
                onChange={(e) => setForm({ ...form, gstin: e.target.value })} 
                placeholder="Enter GSTIN"
              />
            </FormField>
            <FormField label="Address">
              <Input 
                value={form.address} 
                onChange={(e) => setForm({ ...form, address: e.target.value })} 
                placeholder="Enter address"
              />
            </FormField>
            <FormField label="Notes" className="sm:col-span-2">
              <Textarea 
                rows={2} 
                value={form.notes} 
                onChange={(e) => setForm({ ...form, notes: e.target.value })} 
                placeholder="Additional notes"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog?.mode === "edit" ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>{detail?.contactName || "No contact"} · {detail?.email}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              {detail.image && (
                <EntityImage
                  src={detail.image}
                  alt={detail.name}
                  icon={Truck}
                  className="aspect-video w-full rounded-md"
                />
              )}
              <div className="rounded-md border p-3">
                <p><span className="text-muted-foreground">Phone:</span> {detail.phone}</p>
                <p><span className="text-muted-foreground">Address:</span> {detail.address || "—"}</p>
                {detail.gstin && <p><span className="text-muted-foreground">GSTIN:</span> {detail.gstin}</p>}
                {detail.notes && <p className="mt-2 text-muted-foreground">{detail.notes}</p>}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Products supplied</p>
                <div className="space-y-1">
                  {products.filter((p) => p.supplierId === detail._id).map((p) => (
                    <div key={p._id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{p.stock} in stock</span>
                    </div>
                  ))}
                  {products.filter((p) => p.supplierId === detail._id).length === 0 && (
                    <p className="text-xs text-muted-foreground">No products linked yet.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Recent purchases</p>
                <div className="space-y-1">
                  {movements.filter((m) => m.vendorId === detail._id).slice(0, 5).map((m) => {
                    const prod = products.find((p) => p._id === m.productId);
                    return (
                      <div key={m._id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <span>+{m.qty} × {prod?.name ?? "product"}</span>
                        <span className="text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                  {movements.filter((m) => m.vendorId === detail._id).length === 0 && (
                    <p className="text-xs text-muted-foreground">No purchase history.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - OUTSIDE the dropdown */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, vendorId: null, vendorName: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.vendorName}"? This action cannot be undone.
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

function FormField({ 
  label, 
  className, 
  children 
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