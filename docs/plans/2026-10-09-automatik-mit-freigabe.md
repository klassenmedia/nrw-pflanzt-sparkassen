# Plan: Automatische Aktualisierung mit Freigabe per Mail

Stand 09.10.2026. Wunsch Andreas: Ein Dienst prüft die Excel regelmäßig. Bevor sich auf der Live-Seite etwas ändert, bekommen Guido und Andreas eine Mail mit dem, was sich ändern würde, und geben per Link frei.

## Ablauf

1. **Abruf** (stündlich zwischen 7 und 20 Uhr): Der Dienst liest die Excel direkt aus SharePoint (Microsoft Graph, App mit Leserecht nur auf diese eine Seite).
2. **Prüfen**: Gleiche Regeln wie heute (`leseTabelle`, `fuerVeroeffentlichung`, `pruefeDaten`). Bei Fehlern keine Freigabe-Mail, sondern eine Fehler-Mail mit Grund. Die Live-Seite bleibt unverändert.
3. **Nichts geändert**: Ist das Ergebnis identisch mit dem Live-Stand, passiert nichts. Keine Mail.
4. **Vorschau bauen**: Neue Fassung in einen eigenen Vorschau-Ordner, nicht verlinkt, `noindex`.
5. **Mail an Guido und Andreas** mit
   - Klartext-Liste der Änderungen: Kennzahlen vorher/nachher (zugesagt, gepflanzt, Sparkassen, Städte und Gemeinden, Schulaktionstage, Kinder), neue oder geänderte Termine, Status-Wechsel, neue oder entfernte Kacheln, Hinweise des Imports;
   - Screenshot der Vorschau (Kopf und Zähler);
   - Link „Vorschau ansehen“, Link „Freigeben“, Link „Verwerfen“.
6. **Freigabe**: Ein Klick von Guido **oder** Andreas genügt (offen, siehe unten). Danach Upload nach `_sparkassen/` und Bestätigungs-Mail.
7. **Rückweg**: Die letzten 10 freigegebenen Stände bleiben auf dem Server; jede Bestätigungs-Mail enthält „Zurücksetzen auf vorherigen Stand“.

## Technische Entscheidungen

- Läuft auf dem eigenen Server (jetzt CX33, später Stiftungs-Server), nicht bei GitHub: Zugangsdaten zu Microsoft und Mittwald bleiben bei Robin Gut.
- Freigabe-Links: signiert (HMAC), einmalig, 7 Tage gültig, gebunden an genau diesen Stand (Prüfsumme der Vorschau). Kommt vorher eine neuere Änderung, verfällt der alte Link.
- Ein Link öffnet nur eine Bestätigungsseite mit Knopf (POST). Grund: Mail-Programme wie Outlook rufen Links vorab automatisch auf (Safe Links) und würden sonst ungewollt freigeben.
- Upload per SSH-Schlüssel, nach Möglichkeit eingeschränkt auf den Ordner `_sparkassen`.
- Mails über ein eigenes Absender-Postfach (SMTP), Zugangsdaten nur auf dem Server.

## Threat Model

- (a) Angreifer: Wer eine Freigabe-Mail abfängt oder weiterleitet; Mail-Scanner, die Links aufrufen; jemand, der die Excel manipuliert; Angriff auf den Server-Dienst selbst.
- (b) Untrusted Inputs: Excel-Inhalt aus SharePoint, Aufrufe der Freigabe-Links (Token, Methode, Wiederholung), Antworten von Microsoft Graph.
- (c) Worst Case: Falsche Zahlen gehen ohne Zustimmung live; Zugang zum Mittwald-Webspace (dort liegt auch das WordPress) wird missbraucht; vertrauliche Zusagen je Sparkasse werden öffentlich.
- (d) Gegenmaßnahmen: Import-Prüfung wie bisher, sonst kein Build; Freigabe nur per POST mit signiertem, einmaligem, verfallendem Token, gebunden an die Prüfsumme; Rate-Limit auf den Freigabe-Endpunkt; SSH-Schlüssel nur für diesen Dienst und möglichst auf `_sparkassen` beschränkt; Microsoft-App nur mit Leserecht auf eine Seite; keine Zusagen je Sparkasse in Mail, Vorschau oder öffentlicher Datei (nur Summen); Protokoll jeder Freigabe (wer, wann, welcher Stand).

## Offen

1. Reicht ein Klick von Guido **oder** Andreas, oder müssen beide freigeben?
2. Intervall: stündlich 7–20 Uhr ok?
3. Absender-Postfach für die Mails (z. B. noreply@ bei Robin Gut)?
4. Microsoft-Admin bei Robin Gut für die App-Registrierung.
5. Vertraulichkeit ab dem ersten Pflanztag (18.11.2026), siehe Threat Model c2 im Onepager-Plan.

## Stand

- [ ] Offene Punkte klären
- [ ] SSH-Zugang für den Dienst
- [ ] Microsoft-App
- [ ] Umsetzung in Etappen (Abruf und Prüfung → Vorschau und Mail → Freigabe-Endpunkt → Upload und Rückweg), jeweils mit Tests und Security-Review
