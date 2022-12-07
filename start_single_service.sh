#!/bin/bash
docker compose stop -t 1 rest-api-buchungsverwaltung1
docker compose stop -t 1 rest-api-buchungsverwaltung2
docker compose stop -t 1 rest-api-buchungsverwaltung3
docker compose rm rest-api-buchungsverwaltung1
docker compose rm rest-api-buchungsverwaltung2
docker compose rm rest-api-buchungsverwaltung3
docker compose build rest-api-buchungsverwaltung1
docker compose build rest-api-buchungsverwaltung2
docker compose build rest-api-buchungsverwaltung3
docker compose up --no-start rest-api-buchungsverwaltung1
docker compose up --no-start rest-api-buchungsverwaltung2
docker compose up --no-start rest-api-buchungsverwaltung3
docker compose start rest-api-buchungsverwaltung1
docker compose start rest-api-buchungsverwaltung2
docker compose start rest-api-buchungsverwaltung3
