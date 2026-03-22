# JOCC · Gestion des Quarts
## Préfecture Maritime · République du Bénin

Application web de gestion opérationnelle des quarts du Joint Operations Command Center (JOCC).

### 🚀 Déploiement live
**[→ Ouvrir l'application](https://[VOTRE-USERNAME].github.io/jocc-gestion-quarts/)**

---

### Fonctionnalités

| Module | Description |
|--------|-------------|
| **Tableau de bord** | Vue temps réel de l'équipe en service, rotation, derniers événements |
| **SITREP** | Saisie et archivage des Situation Reports maritimes (position, azimut, vitesse, cap...) |
| **Planning** | Calendrier mensuel avec rotation automatique des 4 équipes (A/B/C/D) |
| **Opérateurs** | Gestion du personnel (Chef de quart, Op. veille, Op. radio, Off. permanence, Superviseur) |
| **Rapport de quart** | Main courante avec horodatage, types d'événements, impression PDF |
| **Absences** | Déclaration et suivi des absences avec validation |
| **Supervision** | Centre de supervision avec notifications temps réel pour tous les événements |
| **Fichiers & Consignes** | Dépôt de consignes permanentes et captures des systèmes de surveillance (VTMIS, AIS, radar) |

### Architecture
- **100% frontend** — aucun serveur requis, fonctionne en static hosting
- **Stockage local** — données persistées via localStorage dans le navigateur
- **Responsive** — adapté desktop, tablette et mobile
- **Hors ligne** — fonctionne sans connexion après le premier chargement

### Déploiement sur GitHub Pages

```bash
# 1. Cloner ou créer le repo
git init jocc-gestion-quarts
cd jocc-gestion-quarts

# 2. Copier le fichier principal
cp jocc_deploy.html index.html

# 3. Commiter et pousser
git add .
git commit -m "Initial deployment — JOCC v4"
git branch -M main
git remote add origin https://github.com/[USERNAME]/jocc-gestion-quarts.git
git push -u origin main

# 4. Activer GitHub Pages dans Settings > Pages > Source: main / root
```

### Structure du projet
```
jocc-gestion-quarts/
├── index.html          ← Application principale (standalone)
└── README.md           ← Ce fichier
```

### Données & Confidentialité
Les données sont stockées **uniquement dans le navigateur** (localStorage).  
Aucune donnée n'est transmise à un serveur externe.

---
*JOCC · Préfecture Maritime · République du Bénin*
