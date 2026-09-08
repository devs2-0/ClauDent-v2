export const MARITAL_STATUS_OPTIONS = [
  "Soltero(a)",
  "Casado(a)",
  "Viudo(a)",
  "Divorciado(a)",
  "Unión libre",
] as const;

export const calculatePatientAge = (birthDate?: string): number | null => {
  if (!birthDate) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const birth = dateMatch
    ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    : new Date(birthDate);

  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 && age <= 130 ? age : null;
};

export const getPatientSexLabel = (sex: "M" | "F" | "X") => {
  if (sex === "M") return "Masculino";
  if (sex === "F") return "Femenino";
  return "No especificado";
};

export const hasKnownMaritalStatus = (value?: string) =>
  Boolean(value && MARITAL_STATUS_OPTIONS.some((option) => option === value));

export const hasCompletedInitialHistory = (patient: object) =>
  (patient as { hasHistorial?: unknown }).hasHistorial === true;

export const normalizePatientName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX")
    .replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-MX"));

export type ClinicalHistoryStatus = "none" | "incomplete" | "complete";

export type ClinicalHistorySections = Partial<Record<
  | "historiaGeneral"
  | "antecedentesHereditarios"
  | "appPatologicos"
  | "apnp"
  | "alergias"
  | "hospitalizaciones",
  Record<string, unknown>
>>;

const clinicalHistoryFields = {
  historiaGeneral: [
    "ocupacion",
    "escolaridad",
    "estado_civil",
    "telefono",
    "fecha_ult_consulta_medica",
    "motivo_ult_consulta_medica",
    "fecha_ult_consulta_odontologica",
    "motivo_ult_consulta_odontologica",
  ],
  antecedentesHereditarios: [
    "madre",
    "padre",
    "hermanos",
    "hijos",
    "esposo",
    "tios",
    "abuelos",
  ],
  appPatologicos: ["ets", "degenerativas", "neoplasicas", "congenitas", "otras"],
  apnp: [
    "frecuencia_cepillado",
    "auxiliares_higiene",
    "auxiliares_cuales",
    "come_entre_comidas",
    "grupo_sanguineo",
    "adic_tabaco",
    "adic_alcohol",
  ],
  alergias: ["antibioticos", "analgesicos", "anestesicos", "alimentos", "especificar"],
  hospitalizaciones: ["ha_sido_hospitalizado", "fecha", "motivo"],
} as const;

const hasMeaningfulValue = (value: unknown) => {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
};

const sectionHasAnyValue = (
  section: Record<string, unknown> | undefined,
  fields: readonly string[],
) => Boolean(section && fields.some((field) => hasMeaningfulValue(section[field])));

const sectionIsComplete = (
  section: Record<string, unknown> | undefined,
  fields: readonly string[],
) => Boolean(section && fields.every((field) => hasMeaningfulValue(section[field])));

export const getClinicalHistoryStatus = (
  sections: ClinicalHistorySections,
): ClinicalHistoryStatus => {
  const sectionEntries = Object.entries(clinicalHistoryFields) as Array<
    [keyof typeof clinicalHistoryFields, readonly string[]]
  >;
  const hasAnyHistory = sectionEntries.some(([sectionName, fields]) =>
    sectionHasAnyValue(sections[sectionName], fields),
  );

  if (!hasAnyHistory) return "none";

  const firstTwoComplete =
    sectionIsComplete(sections.historiaGeneral, clinicalHistoryFields.historiaGeneral) &&
    sectionIsComplete(
      sections.antecedentesHereditarios,
      clinicalHistoryFields.antecedentesHereditarios,
    );
  const followingFourHaveData = ([
    "appPatologicos",
    "apnp",
    "alergias",
    "hospitalizaciones",
  ] as const).every((sectionName) =>
    sectionHasAnyValue(sections[sectionName], clinicalHistoryFields[sectionName]),
  );

  return firstTwoComplete && followingFourHaveData ? "complete" : "incomplete";
};
