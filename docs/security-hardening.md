# Renforcement de sécurité — 3 novembre 2026

Aucune garantie d’inviolabilité : ces mesures réduisent des risques vérifiés et doivent être complétées par une surveillance et des mises à jour.

## Changements

- Publication d’une liste explicite de fichiers publics dans `dist`. Les fonctions serveur, règles Firestore, tests, dépendances et fichiers de configuration ne sont plus copiés dans le site public. Le dépôt GitHub reste public ; la sécurité ne repose pas sur le secret du code.
- Validation précoce des méthodes, tailles de requêtes, format JSON, origine navigateur et présence d’un jeton avant les lectures de données. Vérification Firebase des jetons révoqués maintenue ; le webhook Stripe conserve son contrôle de signature.
- Limitations Netlify par IP et domaine : page d’accueil et `index.html` 120/minute ; contenu API 120/minute ; paiements et portail 10/minute ; activation de licence 6/minute ; préférences de notifications 30/minute ; plafond général 6 000/minute pour laisser fonctionner les ressources 3D. Ces limites ne constituent pas une protection absolue contre une attaque distribuée ; leur application peut être différée de quelques secondes et des utilisateurs derrière une même IP partagent un quota.
- Règles Firestore avec identité de document et adresse e-mail contrôlées à la création ; seuls les champs de profil et de progression prévus sont modifiables par le propriétaire. Rôle, identité, date de création et droits commerciaux ne sont pas librement modifiables. Les accès entre comptes et aux droits restent interdits hors administration.
- Identité affichée issue du chemin Firestore / Firebase Auth plutôt que du champ `id` éditable ; normalisation des historiques et listes avant affichage.
- Nettoyage des textes riches avec DOMPurify et encodage des arguments des actions. Rejet des URL actives et des images SVG/HTML encodées. Les styles pédagogiques simples sont conservés.
- Bibliothèque PDF.js 3.11.174 vulnérable remplacée par PDF.js 6.5.438 hébergée localement ; génération de code désactivée explicitement pour les PDF. Module et worker chargés depuis le site.
- Firebase Admin 14.5.0 via ses points d’entrée modulaires ; correctifs des dépendances transitives glob/minimatch/gRPC. `npm audit` : aucune vulnérabilité connue signalée au moment du contrôle, y compris dans les dépendances de développement.
- En-têtes contre le cadrage non autorisé, l’interprétation erronée de fichiers et les permissions navigateur superflues. Politique CSP : scripts locaux et fournisseur Firebase explicitement autorisé, scripts inline dans des balises et `eval` interdits, WebAssembly conservé pour la 3D.
- Génération cryptographique des nouveaux codes de licence ; mode de démonstration local désactivé si Firebase n’est pas disponible ; erreurs serveur internes masquées.

## Vérifications

- 38 tests automatisés du site, dont géométries, navigation, progression, refus des appels sans identité, faux webhook, injections HTML et échappement des actions.
- 19 contrôles dans l’émulateur Firestore : inscription normale et progression autorisées ; auto-promotion, falsification d’identité, lecture d’un autre compte, modification du contenu ou des droits et accès d’un compte supprimé refusés. Aucun de ces essais n’a écrit dans la base réelle.
- Contrôle Chrome local sous les nouveaux en-têtes : connexion simulée avec données fictives, fiche contenant une charge HTML de test nettoyée, navigation et atlas 3D fonctionnels sans erreur de sécurité.
- Aucun achat réel, suppression de compte réel, envoi de notification ou test de saturation n’a été lancé pour cette vérification.

Exécution : `npm test`, `npm audit`, `npm run build`. Règles : `npm exec --yes --package=firebase-tools@15.34.2 -- firebase emulators:exec --only firestore --project demo-swa-security --config firebase.test.json "node tests/firestore.emulator.mjs"`.

## Limites et actions complémentaires

- La CSP conserve temporairement les anciens gestionnaires d’événements HTML (`script-src-attr 'unsafe-inline'`). Les entrées dangereuses identifiées sont nettoyées et les arguments encodés, mais la migration complète vers des écouteurs externes permettrait une politique encore plus stricte.
- Activer ou vérifier la double authentification des comptes administrateurs GitHub, Google/Firebase, Netlify et Stripe. Les appareils, mots de passe, moyens de récupération et sessions doivent aussi être protégés ; leur sécurité n’est pas garantie par le code du site.
- Firebase App Check n’est pas imposé : il nécessite l’enregistrement et le déploiement d’un fournisseur d’attestation afin de ne pas bloquer les utilisateurs existants. Les règles Firebase et les limites des fonctions ne remplacent pas cette attestation.
- Les restrictions natives Firebase Auth, les quotas, les alertes de consommation, les sauvegardes et les protections DDoS/WAF proposées par l’hébergeur nécessitent une revue régulière. Aucun forfait payant ni changement de fournisseur DNS n’a été engagé.
- Le contenu pédagogique partagé avec un utilisateur autorisé peut être recopié. Ce renforcement ne constitue pas un système DRM ni une garantie contre des vulnérabilités futures, une compromission de compte administrateur ou une attaque distribuée dépassant les protections de l’hébergeur.

## Références

- [Netlify : limitation de débit et validation au déploiement](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)
- [Firebase : contrôle des champs par règles](https://firebase.google.com/docs/firestore/security/rules-fields)
- [Firebase Admin : notes de version et migration modulaire](https://firebase.google.com/support/release-notes/admin/node)
- [PDF.js : avis CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq)
- [MDN : Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
