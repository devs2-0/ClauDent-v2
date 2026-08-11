import { useMemo } from "react";

import type { Assistant, Doctor, AgendaStaffType } from "../types/agenda.types";
import SearchableSelect, {
  type SearchableSelectOption,
} from "./SearchableSelect";

interface StaffSearchSelectProps {
  id?: string;
  staffType: AgendaStaffType;
  doctors: Doctor[];
  assistants: Assistant[];
  value: string;
  placeholder?: string;
  emptyMessage?: string;
  onValueChange: (staffId: string) => void;
}

const StaffSearchSelect = ({
  id,
  staffType,
  doctors,
  assistants,
  value,
  placeholder,
  emptyMessage,
  onValueChange,
}: StaffSearchSelectProps) => {
  const options = useMemo<SearchableSelectOption[]>(() => {
    if (staffType === "doctor") {
      return doctors.map((doctor) => ({
        value: doctor.id,
        label: doctor.nombre,
        description: doctor.especialidad || "Sin especialidad",
        searchText: [
          doctor.nombre,
          doctor.email ?? "",
          doctor.telefono ?? "",
          doctor.especialidad ?? "",
        ].join(" "),
      }));
    }

    return assistants.map((assistant) => ({
      value: assistant.id,
      label: assistant.nombre,
      description:
        assistant.doctorIdsAsignados.length > 0
          ? `${assistant.doctorIdsAsignados.length} doctor(es) asignado(s)`
          : "Sin doctores asignados",
      searchText: [
        assistant.nombre,
        assistant.email ?? "",
        assistant.telefono ?? "",
        assistant.notas ?? "",
      ].join(" "),
    }));
  }, [assistants, doctors, staffType]);

  return (
    <SearchableSelect
      id={id}
      options={options}
      value={value}
      placeholder={
        placeholder ??
        (staffType === "doctor" ? "Buscar doctor..." : "Buscar asistente...")
      }
      emptyMessage={
        emptyMessage ??
        (staffType === "doctor"
          ? "No se encontraron doctores."
          : "No se encontraron asistentes.")
      }
      onValueChange={(nextValue) => onValueChange(nextValue)}
    />
  );
};

export default StaffSearchSelect;