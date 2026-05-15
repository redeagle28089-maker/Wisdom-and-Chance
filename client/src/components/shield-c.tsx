import { Shield } from "lucide-react";

interface ShieldCProps {
  className?: string;
}

export function ShieldC({ className = "w-3 h-3" }: ShieldCProps) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: "1em", height: "1em", fontSize: "inherit" }}>
      <Shield className={className} />
      <span
        className="absolute inset-0 flex items-center justify-center font-black text-current leading-none"
        style={{ fontSize: "0.52em", marginTop: "0.05em" }}
        aria-hidden="true"
      >
        C
      </span>
    </span>
  );
}
