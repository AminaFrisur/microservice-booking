FROM mongo:latest
LABEL description="Database of Microservice Buchungsverwaltung"
COPY ./scripts/docker-entrypoint.js /docker-entrypoint-initdb.d/
CMD ["mongod"]