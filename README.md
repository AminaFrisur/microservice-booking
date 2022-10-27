# microservice-booking
Microservice for Booking with Wasm

Stand 26.10:
- changeBooking rausgenommen
- zu kompliziert
- stattdessen nur cancel Booking
- und dann eine Gutschrift als Rechnung
- dann muss eine neue Buchung erstellt werden

Stand 27.10:
- Was noch fehlt: 
- Bezahlung der Buchungen
- Aufruf Rechnung erstellen (HIER GANZ WICHTIG: CIRCUIT BREAKER IMPLEMENTIEREN)
- Aufruf verfügbare Fahrzeuge für bestimmten Standort UND auch verfügbare Zeiten
- Buchungsoptionen: Mindestens 1 Stunde und 24/7 ist ein Fahrzeug buchbar
- Meine Lösung: Hole dir die Fahrzeuge von der Fahzeugverwaltung 
- Schaue in den aktuellen Buchungen welche Zeiten genau Frei sind
- Erstelle dann ein JSON mit den verschiedenen Zeitslots (Datum + Uhrzeit)
- Berechnung des Preises