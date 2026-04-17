import { Target } from "lucide-react";

export default function ProspectsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Target className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prospects</h1>
        <p className="text-muted-foreground mt-1 max-w-md">
          Pre-customer pipeline management — track prospect companies, sentiment,
          touch points, and conversion to customer.
        </p>
      </div>
      <div className="mt-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-medium">
        Coming in Bucket 5
      </div>
    </div>
  );
}
