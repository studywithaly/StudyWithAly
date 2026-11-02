# Atlas StudyWithAaly — couverture au 2 novembre 2026

4733 objets source, 13 systèmes, trois références conservées séparément. Le catalogue comprend des subdivisions anatomiques et plusieurs individus.

| Système | Objets | BP3D / Z / HRA | Limites et modèles manquants |
|---|---:|---|---|
| Système nerveux | 416 | 166 / 250 / 0 | Histologie, neurones, synapses ; référence Z distincte pour la moelle et les nerfs périphériques. |
| Squelette | 499 | 208 / 277 / 14 | Microarchitecture osseuse et squelette féminin complet. |
| Muscles | 1086 | 417 / 669 / 0 | Fibres, faisceaux et sarcomères ; musculature féminine complète. |
| Cœur et vaisseaux | 1685 | 1009 / 676 / 0 | Microcirculation et réseau capillaire complet. |
| Respiration | 105 | 105 / 0 / 0 | Bronchioles terminales et scène alvéolaire microscopique. |
| Digestion | 117 | 117 / 0 / 0 | Couches histologiques de la paroi digestive. |
| Appareil urinaire | 94 | 9 / 0 / 85 | Néphron, glomérule et barrière de filtration microscopique. |
| Glandes endocrines | 4 | 4 / 0 / 0 | Thyroïde, parathyroïdes et histologie glandulaire absentes de cette livraison. |
| Lymphatique et immunitaire | 161 | 3 / 158 / 0 | Exhaustivité des ganglions et des microvaisseaux. |
| Appareil reproducteur | 38 | 18 / 0 / 20 | Histologie, gamètes et exhaustivité des sous-structures. |
| Peau | 2 | 1 / 0 / 1 | Couches cutanées, follicules et glandes microscopiques. |
| Organes sensoriels | 29 | 29 / 0 / 0 | Microanatomie sensorielle ; aucun complément Z non commercial importé. |
| Articulations et tissus conjonctifs | 497 | 148 / 349 / 0 | Exhaustivité de tous les ligaments et tendons, microarchitecture. |

## Niveaux disponibles

GLB Meshopt : détail source quantifié à 16 bits ; niveau simplifié à distance pour les maillages dépassant 600 triangles. Chargement à la demande par région et système.

Corps → régions → organes → sous-structures, selon les maillages réellement disponibles. Parcours cerveau → hippocampe et cœur → valves → valve mitrale. Les étapes microscopiques affichent la ressource manquante.

- Les objets source incluent des subdivisions et des références de plusieurs individus : ce nombre ne désigne pas autant d’organes distincts.
- Les trois références ne sont pas fusionnées spatialement.
- La référence féminine reste partielle : peau, bassin, appareil reproducteur et urinaire.
- Les niveaux tissulaires/cellulaires/synaptiques ne sont pas simulés par un simple agrandissement.
- La plupart des fiches sont des fiches de repérage ; nomenclature française et descriptions détaillées encore partielles.

## Sources et licences

- [BodyParts3D / DBCLS, CC BY 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- [Z-Anatomy : modèles et crédits](https://github.com/Z-Anatomy/Models-of-human-anatomy), compléments retenus CC BY-SA 4.0 ; nerfs crâniens Dundee CC BY 4.0. Cerveau à provenance incertaine, oreille interne et rein Z non commerciaux exclus.
- [Human Reference Atlas](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html), modèles féminins Kristen Browne / NIH, CC BY 4.0.
- OpenStax Anatomy and Physiology 2e : références des fiches enrichies.

OpenAnatomy a été examiné ; ses scènes spécialisées ne fournissent pas ici un corps global enregistré commun. Aucun assemblage de repères incompatibles n’est présenté comme un seul individu.
