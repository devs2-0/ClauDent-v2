// RF01-RF11: Global state management with Context API (CORREGIDO UPDATE QUOTATION)
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
  setDoc,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// --- Tus Interfaces ---
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
export interface Attachment {
  id: string;
  nombre: string;
  tipo: string;
  fecha: string;
  url: string;
  storagePath: string;
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
export interface Odontogram {
  id: string;
  fecha: string;
  tipo: 'adulto' | 'niño';
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

// --- FORMULARIOS DE HISTORIA CLÍNICA INICIAL ---
export interface IHistoriaGeneral {
  ocupacion: string;
  escolaridad: string;
  estado_civil: string;
  telefono: string;
  fecha_ult_consulta_medica: string;
  motivo_ult_consulta_medica: string;
  fecha_ult_consulta_odontologica: string;
  motivo_ult_consulta_odontologica: string;
}
export interface IAntecedentesHereditarios {
  madre: string;
  padre: string;
  hermanos: string;
  hijos: string;
  esposo: string;
  tios: string;
  abuelos: string;
}
export interface IAppPatologicos {
  ets: boolean;
  degenerativas: boolean;
  neoplasicas: boolean;
  congenitas: boolean;
  otras: string;
}
export interface IApnp {
  frecuencia_cepillado: string;
  auxiliares_higiene: boolean;
  auxiliares_cuales: string;
  come_entre_comidas: boolean;
  grupo_sanguineo: string;
  adic_tabaco: boolean;
  adic_alcohol: boolean;
}
export interface IAlergias {
  antibioticos: boolean;
  analgesicos: boolean;
  anestesicos: boolean;
  alimentos: boolean;
  especificar: string;
}
export interface IHospitalizaciones {
  ha_sido_hospitalizado: boolean;
  fecha: string;
  motivo: string;
}
export interface ISignosVitales {
  peso_kg: string;
  talla_m: string;
  frecuencia_cardiaca: string;
  tension_arterial_sistolica: string;
  tension_arterial_diastolica: string;
  frecuencia_respiratoria: string;
  temperatura_c: string;
}
export interface IExploracionCabezaCuello {
  cabeza_exostosis: boolean;
  cabeza_endostosis: boolean;
  craneo_tipo: 'dolicocefálico' | 'mesocefálico' | 'braquicefálico' | '';
  cara_asimetria_transversal: boolean;
  cara_asimetria_longitudinal: boolean;
  perfil: 'concavo' | 'convexo' | 'recto' | '';
  piel: 'normal' | 'palida' | 'cianotica' | 'enrojecida' | '';
  musculos: 'hipotonicos' | 'hipertonicos' | 'espasticos' | '';
  cuello_cadena_ganglionar_palpable: boolean;
  otros: string;
}
export interface IExploracionAtm {
  ruidos: boolean;
  lateralidad: string;
  apertura_mm: string;
  chasquidos: boolean;
  crepitacion: boolean;
  dificultad_abrir_boca: boolean;
  dolor_mov_lateralidad: boolean;
  fatiga_dolor_muscular: boolean;
  disminucion_apertura: boolean;
  desviacion_apertura_cierre: boolean;
}
export interface ICavidadOral {
  labio_estado: string; labio_nota: string;
  comisuras_estado: string; comisuras_nota: string;
  carrillos_estado: string; carrillos_nota: string;
  fondo_de_saco_estado: string; fondo_de_saco_nota: string;
  frenillos_estado: string; frenillos_nota: string;
  paladar_estado: string; paladar_nota: string;
  lengua_estado: string; lengua_nota: string;
  piso_boca_estado: string; piso_boca_nota: string;
  dientes_estado: string; dientes_nota: string;
  encia_estado: string; encia_nota: string;
}
export interface IHistoriaClinicaCompleta {
  historiaGeneral: IHistoriaGeneral;
  antecedentesHereditarios: IAntecedentesHereditarios;
  appPatologicos: IAppPatologicos;
  apnp: IApnp;
  alergias: IAlergias;
  hospitalizaciones: IHospitalizaciones;
  signosVitales: ISignosVitales;
  exploracionCabezaCuello: IExploracionCabezaCuello;
  exploracionAtm: IExploracionAtm;
  cavidadOral: ICavidadOral;
}

export const initialState: IHistoriaClinicaCompleta = {
  historiaGeneral: {
    ocupacion: '', escolaridad: '', estado_civil: '', telefono: '',
    fecha_ult_consulta_medica: '', motivo_ult_consulta_medica: '',
    fecha_ult_consulta_odontologica: '', motivo_ult_consulta_odontologica: ''
  },
  antecedentesHereditarios: {
    madre: '', padre: '', hermanos: '', hijos: '', esposo: '', tios: '', abuelos: ''
  },
  appPatologicos: {
    ets: false, degenerativas: false, neoplasicas: false, congenitas: false, otras: ''
  },
  apnp: {
    frecuencia_cepillado: '', auxiliares_higiene: false, auxiliares_cuales: '',
    come_entre_comidas: false, grupo_sanguineo: '', adic_tabaco: false, adic_alcohol: false
  },
  alergias: {
    antibioticos: false, analgesicos: false, anestesicos: false, alimentos: false, especificar: ''
  },
  hospitalizaciones: {
    ha_sido_hospitalizado: false, fecha: '', motivo: ''
  },
  signosVitales: {
    peso_kg: '', talla_m: '', frecuencia_cardiaca: '', tension_arterial_sistolica: '',
    tension_arterial_diastolica: '', frecuencia_respiratoria: '', temperatura_c: ''
  },
  exploracionCabezaCuello: {
    cabeza_exostosis: false, cabeza_endostosis: false, craneo_tipo: '', cara_asimetria_transversal: false,
    cara_asimetria_longitudinal: false, perfil: '', piel: '', musculos: '',
    cuello_cadena_ganglionar_palpable: false, otros: ''
  },
  exploracionAtm: {
    ruidos: false, lateralidad: '', apertura_mm: '', chasquidos: false, crepitacion: false,
    dificultad_abrir_boca: false, dolor_mov_lateralidad: false, fatiga_dolor_muscular: false,
    disminucion_apertura: false, desviacion_apertura_cierre: false
  },
  cavidadOral: {
    labio_estado: '', labio_nota: '', comisuras_estado: '', comisuras_nota: '',
    carrillos_estado: '', carrillos_nota: '', fondo_de_saco_estado: '', fondo_de_saco_nota: '',
    frenillos_estado: '', frenillos_nota: '', paladar_estado: '', paladar_nota: '',
    lengua_estado: '', lengua_nota: '', piso_boca_estado: '', piso_boca_nota: '',
    dientes_estado: '', dientes_nota: '', encia_estado: '', encia_nota: ''
  }
};

interface AppState {
  currentUser: User | null;
  authLoading: boolean;
  patients: Patient[];
  patientsLoading: boolean;
  services: Service[];
  servicesLoading: boolean;
  quotations: Quotation[];
  quotationsLoading: boolean;
  paquetes: Paquete[];
  paquetesLoading: boolean;
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
  addOdontogram: (patientId: string, tipo: 'adulto' | 'niño') => Promise<void>;
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
    currentUser: null,
    authLoading: true,
    patients: [],
    patientsLoading: true,
    services: [],
    servicesLoading: true,
    quotations: [],
    quotationsLoading: true,
    paquetes: [],
    paquetesLoading: true,
    searchQuery: '',
  });

  // Effects
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState((prev) => ({ ...prev, currentUser: user, authLoading: false }));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!state.currentUser) { setState((prev) => ({ ...prev, patients: [], patientsLoading: false })); return; }
    setState((prev) => ({ ...prev, patientsLoading: true }));
    const q = query(collection(db, 'pacientes'));
    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const patientsData: Patient[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, fechaRegistro: data.fechaRegistro?.toDate ? data.fechaRegistro.toDate().toISOString().split('T')[0] : 'N/A' } as Patient;
      });
      setState((prev) => ({ ...prev, patients: patientsData, patientsLoading: false }));
    });
    return () => unsubscribe();
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.currentUser) { setState((prev) => ({ ...prev, services: [], servicesLoading: false })); return; }
    setState((prev) => ({ ...prev, servicesLoading: true }));
    const q = query(collection(db, 'servicios'));
    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const servicesData: Service[] = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Service));
      setState((prev) => ({ ...prev, services: servicesData, servicesLoading: false }));
    });
    return () => unsubscribe();
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.currentUser) { setState((prev) => ({ ...prev, quotations: [], quotationsLoading: false })); return; }
    setState((prev) => ({ ...prev, quotationsLoading: true }));
    const q = query(collection(db, 'cotizaciones'), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const quotationsData: Quotation[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, fecha: data.fecha?.toDate ? data.fecha.toDate().toISOString().split('T')[0] : 'N/A' } as Quotation;
      });
      setState((prev) => ({ ...prev, quotations: quotationsData, quotationsLoading: false }));
    });
    return () => unsubscribe();
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.currentUser) { setState((prev) => ({ ...prev, paquetes: [], paquetesLoading: false })); return; }
    setState((prev) => ({ ...prev, paquetesLoading: true }));
    const q = query(collection(db, 'paquetes'), orderBy('nombre', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const paquetesData: Paquete[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, fechaInicio: data.fechaInicio?.toDate ? data.fechaInicio.toDate().toISOString().split('T')[0] : 'N/A', fechaFin: data.fechaFin?.toDate ? data.fechaFin.toDate().toISOString().split('T')[0] : 'N/A' } as Paquete;
      });
      setState((prev) => ({ ...prev, paquetes: paquetesData, paquetesLoading: false }));
    });
    return () => unsubscribe();
  }, [state.currentUser]);

  const logout = () => { signOut(auth); };

  // CRUDs
  const addPatient = async (patient: Omit<Patient, 'id' | 'fechaRegistro'>): Promise<string> => {
    const newDocRef = await addDoc(collection(db, 'pacientes'), { ...patient, fechaRegistro: serverTimestamp() });
    return newDocRef.id;
  };
  const updatePatient = async (id: string, updates: Partial<Patient>) => { await updateDoc(doc(db, 'pacientes', id), updates); };
  const deletePatient = async (id: string) => { await deleteDoc(doc(db, 'pacientes', id)); };
  const addService = async (service: Omit<Service, 'id'>) => { await addDoc(collection(db, 'servicios'), { ...service, fechaCreacion: serverTimestamp() }); };
  const updateService = async (id: string, updates: Partial<Service>) => { await updateDoc(doc(db, 'servicios', id), updates); };
  const deleteService = async (id: string) => { await deleteDoc(doc(db, 'servicios', id)); };
  const addHistoryEntry = async (patientId: string, entry: Omit<HistoryEntry, 'id'>) => { await addDoc(collection(db, 'pacientes', patientId, 'historial'), { ...entry, fecha: new Date(entry.fecha + "T00:00:00") }); };
  const updateHistoryEntry = async (patientId: string, entryId: string, updates: Partial<HistoryEntry>) => {
    const entryRef = doc(db, 'pacientes', patientId, 'historial', entryId);
    const firestoreUpdates: any = { ...updates };
    if (updates.fecha) firestoreUpdates.fecha = new Date(updates.fecha + "T00:00:00");
    await updateDoc(entryRef, firestoreUpdates);
  };
  const deleteHistoryEntry = async (patientId: string, entryId: string) => { await deleteDoc(doc(db, 'pacientes', patientId, 'historial', entryId)); };
  const addOdontogram = async (patientId: string, tipo: 'adulto' | 'niño') => { await addDoc(collection(db, 'pacientes', patientId, 'odontograma'), { fecha: serverTimestamp(), tipo, dientes: {}, notas: "" }); };
  
  // --- QUOTATIONS ---
  const addQuotation = async (quotation: Omit<Quotation, 'id'>) => { 
    await addDoc(collection(db, 'cotizaciones'), { ...quotation, fecha: new Date(quotation.fecha + "T00:00:00") }); 
  };
  
  // ¡CORREGIDO! Update quotation robusto
  const updateQuotation = async (id: string, updates: Partial<Quotation>) => {
    const quotationRef = doc(db, 'cotizaciones', id);
    const firestoreUpdates: any = { ...updates };
    // Manejo seguro de la fecha
    if (updates.fecha) {
        // Asegurarse que sea string "YYYY-MM-DD" antes de convertir
        const dateStr = typeof updates.fecha === 'string' ? updates.fecha : new Date().toISOString().split('T')[0];
        firestoreUpdates.fecha = new Date(dateStr + "T00:00:00");
    }
    await updateDoc(quotationRef, firestoreUpdates);
  };
  
  const deleteQuotation = async (id: string) => { await deleteDoc(doc(db, 'cotizaciones', id)); };

  const addPaquete = async (paquete: Omit<Paquete, 'id'>) => { await addDoc(collection(db, 'paquetes'), { ...paquete, fechaInicio: new Date(paquete.fechaInicio + "T00:00:00"), fechaFin: new Date(paquete.fechaFin + "T00:00:00"), fechaCreacion: serverTimestamp() }); };
  const updatePaquete = async (id: string, updates: Partial<Paquete>) => {
    const paqueteRef = doc(db, 'paquetes', id);
    const firestoreUpdates: any = { ...updates };
    if (updates.fechaInicio) firestoreUpdates.fechaInicio = new Date(updates.fechaInicio + "T00:00:00");
    if (updates.fechaFin) firestoreUpdates.fechaFin = new Date(updates.fechaFin + "T00:00:00");
    await updateDoc(paqueteRef, firestoreUpdates);
  };
  const deletePaquete = async (id: string) => { await deleteDoc(doc(db, 'paquetes', id)); };

  const setSearchQuery = (query: string) => { setState((prev) => ({ ...prev, searchQuery: query })); };
  const addInitialHistoryForms = async (patientId: string, forms: IHistoriaClinicaCompleta) => {
    const batch = writeBatch(db);
    const basePath = `pacientes/${patientId}/historia_clinica`;
    batch.set(doc(db, basePath, 'historiaGeneral'), forms.historiaGeneral);
    batch.set(doc(db, basePath, 'antecedentesHereditarios'), forms.antecedentesHereditarios);
    batch.set(doc(db, basePath, 'appPatologicos'), forms.appPatologicos);
    batch.set(doc(db, basePath, 'apnp'), forms.apnp);
    batch.set(doc(db, basePath, 'alergias'), forms.alergias);
    batch.set(doc(db, basePath, 'hospitalizaciones'), forms.hospitalizaciones);
    batch.set(doc(db, basePath, 'signosVitales'), forms.signosVitales);
    batch.set(doc(db, basePath, 'exploracionCabezaCuello'), forms.exploracionCabezaCuello);
    batch.set(doc(db, basePath, 'exploracionAtm'), forms.exploracionAtm);
    batch.set(doc(db, basePath, 'cavidadOral'), forms.cavidadOral);
    batch.set(doc(db, `pacientes/${patientId}`), { fechaCreacionHistorial: serverTimestamp() }, { merge: true });
    await batch.commit();
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        logout,
        addPatient,
        updatePatient,
        deletePatient,
        addService,
        updateService,
        deleteService,
        addHistoryEntry,
        updateHistoryEntry,
        deleteHistoryEntry,
        addOdontogram,
        addQuotation,
        updateQuotation,
        deleteQuotation,
        addPaquete,
        updatePaquete,
        deletePaquete,
        setSearchQuery,
        addInitialHistoryForms,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};