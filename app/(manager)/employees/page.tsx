// app/(manager)/employees/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useEmployees } from "@/app/hooks/useEmployees";
import { useActivities } from "@/lib/store";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Search, Eye, Pencil, Trash2, Mail, Phone, Briefcase, Loader2, Key } from "lucide-react";
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
  role: string; 
  department: string; 
  salary: string; 
  password: string;
};

type DialogState = { 
  mode: "add" | "edit"; 
  id?: string;
} | null;

const emptyForm: FormState = { 
  name: "", 
  email: "", 
  phone: "", 
  role: "Developer", 
  department: "Engineering", 
  salary: "",
  password: "",
};

export default function EmployeesPage() {
  const {
    employees,
    loading,
    fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getStats,
    searchEmployees,
  } = useEmployees();

  const { push } = useActivities();

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [view, setView] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    employeeId: string | null; 
    employeeName: string 
  }>({
    open: false,
    employeeId: null,
    employeeName: ""
  });

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const roles = Array.from(new Set(employees.map((e) => e.role)));

  const filtered = useMemo(() => {
    if (!q.trim()) return employees;
    return searchEmployees(q);
  }, [employees, q, searchEmployees]);

  const stats = getStats();

  const openAdd = () => { 
    setForm(emptyForm); 
    setErrors({}); 
    setDialog({ mode: "add" }); 
  };
  
  const openEdit = (e: any) => {
    setForm({ 
      name: e.name, 
      email: e.email, 
      phone: e.phone, 
      role: e.role, 
      department: e.department, 
      salary: String(e.salary),
      password: "",
    });
    setErrors({});
    setDialog({ mode: "edit", id: e._id });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.salary || Number(form.salary) < 0) e.salary = "Invalid";
    
    if (dialog?.mode === "add" && !form.password.trim()) {
      e.password = "Password is required for new employee";
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

    const employeeData: any = { 
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      department: form.department,
      salary: Number(form.salary),
      status: "active",
    };

    if (dialog?.mode === "add" || form.password.trim()) {
      employeeData.password = form.password.trim();
    }

    try {
      if (dialog?.mode === "add") {
        const result = await createEmployee(employeeData);
        if (result) {
          push({ type: "employee", message: `Employee '${form.name}' added` });
          toast.success(
            `Employee created successfully!\nEmail: ${form.email}\nPassword: ${form.password}`,
            { duration: 8000 }
          );
          setDialog(null);
          await fetchEmployees();
        }
      } else if (dialog?.mode === "edit" && dialog.id) {
        const result = await updateEmployee({ id: dialog.id, data: employeeData });
        if (result) {
          toast.success("Employee updated successfully");
          setDialog(null);
          await fetchEmployees();
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (employee: any) => {
    setDeleteDialog({
      open: true,
      employeeId: employee._id,
      employeeName: employee.name
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.employeeId) return;
    
    const success = await deleteEmployee({ id: deleteDialog.employeeId });
    if (success) {
      push({ type: "employee", message: `Employee "${deleteDialog.employeeName}" deleted` });
      toast.success(`Employee "${deleteDialog.employeeName}" deleted successfully`);
      setDeleteDialog({ open: false, employeeId: null, employeeName: "" });
      await fetchEmployees();
    } else {
      toast.error("Failed to delete employee");
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
  if (loading && employees.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={`${stats.total} total employees · ${stats.active} active`}
        action={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add employee
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                placeholder="Search employees…" 
                className="pl-8" 
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {initials(e.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{e.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{e.email}</TableCell>
                    <TableCell>{e.phone}</TableCell>
                    <TableCell>{e.role}</TableCell>
                    <TableCell>{e.department}</TableCell>
                    <TableCell>${e.salary.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "active" ? "default" : "outline"}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setView(e)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(e)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteClick(e)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit employee" : "Add employee"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit" 
                ? "Update team member details and compensation." 
                : "Create a new employee with login credentials."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField 
              label="Name" 
              error={errors.name} 
              className="sm:col-span-2"
            >
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
              />
            </FormField>
            
            <FormField label="Email" error={errors.email}>
              <Input 
                type="email" 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
              />
            </FormField>
            
            <FormField label="Phone" error={errors.phone}>
              <Input 
                value={form.phone} 
                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
              />
            </FormField>
            
            <FormField label="Role">
              <Select 
                value={form.role} 
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Manager", "Developer", "Designer", "Accountant", "HR Specialist", "Sales Rep", "Support"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            
            <FormField label="Department">
              <Select 
                value={form.department} 
                onValueChange={(v) => setForm({ ...form, department: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Engineering", "Product", "Sales", "Finance", "HR", "Customer Success"].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            
            <FormField label="Salary" error={errors.salary} className="sm:col-span-2">
              <Input 
                type="number" 
                value={form.salary} 
                onChange={(e) => setForm({ ...form, salary: e.target.value })} 
              />
            </FormField>

            {/* Password field - for new employees */}
            {dialog?.mode === "add" && (
              <FormField label="Password" error={errors.password} className="sm:col-span-2">
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
                  This password will be used for employee login
                </p>
              </FormField>
            )}

            {/* Password field - optional for edit */}
            {dialog?.mode === "edit" && (
              <FormField label="New Password (optional)" error={errors.password} className="sm:col-span-2">
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
                  Only fill this if you want to reset the employee's password
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
              {dialog?.mode === "edit" ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          {view && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{initials(view.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{view.name}</DialogTitle>
                    <DialogDescription>
                      {view.role} · {view.department}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {view.email}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {view.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  ${view.salary.toLocaleString()} / year
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - OUTSIDE the dropdown */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, employeeId: null, employeeName: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.employeeName}"? This will also delete their user account and cannot be undone.
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
  className, 
  children 
}: { 
  label: string; 
  error?: string; 
  className?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}