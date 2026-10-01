# Deployment bei Mittwald (neben dem WordPress von nrw-pflanzt.de)

nrw-pflanzt.de läuft bei Mittwald (Apache, WordPress). `/projekte/` ist dort bereits eine WordPress-Seite.
Ein echter Ordner `projekte/` im Webroot würde diese Seite blockieren. Deshalb:

1. Live-Build erzeugen:
   ```bash
   PUBLIC_ENTWURF=false npm run build
   ```
2. Inhalt von `dist/` in den Ordner `_sparkassen/` im WordPress-Webroot hochladen (SFTP/rsync).
   `dist/.htaccess` setzt CSP, HSTS, nosniff und Caching nur für diesen Ordner.
3. In die `.htaccess` im Webroot **vor** den Block `# BEGIN WordPress` einfügen:
   ```apache
   RewriteEngine On
   RewriteRule ^projekte/sparkassen/?$ /_sparkassen/index.html [L]
   RewriteRule ^projekte/sparkassen/(.+)$ /_sparkassen/$1 [L]
   ```
4. Prüfen: `/projekte/` (WordPress) lädt weiter, `/projekte/sparkassen/` lädt den Onepager.

Rollback: Die drei Zeilen aus der Webroot-`.htaccess` entfernen. WordPress bleibt unberührt.

Die Datei `.htaccess` im Webroot wird von WordPress beim Speichern der Permalinks nur innerhalb von `# BEGIN/END WordPress` neu geschrieben. Die Zeilen davor bleiben erhalten.
