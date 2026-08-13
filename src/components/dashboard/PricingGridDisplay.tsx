import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatPrice } from "@/lib/clinic";
import { useQuery } from "convex/react";

export function PricingGridDisplay() {
  const grid = useQuery(api.settings.pricingGrid);

  if (!grid) return null;

  return (
    <Card className="p-6 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
      <h3 className="text-lg font-semibold mb-4">Tarifs de consultation</h3>
      <div className="space-y-3">
        {grid.generaliste != null && (
          <div className="flex justify-between text-sm">
            <span className="font-medium">Docteur Généraliste</span>
            <span>{formatPrice(grid.generaliste)}</span>
          </div>
        )}
        {grid.specialiste != null && (
          <div className="flex justify-between text-sm">
            <span className="font-medium">Docteur Spécialiste</span>
            <span>{formatPrice(grid.specialiste)}</span>
          </div>
        )}
        {grid.professeur != null && (
          <div className="flex justify-between text-sm">
            <span className="font-medium">Professeur</span>
            <span>{formatPrice(grid.professeur)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
