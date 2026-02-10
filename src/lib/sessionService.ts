import { db } from './firebase';
import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

type BrowserInfo = {
  browser: string;
  browserVersion: string;
};

type DeviceInfo = {
  deviceType: string;
  deviceLabel: string;
  browser: string;
  browserVersion: string;
  os: string;
  platform: string;
};

const getOsName = (ua: string, platform: string) => {
  if (/Windows NT 10\.0/i.test(ua)) return 'Windows 10';
  if (/Windows NT 11\.0/i.test(ua)) return 'Windows 11';
  if (/Windows NT 6\.3/i.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.2/i.test(ua)) return 'Windows 8';
  if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7';
  if (/Windows NT 6\.0/i.test(ua)) return 'Windows Vista';
  if (/Windows NT 5\.1/i.test(ua)) return 'Windows XP';
  const androidMatch = ua.match(/Android\s([0-9.]+)/i);
  if (androidMatch) return `Android ${androidMatch[1]}`;
  const iosMatch = ua.match(/OS\s([0-9_]+)\slike Mac OS X/i);
  if (iosMatch) return `iOS ${iosMatch[1].replace(/_/g, '.')}`;
  const macMatch = ua.match(/Mac OS X\s([0-9_]+)/i);
  if (macMatch) return `macOS ${macMatch[1].replace(/_/g, '.')}`;
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return platform || 'Sistema desconocido';
};

const parseBrowserInfo = (ua: string, uaData?: NavigatorUAData): BrowserInfo => {
  const brands = uaData?.brands ?? [];
  const brandLookup = [
    { match: 'Microsoft Edge', label: 'Edge' },
    { match: 'Google Chrome', label: 'Chrome' },
    { match: 'Chromium', label: 'Chromium' },
    { match: 'Opera', label: 'Opera' },
    { match: 'Brave', label: 'Brave' },
    { match: 'Vivaldi', label: 'Vivaldi' },
  ];

  for (const { match, label } of brandLookup) {
    const brand = brands.find((entry) => entry.brand === match);
    if (brand) {
      return { browser: label, browserVersion: brand.version || '' };
    }
  }

  const versionMatch = (regex: RegExp) => ua.match(regex)?.[1] ?? '';

  if (/Edg\//i.test(ua)) return { browser: 'Edge', browserVersion: versionMatch(/Edg\/([\d.]+)/i) };
  if (/OPR\//i.test(ua)) return { browser: 'Opera', browserVersion: versionMatch(/OPR\/([\d.]+)/i) };
  if (/SamsungBrowser\//i.test(ua)) return { browser: 'Samsung Internet', browserVersion: versionMatch(/SamsungBrowser\/([\d.]+)/i) };
  if (/Firefox\//i.test(ua)) return { browser: 'Firefox', browserVersion: versionMatch(/Firefox\/([\d.]+)/i) };
  if (/Chrome\//i.test(ua)) return { browser: 'Chrome', browserVersion: versionMatch(/Chrome\/([\d.]+)/i) };
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) {
    return { browser: 'Safari', browserVersion: versionMatch(/Version\/([\d.]+)/i) };
  }

  return { browser: 'Navegador', browserVersion: '' };
};

// Detecta el hardware una sola vez
export const getDeviceInfo = (): DeviceInfo => {
  const ua = navigator.userAgent;
  const uaData = navigator.userAgentData;
  const platform = uaData?.platform || navigator.platform || 'Desconocido';
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua);
  const isMobile = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua);
  const isMobileHint = uaData?.mobile ?? false;
  const isTouchDevice = (navigator.maxTouchPoints || 0) > 0;
  const minScreen = Math.min(window.screen.width, window.screen.height);

  let deviceType = "Computadora";
  if (isTablet) deviceType = "Tablet";
  else if (isMobile || isMobileHint) deviceType = "Celular";

  let deviceLabel = deviceType;
  if (deviceType === "Computadora") {
    const looksLikeLaptop = isTouchDevice && minScreen <= 1366;
    deviceLabel = looksLikeLaptop ? "Computadora (Portátil)" : "Computadora (Escritorio)";
  }

  const { browser, browserVersion } = parseBrowserInfo(ua, uaData);
  const os = getOsName(ua, platform);

  return {
    deviceType,
    deviceLabel,
    browser,
    browserVersion,
    os,
    platform,
  };
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
  const { deviceType, deviceLabel, browser, browserVersion, os, platform } = getDeviceInfo();
  const sessionRef = doc(db, `usuarios/${uid}/sesiones`, sessionId);

  await setDoc(sessionRef, {
    deviceType,
    deviceLabel,
    browser,
    browserVersion,
    os,
    platform,
    lastActive: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true }); // Merge evita duplicar la entrada

  return sessionId;
};
