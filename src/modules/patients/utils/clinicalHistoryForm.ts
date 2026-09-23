import { initialState, type IHistoriaClinicaCompleta } from "../types/clinicalHistory.types";
import type { Patient } from "../types/patient.types";

export const prepareClinicalHistory = (patient?: Patient, existing?: Partial<IHistoriaClinicaCompleta> | null): IHistoriaClinicaCompleta => {
  const forms = Object.fromEntries(Object.entries(initialState).map(([key, defaults]) => [
    key, { ...defaults, ...existing?.[key as keyof IHistoriaClinicaCompleta] },
  ])) as unknown as IHistoriaClinicaCompleta;
  forms.historiaGeneral.telefono ||= patient?.telefonoPrincipal || '';
  forms.historiaGeneral.estado_civil ||= patient?.estadoCivil || '';
  return forms;
};
