import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatPrice } from "@/lib/clinic";
import { DEFAULT_PRICING_GRID } from "@/lib/pricing";
import { useQuery } from "convex/react";

export function PricingGridDisplay() {
  const grid = useQuery(api.settings.pricingGrid);
  const displayGrid = grid || DEFAULT_PRICING_GRID;

  return (
    <Card className="p-6 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
      <h3 className="text-lg font-semibold mb-4">Tarifs de consultation</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Docteur Généraliste</span>
          <span>{formatPrice(displayGrid.generaliste ?? DEFAULT_PRICING_GRID.generaliste)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Docteur Spécialiste</span>
          <span>{formatPrice(displayGrid.specialiste ?? DEFAULT_PRICING_GRID.specialiste)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Professeur</span>
          <span>{formatPrice(displayGrid.professeur ?? DEFAULT_PRICING_GRID.professeur)}</span>
        </div>
      </div>
    </Card>
  );
}
