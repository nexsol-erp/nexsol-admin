pg_restore -h localhost -p 5432 -U postgres -d nexsoldb -F c "E:\nexsol-admin\nexsoldb.dump"
pg_restore -h localhost -p 5432 -U postgres -d 9446968394a -F c "E:\nexsol-admin\9446968394a.dump"


Standard pg_dump approach. Run these on your local machine:

Step 1 — Dump from server:

pg_dump -h localhost -p 5432 -U postgres -d 9446968394a -F c -f 9446968394a.dump
pg_dump -h localhost -p 5432 -U  postgres -d nexsoldb -F c -f nexsoldb.dump
 


-F c = custom format (compressed, best for restore)
You'll be prompted for the password, or set PGPASSWORD=yourpass before the command

Step 2 — Restore to local:


pg_restore -h localhost -p 5432 -U postgres -d nexsoldb -F c nexsoldb.dump
If nexsoldb doesn't exist locally yet:


createdb -h localhost -U postgres nexsoldb
pg_restore -h localhost -p 5432 -U postgres -d nexsoldb -F c nexsoldb.dump



pg_restore -h localhost -p 5432 -U postgres -d nexsoldb -F c E:\nexsol-admin\nexsoldb.dump
pg_restore -h localhost -p 5432 -U postgres -d 9446968394a -F c E:\nexsol-admin\9446968394a.dump