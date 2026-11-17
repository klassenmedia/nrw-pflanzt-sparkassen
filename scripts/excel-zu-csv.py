"""Wandelt Guidos Excel-Tabelle in die CSV für `npm run import` um: python3 -I scripts/excel-zu-csv.py <datei.xlsx> <ziel.csv> [Blatt]"""
import sys, csv, datetime, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)
print("Blätter:", wb.sheetnames, file=sys.stderr)
ws = wb[sys.argv[3]] if len(sys.argv) > 3 else wb.worksheets[0]
with open(sys.argv[2], "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";", lineterminator="\r\n")
    for row in ws.iter_rows(values_only=True):
        out = []
        for v in row:
            if v is None: out.append("")
            elif isinstance(v, datetime.datetime): out.append(v.strftime("%d.%m.%Y"))
            elif isinstance(v, float) and v.is_integer(): out.append(str(int(v)))
            else: out.append(str(v))
        if any(out): w.writerow(out)
