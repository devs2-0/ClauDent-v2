export { default as InitialHistoryModal } from "./components/InitialHistoryModal";
export { default as PatientAntecedentes } from "./components/PatientAntecedentes";
export { default as PatientAttachments } from "./components/PatientAttachments";
export { default as PatientData } from "./components/PatientData";
export { default as PatientHistory } from "./components/PatientHistory";
export { default as PatientOdontogram } from "./components/PatientOdontogram";
export { default as PatientQuotations } from "./components/PatientQuotations";
export { default as OdontogramEditorPage } from "./pages/OdontogramEditorPage";
export { default as PatientRecordPage } from "./pages/PatientRecordPage";
export { default as PatientsPage } from "./pages/PatientsPage";
export { usePatients } from "./hooks/usePatients";
export { PatientsProvider } from "./store/PatientsProvider";
export { initialState } from "./types/clinicalHistory.types";
export type { Attachment, Patient } from "./types/patient.types";
export type {
  HistoryEntry,
  IAlergias,
  IAntecedentesHereditarios,
  IApnp,
  IAppPatologicos,
  ICavidadOral,
  IExploracionAtm,
  IExploracionCabezaCuello,
  IHistoriaClinicaCompleta,
  IHistoriaGeneral,
  IHospitalizaciones,
  ISignosVitales,
} from "./types/clinicalHistory.types";
export type { Odontogram, ToothState } from "./types/odontogram.types";
