import { fechaArgentina } from '../common/utils/hora-argentina';

// Cuota de mensajes a Orbi por día (auditoría interna 10/09, ítem api.orbi;
// hallazgo MEDIO del 04/09 "sin tope de gasto de IA"). Cada mensaje son una o
// varias llamadas pagas a Gemini/Groq, y no había ningún tope por día.
//
// En memoria, como PendingActionStore: con varias instancias de Cloud Run el
// tope real es por instancia. Alcanza para acotar el gasto sin una tabla
// nueva. El día es el de Argentina: la cuota se renueva a la medianoche de acá.
export class CuotaDiaria {
  private dia = '';
  private readonly usos = new Map<string, number>();

  /** Suma un uso a `clave` y dice si todavía entraba en `maximo`. */
  consumir(clave: string, maximo: number): boolean {
    const hoy = fechaArgentina(new Date());
    if (hoy !== this.dia) {
      this.dia = hoy;
      this.usos.clear();
    }
    const usados = this.usos.get(clave) ?? 0;
    if (usados >= maximo) return false;
    this.usos.set(clave, usados + 1);
    return true;
  }
}
