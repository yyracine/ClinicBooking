# Spécification : Consentement Explicite aux Rappels Multi-Canaux

**Date** : 2026-08-11  
**Auteur** : Claude Code  
**Statut** : En attente de validation

---

## 1. Vue d'Ensemble

### Objectif
Ajouter un système de consentement explicite et modifiable permettant aux patients de contrôler les canaux par lesquels ils reçoivent les rappels de rendez-vous (e-mail, SMS, notification in-app).

### Contexte
- Les patients actuels reçoivent des rappels multi-canaux (e-mail, SMS, in-app) sans consentement explicite
- Les rappels par e-mail sont **non chiffrés** — risque de divulgation d'informations sensibles (nom, date/heure de RDV)
- Le projet respecte les bonnes pratiques de conformité : obtenir un consentement éclairé et révocable
- Les paiements se font à la clinique **avant** la consultation, déclenchant confirmations et rappels

### Principes
- **Opt-in explicite** : aucun rappel tant que le patient n'a pas coché sa préférence
- **Modifiable à tout moment** : le patient change d'avis sans friction
- **Pas de blocage** : refuser tous les canaux n'empêche pas la réservation ni l'accès au dossier
- **Dégradation gracieuse** : si aucun canal n'est accepté, in-app est le fallback par défaut

---

## 2. Exigences Fonctionnelles

### 2.1 Modèle de Données

#### Ajouter à la table `patientProfiles` (schema.ts)

Trois champs booléens pour capturer le consentement :

```typescript
consentEmailReminders: v.optional(v.boolean()),   // Rappels par e-mail
consentSmsReminders: v.optional(v.boolean()),     // Rappels par SMS
consentInAppReminders: v.optional(v.boolean()),   // Notifications in-app
```

**Défaut** : `undefined` (aucun consentement), traité comme `false` en logique métier.

**Raison du `v.optional`** : rétrocompatibilité avec les profils existants (créés avant cette feature).

### 2.2 Interface Utilisateur

#### Localisation 1 : Formulaire de Création du Dossier Patient

Composant : `src/components/dashboard/PatientProfileForm.tsx`

**Où** : Nouvelle section "Préférences de communication" après les données personnelles (contact, adresse).

**Contenu** :
```
┌─ Préférences de communication ─────────────────────────────────┐
│                                                                │
│ ☐ E-mail non chiffré                                           │
│   J'accepte de recevoir des rappels de rendez-vous par e-mail  │
│   non chiffré et je suis informé des risques.                  │
│                                                                │
│ ☐ SMS                                                          │
│   J'accepte de recevoir des rappels par SMS.                   │
│                                                                │
│ ☐ Notifications in-app                                         │
│   J'accepte les notifications in-app.                          │
│                                                                │
│ ℹ️ Si vous refusez e-mail et SMS, vous recevrez toujours les  │
│    notifications in-app. Pour les confirmations et rappels.    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Requête** : Aucun des trois n'est obligatoire. Le patient crée un dossier sans consentement → tous les rappels sont in-app par défaut.

#### Localisation 2 : Édition du Profil Patient

Même section, même composant réutilisé.  
Cases **préremplies** avec le choix actuel du patient.  
Modification et sauvegarde sans friction.

### 2.3 Logique métier : Envoi des Rappels

#### Modifie : `src/convex/emails.ts`

Fonction : `sendAppointmentReminder(ctx, args)`

**Flux actuel** (simplifié) :
```typescript
// 1. Lire le dossier patient
const profile = await ctx.runQuery(internal.records.getPatientRecord, { userId });

// 2. Construire le message
const message = buildReminderMessage(appointment, daysBefore);

// 3. Envoyer e-mail
if (ELASTICEMAIL_API_KEY) {
  await sendEmail(profile.email, message);
}

// 4. Envoyer SMS
if (TWILIO_ACCOUNT_SID) {
  await sendSms(profile.phone, message);
}

// 5. Créer notification in-app
await ctx.runMutation(internal.notifications.create, { ... });
```

**Nouveau flux** :
```typescript
// 1. Lire le dossier patient
const profile = await ctx.runQuery(internal.records.getPatientRecord, { userId });

// 2. Construire le message
const message = buildReminderMessage(appointment, daysBefore);

// 3. Envoyer e-mail (si consentement)
if (
  profile.consentEmailReminders === true &&
  ELASTICEMAIL_API_KEY
) {
  await sendEmail(profile.email, message);
}

// 4. Envoyer SMS (si consentement)
if (
  profile.consentSmsReminders === true &&
  TWILIO_ACCOUNT_SID
) {
  await sendSms(profile.phone, message);
}

// 5. Créer notification in-app (si consentement, OU toujours si aucun canal accepté)
if (
  profile.consentInAppReminders === true ||
  (!profile.consentEmailReminders && !profile.consentSmsReminders)
) {
  await ctx.runMutation(internal.notifications.create, { ... });
}
```

**Cas limites** :
- Profil sans consentement stocké (`undefined`) → traiter comme `false`
- Aucun consentement donné → in-app par défaut
- Plusieurs consentements → tous les canaux acceptés reçoivent le message

#### Modifie : `src/convex/emails.ts` → `sendAppointmentConfirmation()`

**Même logique** : respecter les consentements dès la confirmation de paiement.

### 2.4 Mutations et Queries

#### Mutation Existante : `updatePatientProfile`

Ajouter les trois champs aux paramètres de mise à jour :

```typescript
updatePatientProfile(args: {
  // ... champs existants ...
  consentEmailReminders?: boolean;
  consentSmsReminders?: boolean;
  consentInAppReminders?: boolean;
})
```

#### Query Existante : `getPatientRecord`

Retourner les trois champs de consentement pour que le frontend puisse afficher l'état actuel.

---

## 3. Architecture et Conception

### 3.1 Flux de Consentement

```
Patient crée/édite profil
  ↓
Formulaire affiche 3 cases (préremplies si édition)
  ↓
Patient coche ses préférences
  ↓
Mutation updatePatientProfile(consentEmail, consentSms, consentInApp)
  ↓
Persiste en BDD (patientProfiles)
  ↓
Lors du prochain rappel : logique emails.ts consulte ces flags
```

### 3.2 Flux de Rappel (Impact)

```
recordPayment (ou recordMobilePayment)
  ↓
ctx.scheduler.runAfter(0, api.emails.sendAppointmentConfirmation, { userId, ... })
ctx.scheduler.runAt(T, api.emails.sendAppointmentReminder, { appointmentId, daysBefore: 7 })
  ↓
sendAppointmentReminder/Confirmation
  ├─ Lit patientProfiles.consentEmailReminders
  ├─ Lit patientProfiles.consentSmsReminders
  ├─ Lit patientProfiles.consentInAppReminders
  └─ Envoie uniquement si consentement = true
       ↓
       Aucun consentement → in-app par défaut
```

### 3.3 Rétrocompatibilité

**Profils existants** (créés avant cette feature) :
- Champs `consentXxx` sont `undefined`
- Traité comme `false` en logique métier
- Ancien comportement **s'arrête** (pas de rappels jusqu'à consentement explicite)
- Patient doit éditer son profil pour activer les rappels
- In-app toujours activé par défaut pour ces profils

**Rationale** : Protection des données — pas de consentement rétroactif.

---

## 4. Composants Affectés

| Fichier                              | Modification                                                  |
|--------------------------------------|---------------------------------------------------------------|
| `src/convex/schema.ts`               | Ajouter 3 champs `consentXxx` à `patientProfiles`             |
| `src/convex/records.ts`              | Ajouter/mettre à jour `updatePatientProfile` mutation         |
| `src/convex/emails.ts`               | Vérifier consentements avant chaque envoi (rappel + confirm)  |
| `src/components/dashboard/PatientProfileForm.tsx` | Ajouter section "Préférences de communication" + 3 cases      |

---

## 5. Testing

### Unit Tests

**File** : `src/lib/consent.test.ts` (nouveau)

Fonctions utilitaires de logique de consentement (si déportées) :

```typescript
describe("Consent logic", () => {
  it("sends email if consent is true and key is set", () => { ... });
  it("skips email if consent is false", () => { ... });
  it("defaults to in-app if no consent given", () => { ... });
  it("treats undefined as false (backward compat)", () => { ... });
});
```

### Integration Tests

**Dans** : `src/convex/emails.test.ts` (existant, à compléter)

- Vérifier que `sendAppointmentReminder` respecte les flags de consentement
- Tester les cas limites : `undefined`, tous `false`, mix de consentements

### Manual Testing (UI)

1. **Création profil** : cocher/décocher les 3 cases, créer, vérifier les valeurs en BDD
2. **Édition profil** : modifier les consentements, recharger l'UI, vérifier la sauvegarde
3. **Rappel** : créer un RDV, enregistrer paiement, vérifier que seuls les canaux acceptés reçoivent le message
4. **Dégradation** : refuser tous les canaux, vérifier que in-app est le fallback

---

## 6. Points Clés de Conformité

1. **Consentement explicite** : cases décochées par défaut, pas d'opt-out après opt-in passif
2. **Message clair** : wording exact fourni, risques mentionnés pour l'e-mail
3. **Révocabilité** : patient change d'avis à tout moment via édition profil
4. **Audit** : aucune mutation spéciale requise (updatePatientProfile loggée par défaut)
5. **Rétrocompatibilité sûre** : profils anciens traités comme "pas de consentement"

---

## 7. Limitations et Cas Non Couverts

- **SMS sans numéro** : si `consentSmsReminders = true` mais `profile.phone` absent → SMS non envoyé, pas d'erreur
- **E-mail invalide** : si `consentEmailReminders = true` mais `profile.email` absent → e-mail non envoyé, pas d'erreur
- **Consentement tiers** : seul le patient peut gérer son propre consentement (pas de proxy via staff)
- **Historique** : pas de trace des modifications de consentement (audit trail non implémentée, mais updatePatientProfile peut être ajoutée à activityLogs si nécessaire)

---

## 8. Acceptance Criteria

- [ ] Schema : 3 champs ajoutés à `patientProfiles`
- [ ] UI : section "Préférences de communication" visible en création ET édition
- [ ] Logique : `sendAppointmentReminder` et `sendAppointmentConfirmation` respectent les consentements
- [ ] Rétrocompat : profils anciens sans consentement → in-app par défaut
- [ ] Tests : unit + intégration couvrent tous les cas de consentement
- [ ] Manual : vérifier création/édition/rappels avec différentes combinaisons

---

## 9. Dépendances

- Aucune dépendance externe
- Convex types générés après schema.ts modifié
- Frontend peut réutiliser `PatientProfileForm` existant

