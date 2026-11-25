export function Logo({ size = "md", onRed = false }: { size?: "md" | "lg"; onRed?: boolean }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`${onRed ? "bg-wina-black" : "bg-wina-red"} -skew-x-12 ${big ? "px-3 py-1 text-3xl sm:text-4xl" : "px-2 py-0.5 text-lg sm:text-xl"} h-display`}>
        <span className="inline-block skew-x-12">Wina</span>
      </span>
      <span className={`h-display ${big ? "text-3xl sm:text-4xl" : "text-lg sm:text-xl"}`}>LoL Pronos</span>
    </span>
  );
}
