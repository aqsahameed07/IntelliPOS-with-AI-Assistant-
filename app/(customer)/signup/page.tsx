"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth, landingFor } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CustomerSignupPage() {
  const { signup, user, ready } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(landingFor(user.role));
    }
  }, [ready, user, router]);

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();

    const e: Record<string, string> = {};

    if (!form.name.trim()) {
      e.name = "Name is required";
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      e.email = "Enter a valid email";
    }

    if (form.password.length < 6) {
      e.password = "Password must be at least 6 characters";
    }

    if (!form.phone.trim()) {
      e.phone = "Phone is required";
    }

    if (!form.address.trim()) {
      e.address = "Address is required";
    }

    setErrors(e);

    if (Object.keys(e).length) return;

    setLoading(true);

    try {
      // Await the signup promise
      const res = await signup({
        ...form,
        role: "Customer",
      });

      setLoading(false);

      if (!res.ok) {
        toast.error(res.error);
        setErrors({ email: res.error });
        return;
      }

      toast.success("Account created! Welcome to Nimbus!");
      router.replace(landingFor(res.user.role));
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Signup failed. Please try again.");
      setErrors({ email: "Signup failed. Please try again." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </div>

            <span className="font-semibold">IntelliPOS</span>
          </div>

          <CardTitle className="text-2xl">
            Create Customer Account
          </CardTitle>

          <CardDescription>
            Sign up to start shopping and manage your orders.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Full Name" error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                placeholder="John Doe"
              />
            </Field>

            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                placeholder="you@email.com"
              />
            </Field>

            <Field label="Password" error={errors.password}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                placeholder="At least 6 characters"
              />
            </Field>

            <Field label="Phone" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value,
                  })
                }
                placeholder="+1 555-0000"
              />
            </Field>

            <Field label="Address" error={errors.address}>
              <Textarea
                value={form.address}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: e.target.value,
                  })
                }
                placeholder="123 Main St, City, State, ZIP"
                rows={3}
              />
            </Field>

            <p className="text-xs text-muted-foreground">
              By creating an account, you agree to our Terms of Service.
            </p>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Account
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
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
      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}