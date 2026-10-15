# Voertuigbeheer voor beveiliging

De module **Vehicles / Voertuigbeheer** is een afzonderlijke optionele add-on van **US$15 per maand of US$150 per jaar per locatie**. Voertuigbeheer wordt los geselecteerd bij Licentie & optionele extra’s en is niet inbegrepen in de Operations-add-on. Het bedrag telt mee in de totale pakketprijs. De gratis demo bevat alle add-ons, inclusief Voertuigbeheer. Bestaande aangepaste licenties moeten `vehicles` expliciet bevatten. De bedrijfsmodules kunnen de aangekochte module afzonderlijk uitschakelen.

## Activeren

1. Werk de applicatie bij vanuit GitHub en bouw/start de Docker-container opnieuw volgens README.md. Bij het starten wordt `0016_vehicle_management.sql` automatisch toegepast. Maak vooraf een databaseback-up.
2. Controleer als Super Admin de licentie en schakel **Vehicle management** in bij de bedrijfsmodules.
3. Maak medewerkers aan via Personeel. Kies **Security / Beveiliging** of **Security supervisor / Beveiligingssupervisor** en wijs hun locaties toe. Gebruik de rol Employee om toegang tot toegewezen locaties te beperken; Admin heeft volgens de bestaande Loomi-regels toegang tot alle locaties.
4. Voeg de voertuigen toe met kenteken, naam/model, kilometerstand en status.

## Dagelijks gebruik

- **Vertrek:** kies een beschikbaar voertuig, registreer de bestuurder, bestemming, ritreden, kilometerstand en opmerkingen. Loomi legt automatisch tijd en de ingelogde beveiliger vast. Het voertuig wordt Onderweg. Gelijktijdige of dubbele uitgifte is geblokkeerd.
- **Terugkomst:** registreer kilometerstand, opmerkingen en eventuele schade/mankementen. Tijd en de ontvangende beveiliger worden automatisch opgeslagen. Een kilometerstand mag niet lager zijn dan de vorige stand.
- **Mankementen:** kunnen ook los van een terugkomst worden gemeld. Vul omschrijving en ernst in en maak of upload maximaal vier foto's per melding (JPEG/PNG/WebP, maximaal 1 MB per foto). Voor de cameraknop moet het toestel dit ondersteunen; foto-upload blijft beschikbaar.
- **Beoordeling:** een supervisor zet een melding In beoordeling of Afgehandeld en vult beoordeling/reparatie in. Het systeem bewaart de naam en tijd van de beoordeling.
- **Vrijgave:** een gemeld mankement blokkeert de volgende rit. Nadat alle meldingen zijn afgehandeld geeft een medewerker met voertuigenbeheer het voertuig expliciet vrij via Bewerken / vrijgeven. Een lopende rit kan eerst worden teruggeboekt; open meldingen houden het voertuig daarna Buiten gebruik.

## Overzichten en rechten

Het dashboard toont Beschikbaar, Onderweg, Onderhoud, Buiten gebruik en het aantal open meldingen. De rittenhistorie bevat kenteken en voertuignaam op het moment van vertrek, bestuurder, bestemming, tijden, kilometerstanden, afstand, opmerkingen en beide beveiligers. Zoek/filter op voertuig, kenteken, bestuurder en status. De mankementenhistorie bewaart meldingen, foto's en de laatste beoordeling. Alle mutaties schrijven daarnaast een auditregel in Loomi.

Er zijn vier afzonderlijke rechten: bekijken, vertrek/terugkomst/meldingen registreren, meldingen beoordelen en voertuigen beheren/vrijgeven. Het beveiligingsprofiel heeft de eerste twee; het supervisorprofiel heeft alle vier. Verwijderde rechten en uitgeschakelde modules worden bij ieder API-verzoek opnieuw gecontroleerd. Foto's zijn uitsluitend via een ingelogd, bevoegd account voor dezelfde locatie bereikbaar, niet via openbare bestandslinks.

De interface ondersteunt Nederlands en Engels en past zich aan mobiele schermen aan. Tijden worden getoond in America/Paramaribo; de database bewaart UTC-tijdstippen.

## Opslag en back-up

Voertuigen, ritten, meldingen en foto's worden in de bestaande persistente SQLite-database opgeslagen. De migratie voegt vier tabellen toe en wijzigt geen bestaande bedrijfsgegevens. JSON-back-ups bevatten deze tabellen; oudere JSON-back-ups worden met lege voertuigtabellen aangevuld. Voor veel foto's gebruikt u de volledige SQLite-back-up uit de bestaande serverback-upprocedure: de bestaande JSON-herstelroute accepteert maximaal 12 MB. Een hoteldata-reset behoudt voertuig- en beveiligingsregistraties; die worden niet impliciet gewist.

## Validatie

Geautomatiseerde SQLite-tests controleren vertrek/terugkomst, gelijktijdige uitgifte, kilometerstanden, foto's, terugdraaien bij fouten, locatie- en moduleafscherming, rechten, versieconflicten en supervisorbeoordeling/vrijgave. Test de camera/upload en de nieuwe werkstroom ook op de toestellen van de beveiliging na installatie op uw server.
