#!/bin/bash
# Set up Replications for Config Server, shards and router
docker compose exec db-buchung-config1 sh -c "mongosh < /scripts/init-configserver.js"
docker compose exec shard-01-buchungsverwaltung1 sh -c "mongosh < /scripts/init-shard01-db-buchungsverwaltung.js"
docker compose exec shard-02-buchungsverwaltung1 sh -c "mongosh < /scripts/init-shard02-db-buchungsverwaltung.js"
docker compose exec router-01-buchungsverwaltung sh -c "mongosh < /scripts/init-router.js"
docker compose exec router-01-buchungsverwaltung sh -c "mongosh < /scripts/init-database.js"

# share Database backend for all shards, set Index and shared key
# mongosh --eval "sh.enableSharding('backend')"
# mongosh --eval "db.createCollection('backend.invoices')"
# mongosh --eval 'db.invoices.createIndex( { loginName: "text" });'
# mongosh --eval "db.invoices.createIndex( { "rechnungsNummer": 1 }, { unique: true } );"
# mongosh --eval "db.adminCommand( { shardCollection: 'backend.invoices', key: { 'loginName': 'hashed' } } )"