// RF01-RF11: Global state management (CON GESTIÓN DE ODONTOGRAMAS)
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';

// --- UTILIDADES ---
const safeDate = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString().split('T')[0];
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  if (typeof timestamp === 'string') return timestamp.split('T')[0];
  if (timestamp instanceof Date) return timestamp.toISOString().split('T')[0];
  return 'N/A';
};

const cleanData = (data: any) => {
  const cleaned: any = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value === undefined) {
      cleaned[key] = null;
    } else {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

// --- INTERFACES ---
export interface Patient {
  id: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: 'M' | 'F' | 'X';
  telefonoPrincipal: string;
  telefonoContacto?: string;
  correo: string;
  curp?: string;
  direccion?: string;
  calle?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  colonia?: string;
  municipio?: string;
  estadoDireccion?: string;
  estadoCivil?: string;
  estado: 'activo' | 'inactivo';
  fechaRegistro: string;
}

export interface Service {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  estado: 'activo' | 'inactivo';
}
export interface HistoryEntry {
  id: string;
  fecha: string;
  servicios: { servicioId: string; cantidad: number }[];
  notas: string;
  total: number;
}
export interface ToothState {
  estados: string[];
  textoLibre?: string;
  superficies: {
    oclusal?: string;
    mesial?: string;
    distal?: string;
    vestibular?: string;
    lingual?: string;
  };
}
// MODIFICADO: Añadido campo 'nombre' opcional para odontogramas personalizados
export interface Odontogram {
  id: string;
  nombre?: string; 
  fecha: string;
  tipo: 'adulto' | 'niño' | 'mixto'; // Agregado 'mixto'
  dientes: { [toothNumber: string]: ToothState };
  notas: string;
}
export interface QuotationItem {
  servicioId: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}
export interface Quotation {
  id: string;
  pacienteId: string;
  fecha: string;
  items: QuotationItem[];
  descuento: number;
  total: number;
  estado: 'borrador' | 'activo' | 'inactivo';
  notas: string;
}
export interface Paquete {
  id: string;
  nombre: string;
  precioTotal: number;
  fechaInicio: string;
  fechaFin: string;
  serviciosIncluidos: {
    servicioId: string;
    nombre: string;
    precioOriginal: number;
    cantidad: number;
  }[];
  estado: 'activo' | 'inactivo';
}

// Interfaces Historia Clínica (Iguales que antes)
export interface IHistoriaGeneral { ocupacion: string; escolaridad: string; estado_civil: string; telefono: string; fecha_ult_consulta_medica: string; motivo_ult_consulta_medica: string; fecha_ult_consulta_odontologica: string; motivo_ult_consulta_odontologica: string; }
export interface IAntecedentesHereditarios { madre: string; padre: string; hermanos: string; hijos: string; esposo: string; tios: string; abuelos: string; }
export interface IAppPatologicos { ets: boolean; degenerativas: boolean; neoplasicas: boolean; congenitas: boolean; otras: string; }
export interface IApnp { frecuencia_cepillado: string; auxiliares_higiene: boolean; auxiliares_cuales: string; come_entre_comidas: boolean; grupo_sanguineo: string; adic_tabaco: boolean; adic_alcohol: boolean; }
export interface IAlergias { antibioticos: boolean; analgesicos: boolean; anestesicos: boolean; alimentos: boolean; especificar: string; }
export interface IHospitalizaciones { ha_sido_hospitalizado: boolean; fecha: string; motivo: string; }
export interface ISignosVitales { peso_kg: string; talla_m: string; frecuencia_cardiaca: string; tension_arterial_sistolica: string; tension_arterial_diastolica: string; frecuencia_respiratoria: string; temperatura_c: string; }
export interface IExploracionCabezaCuello { cabeza_exostosis: boolean; cabeza_endostosis: boolean; craneo_tipo: string; cara_asimetria_transversal: boolean; cara_asimetria_longitudinal: boolean; perfil: string; piel: string; musculos: string; cuello_cadena_ganglionar_palpable: boolean; otros: string; }
export interface IExploracionAtm { ruidos: boolean; lateralidad: string; apertura_mm: string; chasquidos: boolean; crepitacion: boolean; dificultad_abrir_boca: boolean; dolor_mov_lateralidad: boolean; fatiga_dolor_muscular: boolean; disminucion_apertura: boolean; desviacion_apertura_cierre: boolean; }
export interface ICavidadOral { labio_estado: string; labio_nota: string; comisuras_estado: string; comisuras_nota: string; carrillos_estado: string; carrillos_nota: string; fondo_de_saco_estado: string; fondo_de_saco_nota: string; frenillos_estado: string; frenillos_nota: string; paladar_estado: string; paladar_nota: string; lengua_estado: string; lengua_nota: string; piso_boca_estado: string; piso_boca_nota: string; dientes_estado: string; dientes_nota: string; encia_estado: string; encia_nota: string; }
export interface IHistoriaClinicaCompleta { historiaGeneral: IHistoriaGeneral; antecedentesHereditarios: IAntecedentesHereditarios; appPatologicos: IAppPatologicos; apnp: IApnp; alergias: IAlergias; hospitalizaciones: IHospitalizaciones; signosVitales: ISignosVitales; exploracionCabezaCuello: IExploracionCabezaCuello; exploracionAtm: IExploracionAtm; cavidadOral: ICavidadOral; }

// Initial State (Compactado)
export const initialState: IHistoriaClinicaCompleta = {
  historiaGeneral: { ocupacion: '', escolaridad: '', estado_civil: '', telefono: '', fecha_ult_consulta_medica: '', motivo_ult_consulta_medica: '', fecha_ult_consulta_odontologica: '', motivo_ult_consulta_odontologica: '' },
  antecedentesHereditarios: { madre: '', padre: '', hermanos: '', hijos: '', esposo: '', tios: '', abuelos: '' },
  appPatologicos: { ets: false, degenerativas: false, neoplasicas: false, congenitas: false, otras: '' },
  apnp: { frecuencia_cepillado: '', auxiliares_higiene: false, auxiliares_cuales: '', come_entre_comidas: false, grupo_sanguineo: '', adic_tabaco: false, adic_alcohol: false },
  alergias: { antibioticos: false, analgesicos: false, anestesicos: false, alimentos: false, especificar: '' },
  hospitalizaciones: { ha_sido_hospitalizado: false, fecha: '', motivo: '' },
  signosVitales: { peso_kg: '', talla_m: '', frecuencia_cardiaca: '', tension_arterial_sistolica: '', tension_arterial_diastolica: '', frecuencia_respiratoria: '', temperatura_c: '' },
  exploracionCabezaCuello: { cabeza_exostosis: false, cabeza_endostosis: false, craneo_tipo: '', cara_asimetria_transversal: false, cara_asimetria_longitudinal: false, perfil: '', piel: '', musculos: '', cuello_cadena_ganglionar_palpable: false, otros: '' },
  exploracionAtm: { ruidos: false, lateralidad: '', apertura_mm: '', chasquidos: false, crepitacion: false, dificultad_abrir_boca: false, dolor_mov_lateralidad: false, fatiga_dolor_muscular: false, disminucion_apertura: false, desviacion_apertura_cierre: false },
  cavidadOral: { labio_estado: '', labio_nota: '', comisuras_estado: '', comisuras_nota: '', carrillos_estado: '', carrillos_nota: '', fondo_de_saco_estado: '', fondo_de_saco_nota: '', frenillos_estado: '', frenillos_nota: '', paladar_estado: '', paladar_nota: '', lengua_estado: '', lengua_nota: '', piso_boca_estado: '', piso_boca_nota: '', dientes_estado: '', dientes_nota: '', encia_estado: '', encia_nota: '' }
};

interface AppState {
  currentUser: User | null; authLoading: boolean;
  patients: Patient[]; patientsLoading: boolean;
  services: Service[]; servicesLoading: boolean;
  quotations: Quotation[]; quotationsLoading: boolean;
  paquetes: Paquete[]; paquetesLoading: boolean;
  searchQuery: string;
}

interface AppContextType extends AppState {
  logout: () => void;
  addPatient: (patient: Omit<Patient, 'id' | 'fechaRegistro'>) => Promise<string>;
  updatePatient: (id: string, patient: Partial<Patient>) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  addService: (service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  addHistoryEntry: (patientId: string, entry: Omit<HistoryEntry, 'id'>) => Promise<void>;
  updateHistoryEntry: (patientId: string, entryId: string, updates: Partial<HistoryEntry>) => Promise<void>;
  deleteHistoryEntry: (patientId: string, entryId: string) => Promise<void>;
  // Nuevas funciones Odontograma
  addOdontogram: (patientId: string, tipo: 'adulto' | 'niño' | 'mixto', nombre?: string) => Promise<void>;
  updateOdontogramName: (patientId: string, odontogramId: string, newName: string) => Promise<void>;
  deleteOdontogram: (patientId: string, odontogramId: string) => Promise<void>;
  
  addQuotation: (quotation: Omit<Quotation, 'id'>) => Promise<void>;
  updateQuotation: (id: string, quotation: Partial<Quotation>) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
  addPaquete: (paquete: Omit<Paquete, 'id'>) => Promise<void>;
  updatePaquete: (id: string, updates: Partial<Paquete>) => Promise<void>;
  deletePaquete: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  addInitialHistoryForms: (patientId: string, forms: IHistoriaClinicaCompleta) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    currentUser: null, authLoading: true,
    patients: [], patientsLoading: true,
    services: [], servicesLoading: true,
    quotations: [], quotationsLoading: true,
    paquetes: [], paquetesLoading: true,
    searchQuery: '',
  });

  // Listeners (Auth, Patients, Services, Quotations, Packages)
  useEffect(() => { const u = onAuthStateChanged(auth, (user) => setState(p => ({ ...p, currentUser: user, authLoading: false }))); return () => u(); }, []);
  
  useEffect(() => {
    if (!state.currentUser) { setState(p => ({ ...p, patients: [], patientsLoading: false })); return; }
    if (state.patients.length === 0) setState(p => ({ ...p, patientsLoading: true }));
    const q = query(collection(db, 'pacientes'), orderBy('fechaRegistro', 'desc'));
    const u = onSnapshot(q, (s) => setState(p => ({ ...p, patients: s.docs.map(d => ({ id: d.id, ...d.data(), fechaRegistro: safeDate(d.data().fechaRegistro) } as Patient)), patientsLoading: false })), e => { console.error(e); setState(p => ({ ...p, patientsLoading: false })); });
    return () => u();
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.currentUser) return;
    const u = onSnapshot(query(collection(db, 'servicios')), (s) => setState(p => ({ ...p, services: s.docs.map(d => ({ id: d.id, ...d.data() } as Service)), servicesLoading: false })));
    return () => u();
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.currentUser) return;
    const u = onSnapshot(query(collection(db, 'cotizaciones'), orderBy('fecha', 'desc')), (s) => setState(p => ({ ...p, quotations: s.docs.map(d => ({ id: d.id, ...d.data(), fecha: safeDate(d.data().fecha) } as Quotation)), quotationsLoading: false })));
    return () => u();
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.currentUser) return;
    const u = onSnapshot(query(collection(db, 'paquetes'), orderBy('nombre', 'asc')), (s) => setState(p => ({ ...p, paquetes: s.docs.map(d => ({ id: d.id, ...d.data(), fechaInicio: safeDate(d.data().fechaInicio), fechaFin: safeDate(d.data().fechaFin) } as Paquete)), paquetesLoading: false })));
    return () => u();
  }, [state.currentUser]);

  const logout = () => { signOut(auth); };

  // CRUD Functions
  const addPatient = async (patient: Omit<Patient, 'id' | 'fechaRegistro'>) => {
    try { return (await addDoc(collection(db, 'pacientes'), cleanData({ ...patient, fechaRegistro: new Date() }))).id; } 
    catch (e) { console.error(e); toast.error("Error al guardar paciente"); throw e; }
  };
  const updatePatient = async (id: string, u: Partial<Patient>) => { try { await updateDoc(doc(db, 'pacientes', id), cleanData(u)); } catch (e) { toast.error("Error al actualizar"); } };
  const deletePatient = async (id: string) => { try { await deleteDoc(doc(db, 'pacientes', id)); } catch (e) { toast.error("Error al eliminar"); } };

  const addService = async (s: Omit<Service, 'id'>) => { await addDoc(collection(db, 'servicios'), cleanData({ ...s, fechaCreacion: new Date() })); };
  const updateService = async (id: string, u: Partial<Service>) => { await updateDoc(doc(db, 'servicios', id), cleanData(u)); };
  const deleteService = async (id: string) => { await deleteDoc(doc(db, 'servicios', id)); };

  const addHistoryEntry = async (pid: string, e: Omit<HistoryEntry, 'id'>) => { try { await addDoc(collection(db, 'pacientes', pid, 'historial'), cleanData({ ...e, fecha: new Date(e.fecha + "T00:00:00") })); toast.success("Historial agregado"); } catch (err) { toast.error("Error historial"); } };
  const updateHistoryEntry = async (pid: string, eid: string, u: Partial<HistoryEntry>) => { const d = { ...u }; if (u.fecha) d.fecha = new Date(u.fecha + "T00:00:00") as any; await updateDoc(doc(db, 'pacientes', pid, 'historial', eid), cleanData(d)); };
  const deleteHistoryEntry = async (pid: string, eid: string) => { await deleteDoc(doc(db, 'pacientes', pid, 'historial', eid)); };

  // --- ODONTOGRAMA (NUEVO) ---
  const addOdontogram = async (patientId: string, tipo: 'adulto' | 'niño' | 'mixto', nombre?: string) => { 
    await addDoc(collection(db, 'pacientes', patientId, 'odontograma'), { 
      fecha: new Date(), 
      tipo, 
      nombre: nombre || (tipo === 'mixto' ? 'Odontograma Mixto' : `Odontograma ${tipo}`), 
      dientes: {}, 
      notas: "" 
    }); 
  };
  
  const updateOdontogramName = async (patientId: string, odontogramId: string, newName: string) => {
    await updateDoc(doc(db, 'pacientes', patientId, 'odontograma', odontogramId), { nombre: newName });
    toast.success("Nombre actualizado");
  };

  const deleteOdontogram = async (patientId: string, odontogramId: string) => {
    try {
      await deleteDoc(doc(db, 'pacientes', patientId, 'odontograma', odontogramId));
      toast.success("Odontograma eliminado");
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar");
    }
  };
  
  const addQuotation = async (q: Omit<Quotation, 'id'>) => { await addDoc(collection(db, 'cotizaciones'), cleanData({ ...q, fecha: new Date(q.fecha + "T00:00:00") })); toast.success("Cotización creada"); };
  const updateQuotation = async (id: string, u: Partial<Quotation>) => { const d = { ...u }; if (u.fecha) d.fecha = new Date((typeof u.fecha === 'string' ? u.fecha : new Date().toISOString().split('T')[0]) + "T00:00:00") as any; await updateDoc(doc(db, 'cotizaciones', id), cleanData(d)); };
  const deleteQuotation = async (id: string) => { await deleteDoc(doc(db, 'cotizaciones', id)); };

  const addPaquete = async (p: Omit<Paquete, 'id'>) => { await addDoc(collection(db, 'paquetes'), cleanData({ ...p, fechaInicio: new Date(p.fechaInicio + "T00:00:00"), fechaFin: new Date(p.fechaFin + "T00:00:00"), fechaCreacion: new Date() })); };
  const updatePaquete = async (id: string, u: Partial<Paquete>) => { const d = { ...u }; if (u.fechaInicio) d.fechaInicio = new Date(u.fechaInicio + "T00:00:00") as any; if (u.fechaFin) d.fechaFin = new Date(u.fechaFin + "T00:00:00") as any; await updateDoc(doc(db, 'paquetes', id), cleanData(d)); };
  const deletePaquete = async (id: string) => { await deleteDoc(doc(db, 'paquetes', id)); };

  const setSearchQuery = (q: string) => { setState(p => ({ ...p, searchQuery: q })); };
  const addInitialHistoryForms = async (pid: string, forms: IHistoriaClinicaCompleta) => {
    const b = writeBatch(db); const path = `pacientes/${pid}/historia_clinica`;
    b.set(doc(db, path, 'historiaGeneral'), cleanData(forms.historiaGeneral));
    b.set(doc(db, path, 'antecedentesHereditarios'), cleanData(forms.antecedentesHereditarios));
    b.set(doc(db, path, 'appPatologicos'), cleanData(forms.appPatologicos));
    b.set(doc(db, path, 'apnp'), cleanData(forms.apnp));
    b.set(doc(db, path, 'alergias'), cleanData(forms.alergias));
    b.set(doc(db, path, 'hospitalizaciones'), cleanData(forms.hospitalizaciones));
    b.set(doc(db, path, 'signosVitales'), cleanData(forms.signosVitales));
    b.set(doc(db, path, 'exploracionCabezaCuello'), cleanData(forms.exploracionCabezaCuello));
    b.set(doc(db, path, 'exploracionAtm'), cleanData(forms.exploracionAtm));
    b.set(doc(db, path, 'cavidadOral'), cleanData(forms.cavidadOral));
    b.set(doc(db, `pacientes/${pid}`), { hasHistorial: true }, { merge: true });
    await b.commit(); toast.success("Historia clínica guardada");
  };

  return (
    <AppContext.Provider value={{ ...state, logout, addPatient, updatePatient, deletePatient, addService, updateService, deleteService, addHistoryEntry, updateHistoryEntry, deleteHistoryEntry, addOdontogram, updateOdontogramName, deleteOdontogram, addQuotation, updateQuotation, deleteQuotation, addPaquete, updatePaquete, deletePaquete, setSearchQuery, addInitialHistoryForms }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => { const c = useContext(AppContext); if (!c) throw new Error('useApp must be used within AppProvider'); return c; };