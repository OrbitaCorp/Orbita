// Piezas propias del panel de Alquileres (prefijo ala-): la fila de cabecera
// de una lista y la ayuda al pie de una tarjeta. Lo genérico (campos, modal,
// tabla, chips, el indicador con ícono y variación, la barra de guardar) viene
// del kit de reservas del design system; acá va solo lo que el kit no tiene.
export const CSS_PANEL = `
  /* Una fila de la lista con su rótulo y su acción a la derecha. */
  .ala-cab-lista { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }

  /* La ayuda de una página: un renglón chico al pie de una tarjeta. */
  .ala-pie-nota { margin: 12px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--color-muted); }
`

export const EstiloPanelAlquileres = () => <style>{CSS_PANEL}</style>
