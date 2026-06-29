export interface HistoryEntry {
  id: string;
  fecha: string;
  servicios: { servicioId: string; cantidad: number }[];
  notas: string;
  total: number;
}

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
  craneo_tipo: string;
  cara_asimetria_transversal: boolean;
  cara_asimetria_longitudinal: boolean;
  perfil: string;
  piel: string;
  musculos: string;
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
  labio_estado: string;
  labio_nota: string;
  comisuras_estado: string;
  comisuras_nota: string;
  carrillos_estado: string;
  carrillos_nota: string;
  fondo_de_saco_estado: string;
  fondo_de_saco_nota: string;
  frenillos_estado: string;
  frenillos_nota: string;
  paladar_estado: string;
  paladar_nota: string;
  lengua_estado: string;
  lengua_nota: string;
  piso_boca_estado: string;
  piso_boca_nota: string;
  dientes_estado: string;
  dientes_nota: string;
  encia_estado: string;
  encia_nota: string;
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
  historiaGeneral: { ocupacion: "", escolaridad: "", estado_civil: "", telefono: "", fecha_ult_consulta_medica: "", motivo_ult_consulta_medica: "", fecha_ult_consulta_odontologica: "", motivo_ult_consulta_odontologica: "" },
  antecedentesHereditarios: { madre: "", padre: "", hermanos: "", hijos: "", esposo: "", tios: "", abuelos: "" },
  appPatologicos: { ets: false, degenerativas: false, neoplasicas: false, congenitas: false, otras: "" },
  apnp: { frecuencia_cepillado: "", auxiliares_higiene: false, auxiliares_cuales: "", come_entre_comidas: false, grupo_sanguineo: "", adic_tabaco: false, adic_alcohol: false },
  alergias: { antibioticos: false, analgesicos: false, anestesicos: false, alimentos: false, especificar: "" },
  hospitalizaciones: { ha_sido_hospitalizado: false, fecha: "", motivo: "" },
  signosVitales: { peso_kg: "", talla_m: "", frecuencia_cardiaca: "", tension_arterial_sistolica: "", tension_arterial_diastolica: "", frecuencia_respiratoria: "", temperatura_c: "" },
  exploracionCabezaCuello: { cabeza_exostosis: false, cabeza_endostosis: false, craneo_tipo: "", cara_asimetria_transversal: false, cara_asimetria_longitudinal: false, perfil: "", piel: "", musculos: "", cuello_cadena_ganglionar_palpable: false, otros: "" },
  exploracionAtm: { ruidos: false, lateralidad: "", apertura_mm: "", chasquidos: false, crepitacion: false, dificultad_abrir_boca: false, dolor_mov_lateralidad: false, fatiga_dolor_muscular: false, disminucion_apertura: false, desviacion_apertura_cierre: false },
  cavidadOral: { labio_estado: "", labio_nota: "", comisuras_estado: "", comisuras_nota: "", carrillos_estado: "", carrillos_nota: "", fondo_de_saco_estado: "", fondo_de_saco_nota: "", frenillos_estado: "", frenillos_nota: "", paladar_estado: "", paladar_nota: "", lengua_estado: "", lengua_nota: "", piso_boca_estado: "", piso_boca_nota: "", dientes_estado: "", dientes_nota: "", encia_estado: "", encia_nota: "" },
};
