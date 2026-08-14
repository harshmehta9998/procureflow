import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Shield, Building2, UserCog, Wallet } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin", icon: Shield, desc: "Full system oversight" },
  { value: "admin", label: "Institutional Admin", icon: Building2, desc: "Manage institute POs" },
  { value: "centre_head", label: "Centre Head", icon: UserCog, desc: "Approve & verify" },
  { value: "finance", label: "Finance", icon: Wallet, desc: "Payments & liabilities" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  // Post-login destination (e.g. the MCP OAuth consent page sends users here
  // with returnTo so the grant flow can resume). Same-origin paths only.
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!selectedRole) {
      setError("Please select how you want to log in.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      // Verify the account actually holds the selected role; otherwise block
      // access and sign the user back out so they can't proceed.
      const me = await base44.auth.me();
      const actualRole = me?.app_role || (me?.role === "admin" ? "super_admin" : null);
      if (actualRole !== selectedRole) {
        await base44.auth.logout();
        const wanted = ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label || selectedRole;
        throw new Error(`This account is not registered as a ${wanted}. Pick the role that matches your account.`);
      }
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", returnTo);
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <p className="text-xs text-muted-foreground">
          Access is invite-only — your Super Admin creates all user accounts.
        </p>
      }
    >
      <div className="mb-5">
        <Label className="text-xs text-muted-foreground mb-2 block">Log in as</Label>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((r) => {
            const Icon = r.icon;
            const active = selectedRole === r.value;
            return (
              <button
                type="button"
                key={r.value}
                onClick={() => { setSelectedRole(r.value); setError(""); }}
                className={`flex items-center gap-2 px-2.5 py-2.5 rounded-lg border text-left transition-colors ${
                  active ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="leading-tight">
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{r.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading || !selectedRole}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}