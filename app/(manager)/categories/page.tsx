// app/(manager)/categories/page.tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useCategories } from "@/app/hooks/useCategories";
import { useProducts } from "@/lib/store";
import type { ICategory } from "@/app/models/Category";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Search, Pencil, Trash2, Tags, Upload, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EntityImage } from "@/components/entity-image";
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
  name: string; 
  description: string; 
  image: string; 
  status: "active" | "inactive" 
};

const emptyForm: FormState = { 
  name: "", 
  description: "", 
  image: "", 
  status: "active" 
};

export default function CategoriesPage() {
  const { 
    categories, 
    loading, 
    error, 
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory 
  } = useCategories();
  const { items: products } = useProducts();
  const { user } = useAuth();
  const canDelete = user?.role === "Admin";

  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; categoryId: string | null; categoryName: string }>({
    open: false,
    categoryId: null,
    categoryName: ""
  });

  // Initial fetch
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Map backend categories to match the component's expected structure
  const mappedCategories = useMemo(() => {
    return categories.map(c => ({
      id: c._id,
      name: c.name,
      description: c.description || "",
      image: c.image || "",
      status: c.status || "active",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
  }, [categories]);

  const productCount = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => { 
      map[p.category] = (map[p.category] ?? 0) + 1; 
    });
    return map;
  }, [products]);

  const filtered = mappedCategories.filter((c) => 
    c.name.toLowerCase().includes(q.toLowerCase())
  );

  const openAdd = () => { 
    setForm({ ...emptyForm }); 
    setErrors({}); 
    setDialog({ mode: "add" }); 
  };

  const openEdit = (c: typeof mappedCategories[0]) => {
    setForm({ 
      name: c.name, 
      description: c.description ?? "", 
      image: c.image ?? "", 
      status: c.status as "active" | "inactive" 
    });
    setErrors({}); 
    setDialog({ mode: "edit", id: c.id }); 
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

  const submit = async () => {
    // Clear previous errors
    setErrors({});
    
    // Validate
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Required";
    if (form.image && !isDisplayableImage(form.image)) {
      e.image = "Please provide a valid image URL or upload a file.";
    }
    
    if (dialog?.mode === "add") {
      const exists = categories.some(
        (c) => c.name.toLowerCase() === form.name.trim().toLowerCase()
      );
      if (exists) e.name = "Category already exists";
    }
    
    setErrors(e); 
    if (Object.keys(e).length) {
      toast.error("Please fix the errors before submitting");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    
    const data = { 
      name: form.name.trim(), 
      description: form.description.trim(), 
      image: form.image ? form.image.trim() : undefined, 
      status: form.status 
    };

    try {
      let success = false;
      
      if (dialog?.mode === "add") {
        const result = await addCategory(data);
        // Check if result is truthy (has data) - if we got a category back, it was successful
        if (result) {
          success = true;
          toast.success("Category added successfully");
        } else {
          // If result is null, the hook already showed an error toast
          success = false;
        }
      } else if (dialog?.id) {
        const result = await updateCategory(dialog.id, data);
        if (result) {
          success = true;
          toast.success("Category updated successfully");
        } else {
          success = false;
        }
      }
      
      if (success) {
        // ✅ Close dialog on success
        setDialog(null);
        setForm(emptyForm);
        await fetchCategories();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (category: typeof mappedCategories[0]) => {
    const count = productCount[category.name] ?? 0;
    if (count > 0) { 
      toast.error(`Cannot delete — ${count} product(s) still use this category`); 
      return; 
    }
    setDeleteDialog({
      open: true,
      categoryId: category.id,
      categoryName: category.name
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.categoryId) return;
    
    const success = await deleteCategory(deleteDialog.categoryId);
    if (success) {
      toast.success(`Category "${deleteDialog.categoryName}" deleted successfully`);
      setDeleteDialog({ open: false, categoryId: null, categoryName: "" });
      await fetchCategories();
    } else {
      toast.error("Failed to delete category");
    }
  };

  // Loading state
  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize your catalog by product categories."
        action={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add category
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
              placeholder="Search categories…" 
              className="pl-8" 
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState 
              icon={Tags} 
              title="No categories" 
              description="Add your first category to organize products." 
              action={
                <Button onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add category
                </Button>
              } 
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((c) => (
                <Card key={c.id} className="overflow-hidden">
                  <EntityImage 
                    src={c.image} 
                    alt={c.name} 
                    icon={Tags} 
                    className="aspect-video w-full" 
                  />
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.description || "No description"}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger >
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(c)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {productCount[c.name] ?? 0} products
                      </Badge>
                      <Badge variant={c.status === "active" ? "default" : "outline"}>
                        {c.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit category" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              Categories help you organize products across the catalog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border">
                <EntityImage 
                  src={form.image} 
                  alt="Category preview" 
                  icon={Tags} 
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
                {errors.image && (
                  <p className="text-xs text-destructive">
                    {errors.image}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea 
                rows={3} 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog?.mode === "edit" ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - OUTSIDE the dropdown */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, categoryId: null, categoryName: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.categoryName}"? This action cannot be undone.
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