# Plan: Sparkassen-Onepager für NRW pflanzt

Stand 27.09.2026. Grundlage: `handover-nrw-pflanzt-sparkassen.md` (Andreas), Entwurfs-Boards Main/Region.

## Ziel

Onepager „NRW pflanzt · Die rheinischen Sparkassen“ plus 27 Projektseiten je Sparkasse, später unter
`nrw-pflanzt.de/projekte/sparkassen/`. Erst Entwurf (GitHub Pages), danach Übernahme ins WordPress von nrw-pflanzt.de.

## Entscheidungen

- Look and feel nach robin-gut.org (geteilter Hero mit Herzmuster, eckige Versalien-Buttons, dunkle Bänder), Farben Sparkasse: Rot `#FF0000`/`#D30000`, Projektgrün `#3F7A23`.
- Schrift Noto Sans (Vorgabe Andreas). robin-gut.org selbst nutzt Poppins, offen, ob umgestellt wird.
- Astro 7 statisch, kein Tailwind: eigenes, unter `.sk` gekapseltes CSS, damit die Übernahme ins WordPress-Theme ohne Konflikte klappt.
- Schriften lokal (DSGVO), keine externen Requests.
- 3D-Insel (Three.js) wird dynamisch nachgeladen, Bäume abhängig von Fortschritt bzw. `stand`.
- Sparkassen-S nicht als Muster verwendet (geschützte Marke), Muster aus dem ROBIN-GUT-Herz.

## Threat Model

- (a) Angreifer: Manipulation der Inhalte über spätere Datenquelle (WordPress), Einbettung in fremde Seiten, eingeschleuste Skripte.
- (b) Untrusted Inputs: Regionendaten (heute Datei, später WordPress), Entwurfs-Steuerung (Slider/Auswahl im Browser), Zwischenablage.
- (c) Worst Case: XSS über Regionentexte auf nrw-pflanzt.de.
- (d) Gegenmaßnahmen: Astro escaped alle Ausdrücke, kein `set:html` mit Daten; Client-Rendering nur über `textContent`; Stand-Werte gegen feste Liste geprüft (unbekannt → Stufe 0); CSP ohne `unsafe-inline` für Skripte, `frame-ancestors 'self'`; Entwurfs-Steuerung und `noindex` im Live-Build aus.

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
