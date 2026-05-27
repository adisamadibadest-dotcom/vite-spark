import { Component, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Landing } from "@/routes/index";
import { AuthPage } from "@/routes/login";
import { ForgotPasswordPage } from "@/routes/forgot-password";
import { ResetPasswordPage } from "@/routes/reset-password";
import { ApexDashboard } from "@/components/ApexDashboard";

const queryClient = new QueryClient();

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
            <h2 className="text-sm font-bold text-foreground">Something went wrong</h2>
            <p className="text-xs text-muted-foreground font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">Page not found.</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={base}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ApexDashboard />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
        <Toaster richColors theme="dark" position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
