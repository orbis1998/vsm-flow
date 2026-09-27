# VSM Flow

Crée un nouveau projet web nommé “VSM Business Suite”.

OBJECTIF
Construire une première version complète d’un ERP / Business Suite professionnel pour gérer une activité de commerce et de livraison, avec VSM Collection comme première entreprise utilisatrice. L’application doit être fonctionnelle avec des données MOCKÉES uniquement pour cette première étape. Ne configure pas encore de vraie base PostgreSQL/Supabase et ne demande pas de paiement en ligne.

IMPORTANT
- Architecture propre et modulaire, pensée dès maintenant pour remplacer facilement les mock data par une API/backend PostgreSQL/Supabase plus tard.
- Ne pas construire uniquement des écrans statiques : les interactions principales doivent fonctionner avec l’état local/mock data.
- Prévoir des types/interfaces de données clairs et des services mock séparés des composants UI.
- Ne pas inventer de fonctionnalités hors périmètre.
- Interface en français.
- Desktop-first mais responsive mobile.
- Design logiciel professionnel, sobre et premium, pas d’apparence de template IA.

IDENTITÉ VISUELLE
VSM Collection : noir, blanc et rouge comme couleur d’accent.
- Fond principal blanc / gris très clair.
- Texte noir.
- Rouge VSM pour les actions principales, statuts importants et accents.
- Sidebar moderne sombre ou blanche très sobre.
- Cartes propres, bordures fines, rayons modérés.
- Tableaux professionnels avec pagination, recherche et filtres.
- Beaucoup d’espace blanc.
- Graphiques sobres.
- Typographie moderne et lisible.
- Pas de gradients criards, pas de glassmorphism, pas d’animations excessives.
- Logo/wordmark textuel “VSM Business Suite” dans la sidebar si aucun logo fourni.

STRUCTURE DE NAVIGATION
Sidebar :
1. Dashboard
2. Commandes
3. Produits
4. Stock
5. POS / Ventes
6. Logistique
7. Clients
8. Fournisseurs & achats
9. Finance
10. Rapports
11. Utilisateurs
12. Paramètres

HEADER
- Recherche globale
- Notifications
- Sélecteur d’établissement/poste si nécessaire
- Profil utilisateur
- Menu mobile responsive

RÔLES
Créer une logique de permissions côté front mockée :
ADMIN : accès total.
GÉRANT : gestion opérationnelle selon permissions.
LIVREUR : uniquement commandes assignées, livraison, scan et ventes autorisées.
Préparer le modèle pour ajouter CAISSIER, MAGASINIER, COMPTABLE, RESPONSABLE LOGISTIQUE plus tard.
Créer une page Utilisateurs avec rôles, statut, permissions et historique des actions.

1. DASHBOARD
Créer un dashboard réaliste avec :
- Chiffre d’affaires
- Ventes du jour
- Commandes du jour
- Commandes en livraison
- Argent à recevoir
- Stock faible
- Dépenses
- Marge
- Graphique ventes sur période
- Répartition des commandes par statut
- Activité récente
- Alertes importantes
Les chiffres doivent venir du mock store, pas être écrits en dur directement dans les composants.

2. PRODUITS & CATALOGUE
Créer :
- Liste produits avec recherche, filtres, tri et pagination
- Création / modification / suppression
- Catégories et sous-catégories
- Marques
- Variantes : taille, couleur, modèle
- SKU
- Prix d’achat
- Prix de vente
- Prix promotionnel
- Stock minimum
- Stock disponible
- Stock réservé
- Stock vendu
- Fournisseur
- Photos placeholder
- Description
- Unité de mesure
- Date d’expiration
- Numéro de lot
- Code-barres généré automatiquement
- Code-barres personnalisé
- Consultation du code-barres
Créer une fiche produit détaillée avec variantes et historique des mouvements.

3. STOCK
Pages/sections :
- Vue stock
- Entrées
- Sorties
- Transferts
- Ajustements
- Inventaires
- Produits endommagés
- Produits perdus
- Produits expirés
- Alertes stock faible
- Historique complet des mouvements
- Valorisation du stock
Chaque mouvement doit avoir référence, produit, quantité, type, utilisateur, date et note.

4. COMMANDES
Créer une liste de commandes avec :
- Référence
- Client
- Téléphone
- Adresse
- Commune
- Zone/quartier
- Référence/adresse détaillée
- Produits
- Quantités
- Prix unitaires
- Réductions
- Total produits
- Frais de livraison saisis manuellement
- Total à recevoir
- Notes
- Statut
- Livreur assigné
- Date/heure
- Historique de commande
Créer page détail commande avec timeline des changements de statut.
Statuts : nouvelle, à préparer, prête, assignée, en livraison, livrée, échec, retour, annulée.
Inclure les 24 communes de Kinshasa dans les données mockées et un jeu réaliste de zones/quartiers sélectionnables par commune. Ne pas utiliser une API externe pour cette première version.

5. LOGISTIQUE
Créer un tableau de suivi :
- À préparer
- Prêtes
- Assignées
- En livraison
- Livrées
- Échec
- Retours
Permettre l’assignation/réassignation d’un livreur.
Créer une fiche livreur avec historique, commandes, livraisons réussies/échouées et performances.

6. APPLICATION / ESPACE LIVREUR
Créer une vue dédiée simulant l’interface du rôle LIVREUR.
Le livreur ne voit que :
- commandes assignées
- détails client
- produits
- montant à collecter
- frais de livraison
- zone
- référence
- statut
- confirmation de livraison
- signature/preuve simulée
- scan code-barres simulé
- vente directe au poste si autorisée
Créer une navigation mobile adaptée au livreur.

IMPORTANT : aucun paiement électronique. Le système enregistre seulement les montants et leur état. Paiement manuel uniquement.

7. POS / VENTES
Créer un vrai écran POS fonctionnel avec mock data :
- recherche produit
- scan code-barres simulé
- ajout au panier
- modification quantité
- remise
- client
- total
- vente comptant/manuelle
- ticket de vente
- confirmation
- décrémentation du stock dans le mock store
- historique des ventes
Prévoir contrôle d’accès : ADMIN, GÉRANT et LIVREUR autorisé.

8. FINANCE / COMPTABILITÉ
Créer des écrans de synthèse pour :
- Chiffre d’affaires
- Ventes
- Dépenses
- Achats
- Pertes
- Retours
- Créances
- Argent encaissé
- Argent à recevoir
- Frais de livraison
- Charges
- Bénéfices
- Marges
- Mouvements financiers
- Caisse
- Clôture de caisse
- Rapports journaliers / mensuels
- Export mocké
Créer tableaux et graphiques cohérents avec les données mockées.

9. FOURNISSEURS & ACHATS
Créer :
- Liste fournisseurs
- Fiche fournisseur
- Commandes fournisseurs
- Réception marchandises
- Prix d’achat
- Dettes fournisseurs
- Historique d’achat
- Réception qui ajoute les quantités au stock mocké
Créer quelques fournisseurs fictifs réalistes.

10. CLIENTS
Créer :
- Liste clients
- Recherche
- Fiche client
- Historique commandes
- Historique achats
- Montants dépensés
- Adresse
- Téléphone
- Notes
- Indicateur client régulier

11. RAPPORTS
Créer une page rapports avec filtres de période et rapports :
- ventes
- commandes
- stock
- livraisons
- produits
- clients
- finances
Les exports peuvent être simulés dans cette première version.

12. PARAMÈTRES
Créer :
- entreprise
- établissement
- postes de vente
- utilisateurs / permissions
- statuts
- paramètres de livraison
- communes/zones
- préférences système

MODÈLE DE DONNÉES MOCK
Créer des types propres pour au minimum :
User, Role, Permission, Product, ProductVariant, Category, Brand, Supplier, PurchaseOrder, PurchaseItem, StockMovement, Customer, Order, OrderItem, Delivery, DeliveryDriver, Sale, SaleItem, Expense, CashSession, FinancialTransaction, Notification, AuditLog, DeliveryZone.
Utiliser des IDs, dates, statuts et relations cohérents.

DONNÉES DE DÉMONSTRATION
Précharger assez de données pour que l’application ressemble à un système réellement utilisé :
- 20+ produits VSM fictifs
- variantes de tailles/couleurs
- plusieurs catégories
- plusieurs fournisseurs
- 30+ clients
- 30+ commandes
- plusieurs livreurs
- ventes POS
- mouvements de stock
- dépenses et transactions
- notifications
- logs d’activité
Les données doivent être cohérentes entre dashboard, commandes, stock, POS et finance.

UX
- Tous les boutons principaux doivent avoir une action.
- Modales/drawers pour création et édition quand pertinent.
- Toasts de confirmation/erreur.
- États loading, empty et error.
- Confirmation avant suppression ou action destructive.
- Recherche et filtres réellement fonctionnels sur les listes.
- Navigation entre liste → détail → édition.
- Responsive.

ARCHITECTURE
Utiliser React + TypeScript + Tailwind + shadcn/ui selon le stack natif Lovable.
Organiser proprement :
- pages/routes
- components
- types
- mock data
- mock services/store
- utils
- hooks
Éviter de mettre toutes les données dans App.tsx.
Préparer les services avec une interface facilement remplaçable par Supabase/API plus tard.

LIVRABLE
Construis directement cette première version complète et navigable de VSM Business Suite. Priorité à la cohérence globale, aux flux fonctionnels et à une UI professionnelle plutôt qu’à des effets visuels.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/245a9e7c-4286-420b-b62d-2de9c046842b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
