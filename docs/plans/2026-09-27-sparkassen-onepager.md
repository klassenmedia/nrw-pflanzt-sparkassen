# Plan: Sparkassen-Onepager für NRW pflanzt

Stand 27.09.2026. Grundlage: `handover-nrw-pflanzt-sparkassen.md` (Andreas), Entwurfs-Boards Main/Region.

## Ziel

Onepager „NRW pflanzt · Die rheinischen Sparkassen“ plus 27 Projektseiten je Sparkasse, später unter
`nrw-pflanzt.de/projekte/sparkassen/`. Erst Entwurf (GitHub Pages), danach Übernahme ins WordPress von nrw-pflanzt.de.

## Entscheidungen

- Ursprünglich Look nach robin-gut.org. Seit 01.10.2026 Formen von nrw-pflanzt.de, Farben der Sparkasse (Block 4).
- Schrift Noto Sans (Vorgabe Andreas). robin-gut.org selbst nutzt Poppins, offen, ob umgestellt wird.
- Astro 7 statisch, kein Tailwind: eigenes, unter `.sk` gekapseltes CSS, damit die Übernahme ins WordPress-Theme ohne Konflikte klappt.
- Schriften lokal (DSGVO), keine externen Requests.
- 3D-Insel (Three.js) wird dynamisch nachgeladen, Bäume abhängig von Fortschritt bzw. `stand`.
- Sparkassen-S nicht als Muster verwendet (geschützte Marke), Muster aus dem ROBIN-GUT-Herz.

## Threat Model

- (a) Angreifer: Manipulation der Inhalte über spätere Datenquelle (WordPress), Einbettung in fremde Seiten, eingeschleuste Skripte.
- (b) Untrusted Inputs: CSV-Export von Guidos Excel (Import), `src/data/sparkassen.json` (von Hand änderbar), Termindaten im HTML-Attribut, die das Browser-Skript neu auswertet.
- (c) Worst Case: XSS über Regionentexte auf nrw-pflanzt.de.
- (d) Gegenmaßnahmen: Astro escaped alle Ausdrücke, kein `set:html` mit Daten; Client-Rendering nur über `textContent`; Status nur aus gültigen Terminen (sonst „geplant“), Bäume nur nach Pflanztag, Kinder nur nach Schulaktionstag; Import und Build-Prüfung lehnen negative, gebrochene, unplausibel hohe Zahlen, Dubletten und Sparkassen ohne Kommune ab; Datumswerte nur echtes ISO-Datum; Test-Wächter gegen `set:html`/`innerHTML` und für `noindex`; Termin-JSON per `JSON.parse` in `try` und Typprüfung; CSP ohne `unsafe-inline` für Skripte, `frame-ancestors 'self'`; `noindex` im Live-Build aus.

## Stand

- [x] Übersicht und Projektseiten-Vorlage, 27 Seiten statisch
- [x] Logos Sparkassen im Rheinland, ROBIN GUT, NRW pflanzt (weiße Varianten für dunkle Flächen)
- [x] Tests Logik (`npm test`), Typprüfung (`npm run check`)
- [x] GitHub Pages für den Entwurf
- [ ] Offene Fragen unten klären
- [ ] Übernahme ins WordPress (Theme-Template oder Plugin, Datenquelle CPT „Region“)

## Offen

1. Schrift: Noto Sans behalten oder wie robin-gut.org auf Poppins?
2. Mittelverwendung: Anteile 50/20/30 stammen aus dem Entwurf, mit nrw-pflanzt.de abgleichen.
3. Wie zählen die 50.000 Sparkassen-Bäume in die 1-Million-Zählung?
4. Echte Namen der 27 Sparkassen, Kommunen, Fotos/Videos für den Hero.
5. Freigabe RSGV für Logo-Nutzung, auch im öffentlichen Entwurf.
6. Logo-Rot der Datei (`#E30513`) weicht vom Token `#FF0000` ab, klären, welches Rot digital gilt.

## Call mit Guido Berghoff, 30.09.2026

Beschlossen: abgespeckte Version bis Ende Oktober, statisch ohne CMS, Zahlen aus Guidos Sparkassen-Tabelle.

### Block 1 (umgesetzt, Branch `umsetzung-call-guido`)

- [x] Pflanztagebuch und Presse-/Partnerkit entfernt (Pflegeaufwand, Kit nicht öffentlich).
- [x] Entwurfs-Steuerung und Button „Laufband anhalten“ entfernt. Laufband hält bei Maus-Hover, Tippen und Tab-Fokus an und steht bei „Bewegung reduzieren“ still.
- [x] Status auf drei Stufen: In Planung, Schulaktionstag erfolgt, Gepflanzt.
- [x] Projektseiten je Sparkasse vorerst entfernt, Kacheln ohne Klick. Vorlage liegt in der Git-Historie (Commit `e73b11f`).
- [x] Kacheln aus den Tabellenzeilen, Anzahl dynamisch, Reihenfolge = Zeilenreihenfolge.
- [x] Zähler: gepflanzte Bäume (nur gepflanzt, kein „verplant“), Sparkassen aktiv X / Y (eindeutige Sparkassen), teilgenommene Kommunen, Schulaktionstage, Kinder und Jugendliche.
- [x] Hero: gepflanzt, nächster Schulaktionstag und nächster Pflanztag mit Kommune. Browser rechnet mit dem echten Heute nach, falls länger kein Build kam.
- [x] Kontakt im Footer: Magdalena.

### Block 2: Excel-Import und Security-Review (umgesetzt, gleicher Branch)

- [x] `npm run import -- datei.csv` liest den Excel-Export (Windows-1252 oder UTF-8, Semikolon), schreibt `src/data/sparkassen.json`.
- [x] Status aus den Terminen statt eigener Spalte; „terminieren“ gilt als „noch kein Datum“.
- [x] Review-Funde behoben: Bäume/Kinder nur mit passendem Status, Balken rundet ab, Sparkassen und Kommunen eindeutig gezählt, Stand-Datum aus der Tabelle, Termin-JSON-Prüfung getestet, noindex-Test, Laufband per Tippen/Fokus anhaltbar, tote CSS-Regeln und Icons entfernt.
- [x] Zweiter Review: kaputte Anführungszeichen, leerer Import, doppelte oder mehrdeutige Kopfspalten, Formel-Präfixe, Überlänge und zu viele Zeilen stoppen den Import. Nur eindeutige Spaltennamen für Bäume und Kinder. Import prüft vor dem Schreiben und schreibt über eine Zwischendatei.
- [x] Stichtag: Status und Zahlen beziehen sich auf den Tabellenstand, auch wenn später neu gebaut wird. Nur die Hero-Termine rechnen mit dem echten Heute.
- Probe mit dem Export vom 30.09.2026: Import bricht wie gewollt ab, weil die Spalte „Sparkasse“ fehlt. Mit testweise ergänzter Spalte: 33 Zeilen, 6 aktiv, keine Warnungen.

### Offen aus dem Call

1. Guido ergänzt Spalten „Sparkasse“, „Gepflanzte Bäume“, „Kinder und Jugendliche“. Dann Import mit echten Daten. Ahaus und Kaiserstuhl bekommen keine Sparkasse und bleiben so draußen.
2. Magdalenas Nachname und E-Mail für den Footer.
3. Sparkassen-S auf dem Schild der 3D-Insel: gewünscht, wartet auf RSGV-Logofreigabe.
4. [x] Look and Feel näher an nrw-pflanzt.de, siehe Block 3.
5. Später: MCP, damit Guido selbst aktualisieren kann; Medien-Automatisierung und Projektseiten; Partner-Download-Link mit Passwort.
6. Hero sagt weiter „27 Regionen“ (Verbreitungsgebiete). Die Zahl der Sparkassen kann höher liegen, Guido schätzt rund 50.
7. Laufband ohne sichtbaren Pause-Knopf (Beschluss im Call). Anhalten per Maus, Tippen, Tab-Taste und „Bewegung reduzieren“. Für volle WCAG-2.2.2-Konformität wäre ein kleiner Pause-Knopf sauberer.
8. Ohne JavaScript zeigt der Hero den nächsten Termin vom Build-Tag. Ein automatischer täglicher Build ist nicht eingerichtet, nach jedem Import wird neu gebaut.
9. Semgrep prüft keine `.astro`-Dateien; dort schützt der Test-Wächter gegen HTML-Einfügen.

### Block 3: Look wie nrw-pflanzt.de (Branch `look-nrw-pflanzt`)

Werte aus dem WordPress-Theme von nrw-pflanzt.de übernommen (30.09.2026):

- Hellgrün `#a4d235` für Buttons, Filter und Akzente, Dunkelgrün `#3e721d` für Überschriften, Fließtext Grau `#626262`, Abschnitte mit Grünschleier `#f3faf3`.
- Große Zahlen in `#6f9a1c` statt dem Original `#88b225`, weil das Original auf Weiß nur 2,5 : 1 Kontrast hat (WCAG verlangt 3 : 1 für große Schrift).
- Pillen-Buttons (30 px Rundung), weiße Karten mit 16 bis 24 px Rundung und weichem Schatten, grüner Strich unter Abschnittstiteln.
- Kopfleiste dunkel halbtransparent mit weißer Navigation und weißen Logos, dünne Sparkassen-Linie oben.
- Hero in dunklem Waldgrün statt Rot mit Herzmuster, 3D-Insel bleibt.
- Zählerbereich hell wie „Aktueller Projektstand“ auf nrw-pflanzt.de, Footer hell mit farbigen Logos.
- Kacheln: In Planung Hellgrau, Schulaktionstag Hellgrün, Gepflanzt Dunkelgrün.
- Sparkassenrot bleibt als Partner-Akzent: Linie oben, Werte-Icons der Sparkasse.
- Das Waldfoto von nrw-pflanzt.de wurde bewusst nicht übernommen, weil die Bildrechte unklar sind.

### Block 4: Stil nrw-pflanzt.de, Farben Sparkasse (Branch `sparkassen-farben`)

Andreas am 01.10.2026: Wer von nrw-pflanzt.de kommt, soll sich nicht verlaufen fühlen. Die Farben sollen trotzdem Sparkassenfarben sein, damit die Sparkasse die Seite mag.

- Formen aus Block 3 bleiben: dunkle Kopfleiste, Pillen-Buttons, runde Karten, helle Abschnitte, Zählerstil, heller Footer.
- Hauptfarbe ist das Logo-Rot `#e30513`, das mit weißer Schrift 4,9 : 1 Kontrast hat. Für Text auf hellem Grund `#d30000`, Hover `#c20000`.
- Hero wieder geteilt wie zuvor (Wunsch Andreas): links Sparkassenrot mit ROBIN-GUT-Herzen und Text, rechts die 3D-Insel auf Dunkel. Guido fand Rot mit Herzen im Call gut.
- Überschriften dunkel mit rotem Strich darunter. Zahlen, Fortschrittsbalken, aktive Filter und Ablauf-Kreise in Rot. Abschnitte mit leichter Rot-Tönung `#fbf5f5`.
- Grün nur noch für Bäume: gepflanzte Kacheln, 3D-Insel, ROBIN-GUT-Werte, Anteil Pflanzung im Ring.
- Kachel „Schulaktionstag erfolgt“ in hellem Rot `#f9c9c9`.
- Zählerbereich als dunkler Akzent (Wunsch Andreas), passend zur Inselseite im Hero. Die übrigen Abschnitte wechseln zwischen Weiß und hellem Rosa.

### Erster echter Import (07.10.2026, Branch `tabelle-import-0710`)

- Guidos Export hat jetzt die Spalten Sparkasse, „Anzahl Bäume Sparkasse“ und „Anzahl Schüler“. Der Import kennt diese Namen, „*-“ als „trifft nicht zu“, mehrere Daten pro Zelle (frühestes, mit Hinweis) und ergänzt „Sparkasse“ vor reinen Ortsnamen.
- Entscheidungen Andreas 07.10.: Gepflanzt gilt ab dem Pflanztag. Nur angemeldete Kommunen („Kommune angemeldet: ja“) werden gezeigt und gezählt. Geplantes steht klein neben dem Erledigten: „7 Pflanztage geplant“ unter dem Zähler, „+1 geplant“ bei den Schulaktionstagen.
- Öffentliche Datei: Bäume erst ab Pflanztag, Kinder erst ab Schulaktionstag (`fuerVeroeffentlichung`). Zugesagte Baumzahlen je Sparkasse stehen damit nicht im öffentlichen Repo. An der Anzeige ändert das nichts.
- Ergebnis Stand 07.10.: 22 angemeldete Kommunen, 11 Sparkassen, davon 4 aktiv, 5 Kommunen, 5 Schulaktionstage (+1 geplant), 7 Pflanztage geplant, 790 Kinder, 0 gepflanzt.
- Offen: offizielle Sparkassennamen in der Tabelle (z. B. Stadtsparkasse Mönchengladbach statt „Mönchengladbach“). Wird ein Pflanztag verschoben, muss das Datum in der Tabelle nachgezogen werden, sonst zählen die Bäume trotzdem.
- Microsoft-Connector läuft auf dem KlassenMedia-Mandanten. Die Tabelle liegt bei Robin Gut. Für direktes Lesen den Connector mit dem Robin-Gut-Konto neu verbinden; für einen automatischen Abruf braucht es eine App-Registrierung mit Leserecht nur auf diese Seite.
