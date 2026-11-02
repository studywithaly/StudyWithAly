# Atlas 3D — état des lieux et périmètre

## Projet existant
Inspection du dépôt studywithaly/StudyWithAly, branche main le 2 novembre 2026.
Application statique HTML/CSS/JavaScript ; styles et routeur App.aller dans index.html.
learning.js étend déjà le routeur et les fonctions d'apprentissage. Firebase compat 10.12.2 assure authentification et Firestore ; fonctions Netlify pour les données protégées et Stripe.
Netlify publie la racine. Le build de cette version utilise npm ci puis npm run test:atlas avant publication. Le service worker ne met en cache que la page hors ligne. Aucun framework React ou pipeline frontend existant.

## Intégration
Atlas accessible dans le rail de navigation et dans le menu mobile Plus. atlas.js est chargé après learning.js et préserve son routeur. Le moteur Three.js est importé à la demande ; aucun modèle n'est chargé avant l'ouverture de l'Atlas. Les fichiers de la bibliothèque sont hébergés localement pour éviter une dépendance CDN à l'exécution.
Les données pédagogiques (atlas/data.mjs), le moteur (atlas/engine.mjs), l'interface (atlas/app.mjs), et le registre des modèles sont séparés.
Les modèles sont chargés à concurrence limitée à 3. À la sortie, les requêtes sont annulées, les contrôles détachés et les géométries, matériaux et ressources GPU libérés. Rendu à la demande, résolution plafonnée à 1,75.
La progression conserve U.atlasProgress mais écrit uniquement atlasProgress.<structure> dans le document users/<uid>, avec merge:true. Le statut de réussite attend la confirmation Firestore ; les refus et erreurs réseau proposent de réessayer. Une réponse tardive après changement de compte ne modifie pas le nouveau compte. Le stockage local utilise la sauvegarde existante. Les règles Firestore et les fonctions de paiement sont inchangées.

## Collection initiale et limites
35 objets BodyParts3D 4.0, groupés en 19 structures pédagogiques (bilatérales quand applicable). Le nerf vague dispose d'une fiche seule ; aucun faux nerf n'est dessiné. Tous les systèmes corporels restent à intégrer. Les gyri et la substance blanche fournis ne constituent pas un cortex complet.
Rotation, zoom, déplacement, raycasting des triangles visibles, surbrillance, info-bulles, sélection tactile, fiches, recherche multilingue, filtres, visibilité/opacité, isolation, exploration profonde et masquage d'un côté sont implémentés.
Les plans de coupe enlèvent une partie des surfaces sans reconstruire le tissu interne ni fermer la section. Pas de vue éclatée, tractographie, animation physiologique, LOD dynamique, compression GLB/Draco, ni catalogue neuroanatomique complet. Les modèles OBJ d'origine sont simplifiés et servis avec la compression HTTP de l'hébergeur.
Découverte, apprentissage (info-bulles), révision sans nom au survol, quiz d'identification et un parcours de repérage initial sont présents. Pas de simulation des connexions nerveuses.
Les fiches sont initiales : les champs vasculaires et d'innervation non rédigés ne sont pas inventés. Une revue anatomique indépendante et l'enrichissement des références sont requis avant de présenter cette collection comme un atlas professionnel complet.

## Licence et import
Attribution et licence actuelle de l'archive officielle conservées dans atlas/ATTRIBUTION.txt. Le registre conserve identifiants de fichiers, FMA, version, côté anatomique et empreinte de chaque original.
scripts/import-anatomy.mjs extrait les entrées OBJ originales par plages HTTP depuis l'archive officielle. Il télécharge si nécessaire les tables parts et elements et reconstruit automatiquement l'index ZIP par plages HTTP. Aucun déplacement, redimensionnement individuel ni géométrie artificielle.

## Livraison
Changements préparés sur feat/anatomy-atlas. Vérifier les tests, l'aperçu visuel et la PR avant fusion vers main qui peut déclencher Netlify.

## Vérifications complémentaires du 2 novembre 2026
12 tests couvrent recherche, intégrité des modèles, raycasting, sauvegarde confirmée/refusée, changement de compte et chaîne de navigation réelle (quiz interrompu, imports tardifs, libération à la navigation et à la déconnexion).
Contrôle Chrome à 390 × 844 : aucun débordement horizontal, accès automatique à la fiche et retour au modèle fonctionnels ; une fiche sélectionnée pendant le chargement est actualisée à sa fin. Il s'agit d'un contrôle de dimensions de navigateur, pas d'une validation matérielle sur un téléphone. Les gestes à plusieurs doigts ne déclenchent pas de sélection à leur terminaison.
Après changement de compte Netlify par l'utilisateur, le projet correct est studywithaly, dans l'équipe studyywithaly, relié au dépôt GitHub et au domaine studywithaaly.fr. La PR déclenche un Deploy Preview automatique. Le projet studywithaaly du compte Gautier, consulté initialement, est un ancien projet distinct.
