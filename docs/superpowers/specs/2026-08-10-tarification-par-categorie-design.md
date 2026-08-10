# Tarification de la consultation par catégorie de médecin

**Date** : 10 août 2026
**Statut** : approuvé, prêt pour plan d'implémentation

## Contexte

Aujourd'hui, le prix d'une consultation est soit celui du service (spécialité)
choisi, soit un prix personnalisé tapé librement par l'administration sur la
fiche de chaque médecin (`doctors.consultationPrice`, optionnel). Ce prix
personnalisé est donc un simple nombre libre, sans lien avec une logique
tarifaire de la clinique.

Le prix d'une consultation n'est en principe pas une caractéristique propre
au médecin : il est fixé par la clinique selon deux critères :

- le type de pratique — **généraliste** ou **spécialiste** ;
- le grade académique — **médecin** ou **professeur**.

Objectif : que l'administration définisse une **grille tarifaire** couvrant
les 4 combinaisons de ces critères, que chaque médecin soit classé dans une
de ces 4 catégories, et que le prix de consultation en découle
automatiquement — tout en gardant la possibilité de fixer un tarif
exceptionnel pour un médecin ponctuellement sollicité pour une intervention
particulière (tarif différent du reste de sa catégorie).

## Modèle de données

### `services` (schema.ts)

Nouveau champ optionnel :

```ts
isGeneralist: v.optional(v.boolean()), // true uniquement pour "Médecine générale"
```

Aucune interface d'administration n'existe aujourd'hui pour créer/modifier
les services (ils sont fixes, définis dans `seed.ts`) — ce champ est donc
positionné au niveau des données de seed, pas via une nouvelle UI. Seul le
service « Médecine générale » aura `isGeneralist: true` ; tous les autres
comptent comme spécialistes (`isGeneralist` absent ou `false`).

### `doctors` (schema.ts)

Nouveau champ :

```ts
academicRank: v.optional(v.union(v.literal("medecin"), v.literal("professeur"))),
```

Absent (données existantes) → traité comme `"medecin"` par défaut, sans
migration nécessaire (cohérent avec le reste du schéma qui a
`schemaValidation: false`).

Le champ existant `consultationPrice` change de rôle : ce n'est plus le prix
« par défaut » du médecin, mais un **tarif exceptionnel** qui, s'il est
rempli, prime toujours sur la grille (cas d'un médecin sollicité pour une
intervention particulière à un tarif différent de sa catégorie).

### `clinicSettings` (table existante, key/value)

Une seule nouvelle ligne, clé `"pricingGrid"`, valeur = JSON de :

```ts
{
  generalisteMedecin: number;
  generalisteProfesseur: number;
  specialisteMedecin: number;
  specialisteProfesseur: number;
}
```

Suit le même pattern que `STAFF_PASSWORD_KEY` dans `convex/settings.ts`
(fonctions `getPricingGrid` / `setPricingGrid`, mutation réservée au rôle
`staff`).

## Interface

### Fiche médecin (page Médecins, administration)

- **Généraliste / Spécialiste** : affiché en lecture seule (badge/texte),
  déduit automatiquement de `service.isGeneralist`. Pas de champ à remplir.
- **Grade** : nouveau sélecteur obligatoire *Médecin* / *Professeur*, par
  défaut *Médecin*.
- **Prix** : affiché en lecture seule, calculé à partir de la catégorie
  (ex. « Spécialiste · Professeur → 30 000 FCFA »).
- **Tarif personnalisé pour ce médecin** : case à cocher qui, une fois
  activée, fait apparaître le champ de saisie libre existant
  (`consultationPrice`) pour un cas exceptionnel.

### Grille tarifaire (panneau sur la page Médecins)

4 champs modifiables par l'administration :
Généraliste·Médecin, Généraliste·Professeur, Spécialiste·Médecin,
Spécialiste·Professeur.

### Visibilité du prix côté patient

- **Page d'accueil publique** (avant connexion, cartes praticiens) : le prix
  **n'apparaît plus**.
- **Parcours de réservation** (une fois connecté, choix du médecin) : le
  prix **continue d'apparaître** par médecin, pour permettre la comparaison
  avant de choisir.
- **Paiement** : le prix reste affiché, sans changement (nécessaire pour que
  le patient sache combien il doit).

## Logique de calcul du prix

Nouvelle fonction pure dans `src/lib/pricing.ts` (à côté de
`computePatientShare`, donc testée de la même façon) :

```ts
function resolveConsultationPrice(
  doctor: { consultationPrice?: number; academicRank?: "medecin" | "professeur" },
  service: { price: number; isGeneralist?: boolean },
  grid: PricingGrid | null | undefined,
): number
```

Ordre de résolution :

1. `doctor.consultationPrice` rempli → on l'utilise (tarif exceptionnel).
2. Sinon, catégorie = (`service.isGeneralist` ? généraliste : spécialiste) ×
   (`doctor.academicRank ?? "medecin"`) → valeur correspondante dans `grid`.
3. Filet de sécurité : si `grid` est absent/incomplet (ex. juste après la
   mise à jour, avant que l'administration ne l'ait remplie) → repli sur
   `service.price`, comme le comportement actuel. Aucun rendez-vous ne doit
   se retrouver à 0 FCFA par accident.

Tous les points d'appel actuels du pattern
`doctor?.consultationPrice ?? service.price` sont remplacés par un appel à
cette fonction unique, pour que la règle ne soit jamais dupliquée/divergente
entre écrans. Points d'appel concernés (recensés dans le code actuel) :
`src/lib/clinic.ts` (`resolveAppointmentPrice`), `src/convex/appointments.ts`,
`src/convex/payments.ts`, `src/convex/doctors.ts`,
`src/components/dashboard/BookAppointment.tsx`,
`src/components/dashboard/StaffDoctors.tsx`, `src/pages/Landing.tsx`
(retrait de l'affichage du prix, pas de calcul).

## Rétrocompatibilité

- Les rendez-vous déjà payés gardent leur `amountPaid` historique — jamais
  recalculé rétroactivement. Seuls les *futurs* prix affichés/calculés
  suivent la nouvelle règle (comportement déjà en vigueur pour les
  changements de prix aujourd'hui).
- Médecins existants sans `academicRank` → traités comme `"medecin"`.
- Grille tarifaire non encore configurée → repli sur `service.price`.

## Tests

`src/lib/pricing.test.ts` (fichier existant, à compléter) :

- Les 4 combinaisons de catégorie retournent le bon tarif de la grille.
- `doctor.consultationPrice` prime toujours sur la grille quand il est
  rempli.
- Grille absente/incomplète → repli sur `service.price`.
- `academicRank` absent → traité comme `"medecin"`.
- Arrondis/format FCFA cohérents avec le reste de `pricing.ts`.

Vérification manuelle après implémentation (navigateur) :
- Page d'accueil : plus aucun prix affiché sur les cartes praticiens.
- Réservation (connecté) : le prix par médecin s'affiche toujours.
- Admin → fiche médecin : le grade et le service déterminent bien le prix
  affiché ; cocher « tarif personnalisé » permet de le remplacer.
- Admin → grille tarifaire : modifier une valeur met à jour le prix affiché
  des médecins de la catégorie correspondante (sans tarif personnalisé).

## Hors périmètre

- Pas d'interface de gestion des services (création/édition) — seul le
  service « Médecine générale » est marqué généraliste, en dur dans les
  données de seed.
- Pas de recalcul rétroactif des rendez-vous déjà payés.
- Pas de nouvelles catégories au-delà des 4 définies (pas de grade
  supplémentaire type « chef de clinique », etc.) — à ajouter plus tard si
  besoin, hors périmètre actuel.
