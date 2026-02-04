import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Calculate age from birth date
export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}


// Pesos Mexicanos
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { // Cambiado de es-CL a es-MX
    style: 'currency',
    currency: 'MXN', // Cambiado de CLP a MXN
    minimumFractionDigits: 2, // México usa centavos
  }).format(amount);
}

// Format date
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format RUT with dots and dash
export function formatRut(rut: string): string {
  const cleaned = rut.replace(/[^0-9kK]/g, '');
  if (cleaned.length < 2) return cleaned;
  
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
}
