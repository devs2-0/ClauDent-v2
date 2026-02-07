import { db } from './firebase';
import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

// Detecta el hardware una sola vez
export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let deviceType = "Computadora";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) deviceType = "Tablet";
  else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) deviceType = "Celular";
  
  let browser = "Navegador";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";

  return { deviceType, browser };
};

// PERSISTENCIA: Busca un ID guardado. Si no hay, crea uno fijo para este navegador.
export const getPersistentSessionId = () => {
  let sid = localStorage.getItem('claudent_session_id');
  if (!sid) {
    // Solo se genera una vez en la vida de este navegador/app
    sid = 'sess_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('claudent_session_id', sid);
  }
  return sid;
};

// Registra o actualiza la última actividad sin crear un documento nuevo
export const registerOrUpdateSession = async (uid: string) => {
  const sessionId = getPersistentSessionId();
  const { deviceType, browser } = getDeviceInfo();
  const sessionRef = doc(db, `usuarios/${uid}/sesiones`, sessionId);

  await setDoc(sessionRef, {
    deviceType,
    browser,
    lastActive: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true }); // Merge evita duplicar la entrada

  return sessionId;
};