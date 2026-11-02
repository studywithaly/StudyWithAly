# Atlas 3D — état des lieux et périmètre

## Projet existant
Inspection du dépôt studywithaly/StudyWithAly, branche main le 2 novembre 2026.
Application statique HTML/CSS/JavaScript ; styles et routeur App.aller dans index.html.
learning.js étend déjà le routeur et les fonctions d'apprentissage. Firebase compat 10.12.2 assure authentification et Firestore ; fonctions Netlify pour les données protégées et Stripe.
Netlify publie la racine après npm install. Le service worker ne met en cache que la page hors ligne. Aucun framework React ou pipeline frontend existant.

## Intégration
Atlas accessible dans le rail de navigation et dans le menu mobile Plus. atlas.js est chargé après learning.js et préserve son routeur. Le moteur Three.js est importé à la demande ; aucun modèle n'est chargé avant l'ouverture de l'Atlas. Les fichiers de la bibliothèque sont hébergés localement pour éviter une dépendance CDN à l'exécution.
Les données pédagogiques (atlas/data.mjs), le moteur (atlas/engine.mjs), l'interface (atlas/app.mjs), et le registre des modèles sont séparés.
Les modèles sont chargés à concurrence limitée à 3. À la sortie, les requêtes sont annulées, les contrôles détachés et les géométries, matériaux et ressources GPU libérés. Rendu à la demande, résolution plafonnée à 1,75.
La progression utilise U.atlasProgress puis sauver(), comme les révisions existantes. Les règles Firestore et les fonctions de paiement sont inchangées. Une vérification sur un compte connecté est nécessaire pour confirmer l'enregistrement effectif dans le projet déployé.

## Collection initiale et limites
35 objets BodyParts3D 4.0, groupés en 19 structures pédagogiques (bilatérales quand applicable). Le nerf vague dispose d'une fiche seule ; aucun faux nerf n'est dessiné. Tous les systèmes corporels restent à intégrer. Les gyri et la substance blanche fournis ne constituent pas un cortex complet.
Rotation, zoom, déplacement, raycasting des triangles visibles, surbrillance, info-bulles, sélection tactile, fiches, recherche multilingue, filtres, visibilité/opacité, isolation, exploration profonde et masquage d'un côté sont implémentés.
Les plans de coupe enlèvent une partie des surfaces sans reconstruire le tissu interne ni fermer la section. Pas de vue éclatée, tractographie, animation physiologique, LOD dynamique, compression GLB/Draco, ni catalogue neuroanatomique complet. Les modèles OBJ d'origine sont simplifiés et servis avec la compression HTTP de l'hébergeur.
Découverte, apprentissage (info-bulles), révision sans nom au survol, quiz d'identification et un parcours de repérage initial sont présents. Pas de simulation des connexions nerveuses.
Les fiches sont initiales : les champs vasculaires et d'innervation non rédigés ne sont pas inventés. Une revue anatomique indépendante et l'enrichissement des références sont requis avant de présenter cette collection comme un atlas professionnel complet.

## Licence et import
Attribution et licence actuelle de l'archive officielle conservées dans atlas/ATTRIBUTION.txt. Le registre conserve identifiants de fichiers, FMA, version, côté anatomique et empreinte de chaque original.
scripts/import-anatomy.mjs extrait les entrées OBJ originales par plages HTTP depuis l'archive officielle. Il utilise les tables parts et elements, et l'index ZIP externe préparé pendant l'import. Aucun déplacement, redimensionnement individuel ni géométrie artificielle.

## Livraison
Changements préparés sur feat/anatomy-atlas. Vérifier les tests, l'aperçu visuel et la PR avant fusion vers main qui peut déclencher Netlify.
