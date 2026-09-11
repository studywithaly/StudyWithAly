// The application remains online-first. No private course or account data is cached here.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(error => {
      console.warn('Installation mobile indisponible temporairement.', error);
    });
  });
}

// Profile settings apply only to this browser/device, after explicit opt-in.
const notificationsProfile = vueProfil;
vueProfil = function() {
  return notificationsProfile() + `<section class="carte" style="margin-top:20px"><h2>Notifications</h2><p class="muted">Un rappel pour réviser, ou une alerte quand de nouvelles fiches arrivent. Tu choisis.</p><button class="btn" onclick="ouvrirNotifications()">Régler mes notifications</button></section>`;
};
function notificationKey() { return 'swa-notifications-' + (fauth.currentUser?.uid || ''); }
function savedNotifications() { try {return JSON.parse(localStorage.getItem(notificationKey()) || '{}');} catch {return {};} }
function ouvrirNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    toast('Sur iPhone, ajoute d’abord le site à l’écran d’accueil depuis Safari, puis ouvre cette application.');return;
  }
  const saved=savedNotifications();
  modale(`<h2>Mes notifications</h2><p class="small muted">Réglages pour cet appareil. Aucun message publicitaire.</p>
    <form onsubmit="enregistrerNotifications(event)">
      <label class="rang" style="margin:16px 0;gap:10px"><input id="notif-rappel" type="checkbox" style="width:auto" ${saved.reminders?'checked':''}>Un rappel quotidien pour réviser</label>
      <div class="champ"><label for="notif-heure">Heure du rappel (heure locale)</label><select id="notif-heure">${Array.from({length:24},(_,hour)=>`<option value="${hour}" ${hour===(saved.hour??16)?'selected':''}>${String(hour).padStart(2,'0')} h</option>`).join('')}</select></div>
      <label class="rang" style="margin:16px 0;gap:10px"><input id="notif-nouveau" type="checkbox" style="width:auto" ${saved.news?'checked':''}>De nouvelles fiches disponibles</label>
      <p class="tiny muted">Les notifications peuvent arriver avec un délai selon la connexion et les réglages du téléphone. Ton compte, un identifiant de notification, tes choix et ton fuseau horaire sont conservés pour les envoyer, jusqu’à leur désactivation ou 90 jours sans utilisation sur cet appareil.</p>
      <p id="notif-status" role="status"></p>
      <div class="rang" style="gap:8px"><button class="btn primaire" type="submit">Enregistrer mes choix</button><button class="btn" type="button" onclick="desactiverNotifications()">Tout désactiver</button><button class="btn fantome" type="button" onclick="fermerModale()">Fermer</button></div>
    </form>`);
}
async function envoyerReglageNotification(body) {
  const user=fauth.currentUser;if(!user)throw Error('Connecte-toi pour enregistrer tes choix.');
  const response=await fetch('/.netlify/functions/notifications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.erreur || 'Enregistrement indisponible.');
}
async function enregistrerNotifications(event) {
  event.preventDefault();
  const form=event.target,status=document.getElementById('notif-status');
  const reminders=document.getElementById('notif-rappel').checked,news=document.getElementById('notif-nouveau').checked;
  if(!reminders && !news){await desactiverNotifications();return;}
  const hour=Number(document.getElementById('notif-heure').value);
  const controls=Array.from(form.querySelectorAll('button,input,select'));controls.forEach(c=>c.disabled=true);
  try {
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error('Notifications non autorisées. Tu peux modifier ce choix dans les réglages du navigateur.');
    if(!await firebase.messaging.isSupported())throw Error('Ce navigateur ne prend pas en charge les notifications.');
    const registration=await navigator.serviceWorker.ready;
    const token=await firebase.messaging().getToken({vapidKey:SWA_PUSH.vapidKey,serviceWorkerRegistration:registration});
    const choice={token,reminders,news,hour,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'};
    await envoyerReglageNotification(choice);
    localStorage.setItem(notificationKey(),JSON.stringify(choice));
    status.textContent='Tes choix sont enregistrés pour cet appareil.';
  }catch(error){status.textContent=error.message || 'Activation indisponible. Réessaie.';}
  finally{controls.forEach(c=>c.disabled=false);}
}
async function desactiverNotifications(silent=false) {
  const saved=savedNotifications(),status=document.getElementById('notif-status');
  try {
    if(saved.token)await envoyerReglageNotification({action:'remove',token:saved.token});
    if(window.firebase?.messaging && await firebase.messaging.isSupported())await firebase.messaging().deleteToken();
    localStorage.removeItem(notificationKey());
    if(status && !silent){status.textContent='Notifications désactivées sur cet appareil.';document.getElementById('notif-rappel').checked=false;document.getElementById('notif-nouveau').checked=false;}
  }catch(error){if(status && !silent)status.textContent=error.message;else throw error;}
}
const logoutWithoutNotifications=Auth.deconnecter;
Auth.deconnecter=async function(...args){
  if(savedNotifications().token){
    try{await desactiverNotifications(true);}catch{
      // Invalidate the browser token even if the server cannot be reached during logout.
      try{await firebase.messaging().deleteToken();}catch{}
    }
  }
  return logoutWithoutNotifications.apply(this,args);
};
if(window.firebase?.messaging && MODE_CLOUD){
  firebase.messaging.isSupported().then(supported=>{
    if(supported)firebase.messaging().onMessage(payload=>{
      if(U && savedNotifications().token)toast(payload.notification?.title || 'Studywithaaly');
    });
  }).catch(()=>{});
  fauth.onAuthStateChanged(async user=>{
    if(!user || !('Notification' in window) || Notification.permission!=='granted')return;
    const saved=savedNotifications();if(!saved.token || (!saved.reminders && !saved.news))return;
    try{
      if(!await firebase.messaging.isSupported())return;
      const token=await firebase.messaging().getToken({vapidKey:SWA_PUSH.vapidKey,serviceWorkerRegistration:await navigator.serviceWorker.ready});
      if(saved.token!==token)await envoyerReglageNotification({action:'remove',token:saved.token});
      const updated={...saved,token,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || saved.timezone};
      await envoyerReglageNotification(updated);
      localStorage.setItem(notificationKey(),JSON.stringify(updated));
    }catch{} // Retain choices for a retry; never prompt automatically.
  });
}
