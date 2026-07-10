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
  nombre?: string;
  fecha: string;
  tipo: "adulto" | "niño" | "mixto";
  dientes: { [toothNumber: string]: ToothState };
  notas: string;
}
