import json
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REGISTRO_JSON = os.path.join(ROOT, "apps", "api", "data", "leads-misiones-registro.json")

EXCEL_1 = os.path.join(ROOT, "leads-01-tiendas-online-misiones.xlsx")
EXCEL_2 = os.path.join(ROOT, "leads-02-nuevos-rubros-misiones.xlsx")
EXCEL_3 = os.path.join(ROOT, "leads-03-consolidado-orbita-misiones.xlsx")

ZONA_ORDEN = {"Norte": 1, "Centro-Norte": 2, "Centro": 3, "Centro-Este": 4, "Sur": 5, "Misiones": 6}
RUBRO_ORDEN = {"TIENDA": 1, "TURNOS": 2, "ALQUILERES": 3, "GIMNASIO": 4, "POS": 5}
RUBRO_LABEL = {
    "TIENDA": "Tienda Online",
    "TURNOS": "Turnos",
    "ALQUILERES": "Alquileres",
    "GIMNASIO": "Gimnasios",
    "POS": "POS / Mostrador",
}
CLASIF_LABEL = {
    "POTENCIAL_LOCAL": "Potencial cliente (Iguazú)",
    "PILOTO": "Piloto (Iguazú · Cortesía 3m)",
    "LEAD": "Lead (Venta cerrada)",
}

HEADERS = [
    "Rubro",
    "Subrubro",
    "Tipo (Piloto / Lead)",
    "Zona",
    "Departamento",
    "Localidad",
    "Negocio",
    "Canal de Contacto",
    "Teléfono",
    "WhatsApp",
    "Instagram",
    "Link Instagram",
    "Web / Canal actual",
    "Reseñas Maps",
    "Dirección",
    "Contactado",
    "Estado",
    "Responsable",
    "Notas",
]

FONT_NAME = "Calibri"
HEADER_FILL = PatternFill("solid", fgColor="1E293B")
HEADER_FONT = Font(name=FONT_NAME, size=10.5, bold=True, color="FFFFFF")
ZEBRA_FILL = PatternFill("solid", fgColor="F8FAFC")
WHITE_FILL = PatternFill("solid", fgColor="FFFFFF")
TOTAL_FILL = PatternFill("solid", fgColor="E2E8F0")
TITLE_FILL = PatternFill("solid", fgColor="0F172A")

BODY_FONT = Font(name=FONT_NAME, size=10, color="0F172A")
BOLD_FONT = Font(name=FONT_NAME, size=10, bold=True, color="0F172A")
MUTED_FONT = Font(name=FONT_NAME, size=10, color="64748B")
WA_FONT = Font(name=FONT_NAME, size=10, bold=True, color="15803D", underline="single")
IG_FONT = Font(name=FONT_NAME, size=10, color="1D4ED8", underline="single")

CLASIF_STYLES = {
    "PILOTO": (PatternFill("solid", fgColor="DBEAFE"), Font(name=FONT_NAME, size=10, bold=True, color="1E40AF")),
    "POTENCIAL_LOCAL": (PatternFill("solid", fgColor="DCFCE7"), Font(name=FONT_NAME, size=10, bold=True, color="166534")),
    "LEAD": (PatternFill("solid", fgColor="F1F5F9"), Font(name=FONT_NAME, size=10, color="475569")),
}

CANAL_STYLES = {
    "Ambos (WPP + IG)": (PatternFill("solid", fgColor="DCFCE7"), Font(name=FONT_NAME, size=10, bold=True, color="166534")),
    "Solo WhatsApp": (PatternFill("solid", fgColor="E0F2FE"), Font(name=FONT_NAME, size=10, bold=True, color="075985")),
    "Solo Instagram": (PatternFill("solid", fgColor="FCE7F3"), Font(name=FONT_NAME, size=10, bold=True, color="9D174D")),
    "Presencial Iguazú": (PatternFill("solid", fgColor="FEF3C7"), Font(name=FONT_NAME, size=10, bold=True, color="92400E")),
}

THIN_SIDE = Side(style="thin", color="E2E8F0")
MED_DARK = Side(style="medium", color="94A3B8")
CELL_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)
TOTAL_BORDER = Border(top=MED_DARK, bottom=MED_DARK, left=THIN_SIDE, right=THIN_SIDE)

ALIGN_LEFT = Alignment(horizontal="left", vertical="center")
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")

DV_CONTACTADO = '"No,Sí"'
DV_ESTADO = '"Nuevo,Contactado,Respondió,Demo,Piloto activo,Cliente,Descartado,No contactar"'
DV_EQUIPO = '"Mateo,Alan,Mili,Ale"'


def construir_fila(item):
    rubro = item["rubro"]
    clasif = "POTENCIAL_LOCAL" if item.get("clasificacion") == "PILOTO" else item["clasificacion"]
    wa_url = item.get("whatsappUrl")
    ig = item.get("instagram")
    ig_handle = ig.lstrip("@").lower() if ig else None
    ig_url = f"https://www.instagram.com/{ig_handle}/" if ig_handle else None
    ig_disp = f"instagram.com/{ig_handle}" if ig_handle else "—"

    if wa_url and ig_url:
        canal = "Ambos (WPP + IG)"
    elif wa_url:
        canal = "Solo WhatsApp"
    elif ig_url:
        canal = "Solo Instagram"
    else:
        canal = "Presencial Iguazú"

    clasif_txt = (
        "Posible piloto (Iguazú)"
        if (clasif == "POTENCIAL_LOCAL" and rubro != "TIENDA")
        else CLASIF_LABEL[clasif]
    )

    return {
        "rubro_id": rubro,
        "rubro": RUBRO_LABEL[rubro],
        "subrubro": item["subrubro"],
        "clasif_id": clasif,
        "clasif": clasif_txt,
        "zona": item["zona"],
        "depto": item["departamento"],
        "localidad": item["localidad"],
        "negocio": item["negocio"],
        "canal": canal,
        "telefono": item.get("telefono") or "—",
        "wa_url": wa_url,
        "instagram": ig or "—",
        "ig_url": ig_url,
        "ig_display": ig_disp,
        "web": item.get("webActual") or "Sin sitio web",
        "resenas": item.get("resenas") or "—",
        "direccion": item.get("direccion") or "—",
        "fuente": item.get("fuente") or "Google Maps",
    }


def sort_key(r):
    clasif_ord = 0 if r["clasif_id"] == "PILOTO" else 1 if r["clasif_id"] == "POTENCIAL_LOCAL" else 2
    ig_ord = 0 if r["localidad"] == "Puerto Iguazú" else 1
    has_tel = 1 if r["wa_url"] else 0
    has_ig = 1 if r["ig_url"] else 0
    return (
        RUBRO_ORDEN[r["rubro_id"]],
        clasif_ord,
        ig_ord,
        ZONA_ORDEN.get(r["zona"], 9),
        r["localidad"],
        -(has_tel + has_ig),
        r["negocio"].lower(),
    )


def safe_sheet_title(name):
    return name[:31]


def poblar_hoja(ws, rows):
    ws.views.sheetView[0].showGridLines = True
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 26
    for i, h in enumerate(HEADERS, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = ALIGN_CENTER if i in (3, 8, 10, 14, 16, 17) else ALIGN_LEFT
        c.border = CELL_BORDER

    for idx, r in enumerate(rows, start=2):
        ws.row_dimensions[idx].height = 21
        fill = ZEBRA_FILL if idx % 2 == 0 else WHITE_FILL
        vals = [
            r["rubro"],
            r["subrubro"],
            r["clasif"],
            r["zona"],
            r["depto"],
            r["localidad"],
            r["negocio"],
            r["canal"],
            r["telefono"],
            "Abrir WhatsApp" if r["wa_url"] else "—",
            r["instagram"],
            r["ig_display"] if r["ig_url"] else "—",
            r["web"],
            r["resenas"],
            r["direccion"],
            "No",
            "Nuevo",
            "",
            "",
        ]
        for col_i, val in enumerate(vals, start=1):
            c = ws.cell(row=idx, column=col_i, value=val)
            c.fill = fill
            c.border = CELL_BORDER
            c.font = BODY_FONT
            c.alignment = ALIGN_LEFT

            if col_i == 7:
                c.font = BOLD_FONT
            elif col_i == 3:
                cf, cfont = CLASIF_STYLES[r["clasif_id"]]
                c.fill = cf
                c.font = cfont
                c.alignment = ALIGN_CENTER
            elif col_i == 8:
                cf, cfont = CANAL_STYLES[r["canal"]]
                c.fill = cf
                c.font = cfont
                c.alignment = ALIGN_CENTER
            elif col_i == 10 and r["wa_url"]:
                c.hyperlink = r["wa_url"]
                c.font = WA_FONT
                c.alignment = ALIGN_CENTER
            elif col_i == 12 and r["ig_url"]:
                c.hyperlink = r["ig_url"]
                c.font = IG_FONT
            elif col_i in (14, 16, 17):
                c.alignment = ALIGN_CENTER

            if val == "—":
                c.font = MUTED_FONT

    last_row = max(len(rows) + 1, 2)
    ws.auto_filter.ref = f"A1:{get_column_letter(len(HEADERS))}{last_row}"

    if len(rows) > 0:
        for col_letter, formula in (("P", DV_CONTACTADO), ("Q", DV_ESTADO), ("R", DV_EQUIPO)):
            dv = DataValidation(type="list", formula1=formula, allow_blank=True)
            ws.add_data_validation(dv)
            dv.add(f"{col_letter}2:{col_letter}{last_row}")

    base_widths = {
        1: 16, 2: 26, 3: 27, 4: 13, 5: 22, 6: 20, 7: 34, 8: 20, 9: 19,
        10: 16, 11: 26, 12: 30, 13: 28, 14: 13, 15: 34, 16: 12, 17: 15, 18: 14, 19: 26,
    }
    for col_i, bw in base_widths.items():
        max_len = max([len(str(ws.cell(row=r, column=col_i).value or "")) for r in range(1, last_row + 1)])
        ws.column_dimensions[get_column_letter(col_i)].width = min(max(bw, max_len + 3), 44)


def poblar_resumen_generico(ws, titulo, subtitulo, main_sheet, rows, group_col_letter, group_title, group_values):
    ws.views.sheetView[0].showGridLines = True
    ws.merge_cells("A1:F1")
    ws.row_dimensions[1].height = 32
    t = ws["A1"]
    t.value = titulo
    t.fill = TITLE_FILL
    t.font = Font(name=FONT_NAME, size=14, bold=True, color="FFFFFF")
    t.alignment = Alignment(horizontal="left", vertical="center", indent=1)

    ws.merge_cells("A2:F2")
    ws.row_dimensions[2].height = 20
    sub = ws["A2"]
    sub.value = subtitulo
    sub.fill = PatternFill("solid", fgColor="F1F5F9")
    sub.font = Font(name=FONT_NAME, size=10, italic=True, color="334155")
    sub.alignment = Alignment(horizontal="left", vertical="center", indent=1)

    last_all = len(rows) + 1

    ws.merge_cells("A4:F4")
    ws.row_dimensions[4].height = 24
    s1 = ws["A4"]
    s1.value = f"1. Resumen por {group_title}"
    s1.font = Font(name=FONT_NAME, size=11.5, bold=True, color="0F172A")

    h1 = [group_title, "Total", "Pilotos / Potenciales", "Con WhatsApp", "Con Instagram", "Contactados"]
    ws.row_dimensions[5].height = 24
    for i, h in enumerate(h1, start=1):
        c = ws.cell(row=5, column=i, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = ALIGN_CENTER if i >= 2 else ALIGN_LEFT
        c.border = CELL_BORDER

    r_idx = 6
    start_1 = r_idx
    for idx, val in enumerate(group_values):
        ws.row_dimensions[r_idx].height = 20
        fill = ZEBRA_FILL if idx % 2 == 1 else WHITE_FILL
        c_lbl = ws.cell(row=r_idx, column=1, value=val)
        c_tot = ws.cell(row=r_idx, column=2, value=f"=COUNTIF('{main_sheet}'!${group_col_letter}$2:${group_col_letter}${last_all}, A{r_idx})")
        c_pil = ws.cell(
            row=r_idx,
            column=3,
            value=(
                f"=COUNTIFS('{main_sheet}'!${group_col_letter}$2:${group_col_letter}${last_all}, A{r_idx}, '{main_sheet}'!$C$2:$C${last_all}, \"Piloto*\")"
                f"+COUNTIFS('{main_sheet}'!${group_col_letter}$2:${group_col_letter}${last_all}, A{r_idx}, '{main_sheet}'!$C$2:$C${last_all}, \"Potencial*\")"
                f"+COUNTIFS('{main_sheet}'!${group_col_letter}$2:${group_col_letter}${last_all}, A{r_idx}, '{main_sheet}'!$C$2:$C${last_all}, \"Posible*\")"
            ),
        )
        c_wa = ws.cell(row=r_idx, column=4, value=f"=COUNTIFS('{main_sheet}'!${group_col_letter}$2:${group_col_letter}${last_all}, A{r_idx}, '{main_sheet}'!$I$2:$I${last_all}, \"<>—\")")
        c_ig = ws.cell(row=r_idx, column=5, value=f"=COUNTIFS('{main_sheet}'!${group_col_letter}$2:${group_col_letter}${last_all}, A{r_idx}, '{main_sheet}'!$K$2:$K${last_all}, \"<>—\")")
        c_ok = ws.cell(row=r_idx, column=6, value=f"=COUNTIFS('{main_sheet}'!${group_col_letter}$2:${group_col_letter}${last_all}, A{r_idx}, '{main_sheet}'!$P$2:$P${last_all}, \"Sí\")")

        for col_i, cell in enumerate((c_lbl, c_tot, c_pil, c_wa, c_ig, c_ok), start=1):
            cell.fill = fill
            cell.border = CELL_BORDER
            cell.font = BOLD_FONT if col_i == 1 else BODY_FONT
            cell.alignment = ALIGN_RIGHT if col_i >= 2 else ALIGN_LEFT
            if col_i >= 2:
                cell.number_format = "#,##0"
        r_idx += 1

    end_1 = r_idx - 1
    ws.row_dimensions[r_idx].height = 22
    ws.cell(row=r_idx, column=1, value="TOTAL").font = BOLD_FONT
    for col_i in range(1, 7):
        c = ws.cell(row=r_idx, column=col_i)
        c.fill = TOTAL_FILL
        c.border = TOTAL_BORDER
        if col_i >= 2:
            col_l = get_column_letter(col_i)
            c.value = f"=SUM({col_l}{start_1}:{col_l}{end_1})"
            c.font = BOLD_FONT
            c.alignment = ALIGN_RIGHT
            c.number_format = "#,##0"

    t2_row = r_idx + 2
    ws.merge_cells(f"A{t2_row}:D{t2_row}")
    ws.row_dimensions[t2_row].height = 24
    ws.cell(row=t2_row, column=1, value="2. Resumen por Canal de Contacto").font = Font(name=FONT_NAME, size=11.5, bold=True, color="0F172A")

    h2_row = t2_row + 1
    ws.row_dimensions[h2_row].height = 24
    for i, h in enumerate(["Canal de Contacto", "Total", "Contactados", "% del Total"], start=1):
        c = ws.cell(row=h2_row, column=i, value=h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = ALIGN_CENTER if i >= 2 else ALIGN_LEFT
        c.border = CELL_BORDER

    canales = ["Ambos (WPP + IG)", "Solo WhatsApp", "Solo Instagram", "Presencial Iguazú"]
    r_idx = h2_row + 1
    start_2 = r_idx
    tot_2_row = start_2 + len(canales)
    for idx, ch in enumerate(canales):
        ws.row_dimensions[r_idx].height = 20
        fill = ZEBRA_FILL if idx % 2 == 1 else WHITE_FILL
        c1 = ws.cell(row=r_idx, column=1, value=ch)
        c2 = ws.cell(row=r_idx, column=2, value=f"=COUNTIF('{main_sheet}'!$H$2:$H${last_all}, A{r_idx})")
        c3 = ws.cell(row=r_idx, column=3, value=f"=COUNTIFS('{main_sheet}'!$H$2:$H${last_all}, A{r_idx}, '{main_sheet}'!$P$2:$P${last_all}, \"Sí\")")
        c4 = ws.cell(row=r_idx, column=4, value=f"=B{r_idx}/$B${tot_2_row}")
        cf, cfont = CANAL_STYLES[ch]
        c1.fill, c1.font, c1.border, c1.alignment = cf, cfont, CELL_BORDER, ALIGN_LEFT
        for col_i, cell, fmt in ((2, c2, "#,##0"), (3, c3, "#,##0"), (4, c4, "0.0%")):
            cell.fill, cell.font, cell.border, cell.alignment, cell.number_format = fill, BODY_FONT, CELL_BORDER, ALIGN_RIGHT, fmt
        c2.font = BOLD_FONT
        r_idx += 1

    end_2 = r_idx - 1
    ws.row_dimensions[r_idx].height = 22
    ws.cell(row=r_idx, column=1, value="TOTAL").font = BOLD_FONT
    for col_i in range(1, 5):
        c = ws.cell(row=r_idx, column=col_i)
        c.fill = TOTAL_FILL
        c.border = TOTAL_BORDER
        if col_i >= 2:
            col_l = get_column_letter(col_i)
            c.value = f"=SUM({col_l}{start_2}:{col_l}{end_2})"
            c.font = BOLD_FONT
            c.alignment = ALIGN_RIGHT
            c.number_format = "0.0%" if col_i == 4 else "#,##0"

    for col_i, w in {1: 28, 2: 14, 3: 22, 4: 16, 5: 16, 6: 14}.items():
        ws.column_dimensions[get_column_letter(col_i)].width = w


def generar_excel_1_tiendas(tiendas):
    wb = openpyxl.Workbook()
    ws_res = wb.active
    ws_res.title = "Resumen"
    locs = []
    for r in tiendas:
        if r["localidad"] not in locs:
            locs.append(r["localidad"])
    main_tab = safe_sheet_title(f"Todas ({len(tiendas)})")
    poblar_resumen_generico(
        ws_res,
        "Órbita · Excel 1: Tiendas Online (Misiones)",
        f"{len(tiendas)} tiendas independientes sin ecommerce propio · Puerto Iguazú marcado como potencial cliente local",
        main_tab,
        tiendas,
        "F",
        "Localidad",
        locs,
    )

    tabs = [
        ("Potenciales Iguazú", [r for r in tiendas if r["clasif_id"] == "POTENCIAL_LOCAL"]),
        ("WPP + IG (Ambos)", [r for r in tiendas if r["canal"] == "Ambos (WPP + IG)"]),
        ("Solo WhatsApp", [r for r in tiendas if r["canal"] == "Solo WhatsApp"]),
        ("Solo Instagram", [r for r in tiendas if r["canal"] == "Solo Instagram"]),
        ("Presencial Iguazú", [r for r in tiendas if r["canal"] == "Presencial Iguazú"]),
        (main_tab, tiendas),
    ]
    for name, subset in tabs:
        poblar_hoja(wb.create_sheet(safe_sheet_title(name)), subset)

    for loc in ["Puerto Iguazú", "Posadas", "Eldorado", "Oberá"]:
        poblar_hoja(wb.create_sheet(safe_sheet_title(loc)), [r for r in tiendas if r["localidad"] == loc])

    wb.save(EXCEL_1)
    print(f"OK Excel 1: {EXCEL_1} ({len(tiendas)} filas)")


def generar_excel_2_nuevos_rubros(nuevos):
    wb = openpyxl.Workbook()
    ws_res = wb.active
    ws_res.title = "Resumen"
    rubros = ["Turnos", "Alquileres", "Gimnasios", "POS / Mostrador"]
    main_tab = safe_sheet_title(f"Todos Nuevos ({len(nuevos)})")
    pos_iguazu = [r for r in nuevos if r["clasif_id"] == "POTENCIAL_LOCAL"]
    resto = [r for r in nuevos if r["localidad"] != "Puerto Iguazú"]

    poblar_resumen_generico(
        ws_res,
        "Órbita · Excel 2: Nuevos Rubros — Posibles Pilotos y Leads (Misiones)",
        f"{len(nuevos)} negocios en Turnos, Alquileres, Gimnasios y POS · 0/5 pilotos asignados ({len(pos_iguazu)} posibles pilotos en Iguazú)",
        main_tab,
        nuevos,
        "A",
        "Rubro",
        rubros,
    )

    tabs = [
        (f"Posibles Iguazú ({len(pos_iguazu)})", pos_iguazu),
        ("Turnos", [r for r in nuevos if r["rubro_id"] == "TURNOS"]),
        ("Alquileres", [r for r in nuevos if r["rubro_id"] == "ALQUILERES"]),
        ("Gimnasios", [r for r in nuevos if r["rubro_id"] == "GIMNASIO"]),
        ("POS", [r for r in nuevos if r["rubro_id"] == "POS"]),
        (f"Resto Misiones ({len(resto)})", resto),
        (main_tab, nuevos),
    ]
    for name, subset in tabs:
        poblar_hoja(wb.create_sheet(safe_sheet_title(name)), subset)

    wb.save(EXCEL_2)
    print(f"OK Excel 2: {EXCEL_2} ({len(nuevos)} filas)")


def generar_excel_3_consolidado(todos):
    wb = openpyxl.Workbook()
    ws_res = wb.active
    ws_res.title = "Resumen"
    rubros = ["Tienda Online", "Turnos", "Alquileres", "Gimnasios", "POS / Mostrador"]
    main_tab = safe_sheet_title(f"Todos ({len(todos)})")
    iguazu = [r for r in todos if r["localidad"] == "Puerto Iguazú"]
    resto = [r for r in todos if r["localidad"] != "Puerto Iguazú"]
    pos_pilotos = [r for r in todos if r["rubro_id"] != "TIENDA" and r["clasif_id"] == "POTENCIAL_LOCAL"]
    pot_tiendas = [r for r in todos if r["rubro_id"] == "TIENDA" and r["clasif_id"] == "POTENCIAL_LOCAL"]

    poblar_resumen_generico(
        ws_res,
        "Órbita · Excel 3: Consolidado Total Misiones (5 Rubros)",
        f"{len(todos)} negocios en Misiones · 0 pilotos pre-asignados · {len(iguazu)} en Puerto Iguazú · {len(resto)} Leads resto",
        main_tab,
        todos,
        "A",
        "Rubro",
        rubros,
    )

    tabs = [
        (main_tab, todos),
        (f"Puerto Iguazú ({len(iguazu)})", iguazu),
        (f"Resto Misiones ({len(resto)})", resto),
        (f"Posibles Pilotos ({len(pos_pilotos)})", pos_pilotos),
        (f"Potenciales Tienda ({len(pot_tiendas)})", pot_tiendas),
    ]
    for name, subset in tabs:
        poblar_hoja(wb.create_sheet(safe_sheet_title(name)), subset)

    wb.save(EXCEL_3)
    print(f"OK Excel 3: {EXCEL_3} ({len(todos)} filas)")


def main():
    with open(REGISTRO_JSON, "r", encoding="utf-8") as f:
        registro = json.load(f)
    todos = sorted([construir_fila(item) for item in registro["leads"]], key=sort_key)
    tiendas = [r for r in todos if r["rubro_id"] == "TIENDA"]
    nuevos = [r for r in todos if r["rubro_id"] != "TIENDA"]

    generar_excel_1_tiendas(tiendas)
    generar_excel_2_nuevos_rubros(nuevos)
    generar_excel_3_consolidado(todos)


if __name__ == "__main__":
    main()
