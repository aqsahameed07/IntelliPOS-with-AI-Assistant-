"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

// Note: In Next.js App Router, metadata is handled differently
// Since this is a client component, metadata should be in a separate server component
// or in the parent layout

export default function SettingsPage() {
  const { user, updateProfile, logout } = useAuth();
  const { company, setCompany } = useCompany();
  const router = useRouter();
  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "",
  });
  const [co, setCo] = useState(company);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("erp:theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => { setCo(company); }, [company]);

  const toggleTheme = (v: boolean) => {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("erp:theme", v ? "dark" : "light");
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, company, and preferences." />
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <CardDescription>Update the details linked to your account.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
              <Field label="Email"><Input value={profile.email} disabled /></Field>
              <Field label="Phone"><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
              <Field label="Role"><Input value={profile.role} disabled readOnly /></Field>
              <div className="sm:col-span-2">
                <Button onClick={() => { updateProfile({ name: profile.name, phone: profile.phone }); toast.success("Profile saved"); }}>
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company information</CardTitle>
              <CardDescription>Displayed across invoices and reports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name"><Input value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} /></Field>
              <Field label="Email"><Input value={co.email} onChange={(e) => setCo({ ...co, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={co.phone} onChange={(e) => setCo({ ...co, phone: e.target.value })} /></Field>
              <Field label="Address"><Input value={co.address} onChange={(e) => setCo({ ...co, address: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Button onClick={() => { setCompany(co); toast.success("Company info saved"); }}>
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Switch between light and dark themes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-md border p-4">
                <div className="flex items-center gap-3">
                  {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <div>
                    <p className="text-sm font-medium">Dark mode</p>
                    <p className="text-xs text-muted-foreground">Use a darker color palette.</p>
                  </div>
                </div>
                <Switch checked={dark} onCheckedChange={toggleTheme} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Sign out of your session.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}