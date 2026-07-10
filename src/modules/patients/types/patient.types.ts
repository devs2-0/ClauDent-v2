export interface Patient {
  id: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: "M" | "F" | "X";
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
  estado: "activo" | "inactivo";
  fechaRegistro: string;
}

export interface Attachment {
  id: string;
  nombre: string;
  tipo: string;
  fecha: string;
  url: string;
  storagePath: string;
  subidoPor?: string | null;
}
