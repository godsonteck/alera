import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="alera-care-backdrop flex min-h-screen items-center justify-center px-6">
      <div className="max-w-lg rounded-3xl border border-border bg-background p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="mt-3 text-xl text-muted-foreground">That page doesn’t exist anymore or the link is incorrect.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Return home
          </Link>
          <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
