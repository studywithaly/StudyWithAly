exports.handler = async () => {
  const out = { etapes: [] };
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    out.etapes.push({ var_presente: !!raw, longueur: raw ? raw.length : 0 });
    if (!raw) return { statusCode: 200, body: JSON.stringify(out, null, 2) };

    let sa;
    try {
      sa = JSON.parse(raw);
      out.etapes.push({ parse_json: "ok" });
    } catch (e) {
      out.etapes.push({ parse_json: "ECHEC", message: e.message });
      return { statusCode: 200, body: JSON.stringify(out, null, 2) };
    }

    out.etapes.push({
      project_id: sa.project_id,
      client_email: sa.client_email,
      cle_longueur: (sa.private_key || "").length,
      cle_debut_ok: (sa.private_key || "").startsWith("-----BEGIN PRIVATE KEY-----"),
      cle_fin_ok: (sa.private_key || "").trim().endsWith("-----END PRIVATE KEY-----"),
      vrais_sauts_de_ligne: (sa.private_key || "").includes("\n"),
    });

    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    await admin.firestore().collection("medias").limit(1).get();
    out.etapes.push({ lecture_firestore: "ok" });
  } catch (e) {
    out.etapes.push({ erreur: e.message, code: e.code });
  }
  return { statusCode: 200, body: JSON.stringify(out, null, 2) };
};
