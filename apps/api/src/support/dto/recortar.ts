// Recorta antes de validar: el mínimo de largo se medía con los espacios
// incluidos, así que "   a" pasaba como asunto (auditoría interna 10/09,
// ítem api.support). Compartido por todos los DTOs de soporte.
export const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
