
conn = new Mongo();
db = conn.getDB('backend');
db.createCollection('backend.bookings');
db.invoices.createIndex( { loginName: "text" });
db.invoices.createIndex( { "buchungsNummer": 1 }, { unique: true } );