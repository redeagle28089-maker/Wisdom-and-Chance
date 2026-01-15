import { Link } from "wouter";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900">
      <div className="rounded-full bg-purple-500/20 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-purple-400" />
      </div>
      <h1 className="text-2xl font-semibold mb-2 text-white">Page Not Found</h1>
      <p className="text-purple-300 max-w-sm mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-go-home">
        <Link href="/">
          <Home className="h-4 w-4 mr-2" />
          Go Home
        </Link>
      </Button>
    </div>
  );
}
