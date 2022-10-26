rs.initiate({_id: "shard-02-db-buchungsverwaltung",
    version: 1, members: [
        { _id: 0, host : "shard02buchungsverwaltung1:27017" },
        { _id: 1, host : "shard02buchungsverwaltung2:27017" },
        { _id: 2, host : "shard02buchungsverwaltung3:27017" }, ] });