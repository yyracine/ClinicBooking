# Task 5: Create PricingGridManager component (admin UI)

**Location in plan:** Task 5  
**Depends on:** Task 4 (settings mutations) — in progress  
**Effort:** 15 minutes

Create a new admin component to view and edit the 3-category pricing grid.

## What You're Doing

Create a new file: `src/components/dashboard/PricingGridManager.tsx`

This component:
- Queries the current pricing grid using `api.settings.pricingGrid`
- Displays 3 number inputs (one per category)
- Validates that all values are positive integers
- Saves changes via `api.settings.updatePricingGrid` mutation
- Shows success/error toasts
- Disables the button if any price is invalid

## Complete Component Code

Write this complete component to `src/components/dashboard/PricingGridManager.tsx`:

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function PricingGridManager() {
  const grid = useQuery(api.settings.pricingGrid);
  const updateGrid = useMutation(api.settings.updatePricingGrid);

  const [generaliste, setGeneraliste] = useState<string>("");
  const [specialiste, setSpecialiste] = useState<string>("");
  const [professeur, setProfesseur] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Populate fields when grid loads
  useEffect(() => {
    if (grid) {
      setGeneraliste(String(grid.generaliste));
      setSpecialiste(String(grid.specialiste));
      setProfesseur(String(grid.professeur));
    }
  }, [grid]);

  // Validation: check if a value is a valid positive integer
  const isValid = (val: string) => {
    const n = Number(val);
    return Number.isInteger(n) && n > 0;
  };

  const allValid = isValid(generaliste) && isValid(specialiste) && isValid(professeur);

  const handleSave = async () => {
    if (!allValid) {
      toast.error("Tous les prix doivent être des nombres positifs");
      return;
    }

    setIsLoading(true);
    try {
      await updateGrid({
        generaliste: Number(generaliste),
        specialiste: Number(specialiste),
        professeur: Number(professeur),
      });
      toast.success("Grille tarifaire mise à jour");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la sauvegarde",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Grille tarifaire</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Docteur Généraliste
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={generaliste}
              onChange={(e) => setGeneraliste(e.target.value)}
              placeholder="10000"
              className={!isValid(generaliste) && generaliste ? "border-red-500" : ""}
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">FCFA</span>
          </div>
          {!isValid(generaliste) && generaliste && (
            <p className="text-xs text-red-500 mt-1">Prix invalide</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Docteur Spécialiste
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={specialiste}
              onChange={(e) => setSpecialiste(e.target.value)}
              placeholder="20000"
              className={!isValid(specialiste) && specialiste ? "border-red-500" : ""}
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">FCFA</span>
          </div>
          {!isValid(specialiste) && specialiste && (
            <p className="text-xs text-red-500 mt-1">Prix invalide</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Professeur</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={professeur}
              onChange={(e) => setProfesseur(e.target.value)}
              placeholder="30000"
              className={!isValid(professeur) && professeur ? "border-red-500" : ""}
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">FCFA</span>
          </div>
          {!isValid(professeur) && professeur && (
            <p className="text-xs text-red-500 mt-1">Prix invalide</p>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={!allValid || isLoading}
          className="w-full"
        >
          {isLoading ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </Card>
  );
}
```

## Steps

1. Create file: `touch src/components/dashboard/PricingGridManager.tsx`
2. Paste the complete component code above into the file
3. Run: `bun tsc -b --noEmit` (should have no errors)
4. Commit: `git add src/components/dashboard/PricingGridManager.tsx && git commit -m "feat: add PricingGridManager component for admin pricing grid UI"`

## Report

Write your report to: `.superpowers/sdd/task-5-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: no errors, component created and type-safe"
