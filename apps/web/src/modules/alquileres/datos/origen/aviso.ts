/**
 * Una escritura que SÍ se hizo, pero con algo que decir: el calendario quedó
 * conectado y Airbnb no lo dejó bajar; se pidió sincronizar y volvió a
 * fallar. No es "No se pudo guardar" (se guardó) ni es para festejar: el
 * panel lo avisa como error con este título, y sigue como con cualquier
 * escritura hecha (ver admin/acciones.ts).
 */
export class HechoConAviso extends Error {
  constructor(readonly titulo: string, detalle: string) {
    super(detalle)
    this.name = 'HechoConAviso'
  }
}
