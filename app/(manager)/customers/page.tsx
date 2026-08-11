// app/(manager)/customers/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useCustomers } from "@/app/hooks/useCustomers";
import { useOrders } from "@/app/hooks/useOrders";
import type { ICustomer } from "@/app/models/Customer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Search, Eye, Pencil, Trash2, Mail, Phone, MapPin, Loader2, ShoppingBag, Key } from "lucide-react";
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
  email: string; 
  phone: string; 
  address: string;
  password: string;
};

const emptyForm: FormState = { 
  name: "", 
  email: "", 
  phone: "", 
  address: "",
  password: "",
};

export default function CustomersPage() {
  const {
    customers,
    loading,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getStats,
    searchCustomers,
  } = useCustomers();

  const { orders, fetchOrders, loading: ordersLoading } = useOrders();

  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [view, setView] = useState<ICustomer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    customerId: string | null; 
    customerName: string 
  }>({
    open: false,
    customerId: null,
    customerName: ""
  });

  // Fetch customers and orders on mount
  useEffect(() => {
    fetchCustomers();
    fetchOrders();
  }, [fetchCustomers, fetchOrders]);

  // Search customers
  const filtered = useMemo(() => {
    if (!q.trim()) return customers;
    return searchCustomers(q);
  }, [customers, q, searchCustomers]);

  // Get customer stats from orders
  const getCustomerOrderStats = (email: string) => {
    const customerOrders = orders.filter((o) => o.customerEmail === email);
    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const lastOrder = customerOrders.length > 0 ? customerOrders[0] : null;
    return { totalOrders, totalSpent, lastOrder };
  };

  const stats = getStats();

  const openAdd = () => {
    setForm(emptyForm);
    setErrors({});
    setDialog({ mode: "add" });
  };

  const openEdit = (c: ICustomer) => {
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone || "",
      address: c.address || "",
      password: "",
    });
    setErrors({});
    setDialog({ mode: "edit", id: c._id });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
    if (!form.phone.trim()) e.phone = "Required";
    
    if (dialog?.mode === "add" && !form.password.trim()) {
      e.password = "Password is required for new customer";
    }
    if (dialog?.mode === "add" && form.password.length < 6) {
      e.password = "Password must be at least 6 characters";
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    const customerData: any = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      status: "active" as const,
    };

    if (dialog?.mode === "add" || form.password.trim()) {
      customerData.password = form.password.trim();
    }

    try {
      if (dialog?.mode === "add") {
        const result = await createCustomer(customerData);
        if (result) {
          toast.success(
            `Customer created successfully!\nEmail: ${form.email}\nPassword: ${form.password}`,
            { duration: 8000 }
          );
          setDialog(null);
          await fetchCustomers();
        }
      } else if (dialog?.id) {
        const result = await updateCustomer({ id: dialog.id, data: customerData });
        if (result) {
          toast.success("Customer updated successfully");
          setDialog(null);
          await fetchCustomers();
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (customer: ICustomer) => {
    setDeleteDialog({
      open: true,
      customerId: customer._id ?? null,
      customerName: customer.name
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.customerId) return;
    
    const success = await deleteCustomer({ id: deleteDialog.customerId });
    if (success) {
      toast.success(`Customer "${deleteDialog.customerName}" deleted successfully`);
      setDeleteDialog({ open: false, customerId: null, customerName: "" });
      await fetchCustomers();
    } else {
      toast.error("Failed to delete customer");
    }
  };

  const initials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Loading state
  if (loading && customers.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${stats.total} total customers · ${stats.active} active`}
        action={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add customer
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
              placeholder="Search customers…"
              className="pl-8"
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total spent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No customers found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => {
                  const orderStats = getCustomerOrderStats(c.email);
                  return (
                    <TableRow key={c._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">
                        {c.address || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{orderStats.totalOrders}</span>
                        </div>
                      </TableCell>
                      <TableCell>${orderStats.totalSpent.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "default" : "outline"}>
                          {c.status || "active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setView(c)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(c)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(c)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit customer" : "Add customer"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit" 
                ? "Update customer contact and address details." 
                : "Create a new customer with login credentials."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Name" error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter full name"
              />
            </FormField>
            <FormField label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter email address"
              />
            </FormField>
            <FormField label="Phone" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </FormField>
            <FormField label="Address">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Enter address"
              />
            </FormField>
            
            {/* Password field - for new customers */}
            {dialog?.mode === "add" && (
              <FormField label="Password" error={errors.password}>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter password (min 6 characters)"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This password will be used for customer login
                </p>
              </FormField>
            )}

            {/* Password field - optional for edit */}
            {dialog?.mode === "edit" && (
              <FormField label="New Password (optional)" error={errors.password}>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Leave blank to keep current password"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Only fill this if you want to reset the customer's password
                </p>
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog?.mode === "edit" ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          {view && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{initials(view.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{view.name}</DialogTitle>
                    <DialogDescription>{view.email}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {(() => {
                const orderStats = getCustomerOrderStats(view.email);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4 py-2">
                      <div className="rounded-md border p-3 text-center">
                        <p className="text-2xl font-semibold">{orderStats.totalOrders}</p>
                        <p className="text-xs text-muted-foreground">Total Orders</p>
                      </div>
                      <div className="rounded-md border p-3 text-center">
                        <p className="text-2xl font-semibold">${orderStats.totalSpent.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Total Spent</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {view.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {view.phone || "No phone number"}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {view.address || "No address provided"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={view.status === "active" ? "default" : "outline"}>
                          {view.status || "active"}
                        </Badge>
                      </div>
                    </div>

                    {orderStats.totalOrders > 0 && orderStats.lastOrder && (
                      <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground">Last order</p>
                        <p className="text-sm font-medium">
                          {orderStats.lastOrder.number} - ${orderStats.lastOrder.grandTotal?.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(orderStats.lastOrder.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - OUTSIDE the dropdown */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, customerId: null, customerName: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.customerName}"? This will also delete their user account and cannot be undone.
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
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}