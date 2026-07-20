# TaxiCI+ — Politique de confidentialité et de protection des données personnelles

**⚠️ Statut : projet de document de travail.** Ce document pose une base structurée
mais **doit être relu et validé par un conseil juridique ivoirien** avant toute
publication officielle ou collecte de données à grande échelle. Il ne constitue pas
un avis juridique.

## 1. Responsable du traitement

À compléter : dénomination légale de l'entreprise exploitant TaxiCI+, adresse à
Abidjan, contact dédié aux questions de protection des données (ex. un email
`donnees@taxici-plus.ci`).

## 2. Cadre applicable

La Côte d'Ivoire encadre la protection des données personnelles sous l'autorité de
l'**ARTCI** (Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire),
via la loi n°2013-450 relative à la protection des données à caractère personnel.
Selon le volume et la nature des données traitées, une **déclaration ou une
autorisation préalable auprès de l'ARTCI** peut être requise avant le lancement
public de TaxiCI+ — point à vérifier formellement avant la mise en production.

## 3. Données collectées

| Catégorie | Exemples | Finalité |
|---|---|---|
| Identité | Nom complet, numéro de téléphone | Création de compte, authentification par OTP |
| Localisation | Position GPS (départ, destination, position chauffeur en temps réel) | Mise en relation, calcul du tarif, suivi de course |
| Documents chauffeur (KYC) | Permis de conduire, carte grise, assurance | Vérification légale avant mise en ligne |
| Transactionnel | Historique de courses, montants, moyen de paiement | Facturation, litiges, statistiques |
| Technique | Adresse IP, journaux de connexion | Sécurité, prévention de la fraude |

TaxiCI+ ne collecte **pas** de données sensibles au sens large (santé, opinions
politiques/religieuses, origine ethnique) et n'en a pas besoin pour fonctionner.

## 4. Base légale et durée de conservation

- **Compte utilisateur actif** : conservé tant que le compte est actif.
- **Historique de courses** : à conserver pour une durée définie en cohérence avec
  les obligations comptables et fiscales ivoiriennes (à faire valider — souvent de
  l'ordre de plusieurs années pour les documents commerciaux).
- **Position GPS en temps réel** (`drivers.current_lat/current_lng`) : donnée
  vivante, écrasée à chaque mise à jour — aucun historique de trajet complet n'est
  conservé au-delà des points de départ/arrivée déjà nécessaires à la course
  elle-même.
- **Codes OTP** : expirent après 5 minutes (voir `otp_codes.expires_at`), purge
  recommandée par tâche planifiée au-delà de 24h.

## 5. Partage des données

- **Fournisseurs de paiement** (Wave, Orange Money, MTN MoMo) : reçoivent le
  numéro de téléphone et le montant nécessaires à la transaction, dans le cadre de
  leurs propres politiques de confidentialité.
- **Aucune vente ni partage à des fins publicitaires.**
- **Autorités compétentes** : uniquement sur réquisition légale.

## 6. Droits des utilisateurs

Conformément aux principes de protection des données personnelles, chaque
utilisateur dispose de :

- **Droit d'accès** : `GET /api/me/data` — export complet des données détenues.
- **Droit à l'effacement** : `DELETE /api/me` — anonymisation des données
  identifiantes (voir note technique ci-dessous).
- **Droit de rectification** : via `PUT /api/drivers/me` pour les chauffeurs, ou en
  contactant le support pour les passagers.

### Note technique sur l'effacement

Par souci de conformité comptable, la suppression n'efface pas les lignes de course
(nécessaires en cas de litige ou de contrôle fiscal) mais **anonymise** les champs
identifiants (téléphone, nom) — voir `privacyController.deleteMyAccount`. La durée
exacte de conservation post-anonymisation reste à formaliser juridiquement.

## 7. Sécurité

Voir également le journal des mesures techniques dans `SECURITY.md` : mots de passe
hashés, connexions chiffrées (HTTPS en production), vérification de signature des
webhooks de paiement, limitation du taux de requêtes.

## 8. Contact

À compléter avec un email et/ou un numéro dédié aux demandes liées aux données
personnelles.

## 9. Prochaines étapes recommandées avant lancement public

1. Faire valider ce document par un avocat ivoirien spécialisé en droit du
   numérique.
2. Vérifier auprès de l'ARTCI si une déclaration/autorisation est requise.
3. Définir formellement les durées de conservation avec un expert-comptable
   (obligations fiscales ivoiriennes).
4. Ajouter un écran de consentement explicite lors de l'inscription (case à cocher,
   lien vers cette politique).
5. Mettre en place une purge automatique des codes OTP expirés (tâche planifiée).
