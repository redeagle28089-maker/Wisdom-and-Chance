import { Link } from "wouter";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground max-w-sm mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild data-testid="button-go-home">
        <Link href="/">
          <Home className="h-4 w-4 mr-2" />
          Go to Dashboard
        </Link>
      </Button>
    </div>
  );
}
