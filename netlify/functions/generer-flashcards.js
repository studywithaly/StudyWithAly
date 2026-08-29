// Génère des propositions de flashcards à partir du texte d'une fiche PDF.
// Le modèle ne fait que PROPOSER : Alycia sélectionne, modifie et valide
// avant que quoi que ce soit soit enregistré dans Firestore.
//
// Variables Netlify nécessaires :
//   ANTHROPIC_API_KEY : clé de l'API Claude (console.anthropic.com)
//   ADMIN_UIDS        : les UID autorisés, séparés par des virgules
//
// L'appel coûte de l'argent à chaque usage : d'où la restriction aux admins.

const admin = require("firebase-admin");

function identifiants(){
  const brut = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if(brut){
    const nettoye = (brut.startsWith("'") || brut.startsWith('"')) ? brut.slice(1, -1) : brut;
    const j = JSON.parse(nettoye);
    let cle = j.private_key || "";
    if(!cle.includes("\n")) cle = cle.replace(/\\n/g, "\n");
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: cle };
  }
  let cle = (process.env.FIREBASE_PRIVATE_KEY || "").trim();
  if(cle.startsWith('"') && cle.endsWith('"')) cle = cle.slice(1, -1);
  return {
    projectId:   (process.env.FIREBASE_PROJECT_ID || "").trim(),
    clientEmail: (process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
    privateKey:  cle.replace(/\\n/g, "\n")
  };
}

if(!admin.apps.length){
  const ids = identifiants();
  if(!ids.projectId || !ids.clientEmail || !ids.privateKey){
    throw new Error("Identifiants Firebase absents.");
  }
  admin.initializeApp({ credential: admin.credential.cert(ids) });
}

const reponse = (code, corps) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corps)
});

async function utilisateurDepuisEntete(headers){
  const brut = headers.authorization || headers.Authorization || "";
  const jeton = brut.startsWith("Bearer ") ? brut.slice(7) : null;
  if(!jeton) throw new Error("jeton absent");
  const decode = await admin.auth().verifyIdToken(jeton);
  return { uid: decode.uid, email: decode.email };
}

// Netlify coupe les fonctions synchrones à 10 s. Un texte trop long ferait
// dépasser ce délai : on plafonne, et l'interface découpe par chapitre.
const MAX_CARACTERES = 14000;

const CONSIGNE = `Tu prépares des flashcards de révision à partir d'un extrait de cours.

Règles :
- Une carte = une seule notion. Jamais deux idées dans la même carte.
- Le recto est une question précise, pas un intitulé de chapitre.
- Le verso tient en une ou deux phrases, formulées comme on les réciterait.
- Reste strictement fidèle au texte fourni. N'ajoute aucune connaissance extérieure.
- Si un passage ne se prête pas à une flashcard, ignore-le.
- Écris en français.

Réponds UNIQUEMENT avec un tableau JSON, sans texte avant ni après,
sans balises Markdown. Format de chaque élément :
{"recto":"...","verso":"...","source":"titre de section d'où vient la notion"}`;

exports.handler = async (event) => {
  if(event.httpMethod !== "POST") return reponse(405, { erreur:"méthode non autorisée" });

  let user;
  try{ user = await utilisateurDepuisEntete(event.headers); }
  catch(e){ return reponse(401, { erreur:"connexion requise" }); }

  const autorises = (process.env.ADMIN_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
  if(!autorises.includes(user.uid)){
    return reponse(403, { erreur:"réservé à l'administration du site" });
  }

  if(!process.env.ANTHROPIC_API_KEY){
    return reponse(500, { erreur:"ANTHROPIC_API_KEY absente des variables Netlify" });
  }

  const { texte, nombre } = JSON.parse(event.body || "{}");
  if(!texte || texte.trim().length < 200){
    return reponse(400, { erreur:"texte trop court ou absent" });
  }
  if(texte.length > MAX_CARACTERES){
    return reponse(400, {
      erreur:"extrait trop long (" + texte.length + " caractères, maximum "
        + MAX_CARACTERES + "). Découpe la fiche par chapitre."
    });
  }

  const combien = Math.min(Math.max(Number(nombre) || 15, 3), 30);

  try{
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        system: CONSIGNE,
        messages: [{
          role: "user",
          content: "Propose environ " + combien + " flashcards à partir de cet extrait :\n\n" + texte
        }]
      })
    });

    if(!r.ok){
      const detail = await r.text();
      console.error("api claude", r.status, detail);
      return reponse(502, { erreur:"le service de génération a refusé la demande (" + r.status + ")" });
    }

    const data = await r.json();
    const brut = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let cartes;
    try{
      cartes = JSON.parse(brut);
    }catch(e){
      console.error("réponse non parsable", brut.slice(0, 500));
      return reponse(502, { erreur:"réponse illisible, réessaie" });
    }

    if(!Array.isArray(cartes)) return reponse(502, { erreur:"format inattendu" });

    // On filtre et on normalise avant de renvoyer à l'interface
    const propres = cartes
      .filter(c => c && typeof c.recto === "string" && typeof c.verso === "string")
      .map((c, i) => ({
        id: "tmp-" + Date.now() + "-" + i,
        recto: c.recto.trim(),
        verso: c.verso.trim(),
        source: (c.source || "").trim()
      }))
      .filter(c => c.recto.length > 3 && c.verso.length > 3);

    return reponse(200, { cartes: propres, total: propres.length });

  }catch(e){
    console.error("generer-flashcards", e);
    return reponse(500, { erreur: e.message });
  }
};
