# Onderhoud, brandstof, sleutels en beveiliging

Onder **Voertuigbeheer → Onderhoud & brandstof** staan onderhoudsplanning, onderhoudshistorie en tankbeurten. Deze functies vallen binnen de bestaande Voertuigbeheer-add-on van US$15 per maand / US$150 per jaar per locatie. De prijzen zijn niet gewijzigd.

## Onderhoud en brandstof

Leg per voertuig de volgende onderhoudsdatum en/of kilometergrens vast, plus de vervaldatums voor verzekering en keuring. Meldingen verschijnen in het scherm en het managementoverzicht vanaf 30 dagen of 1.000 km vóór de grens. Er worden geen berichten verzonden. Na uitgevoerd onderhoud registreert u de werkzaamheden en past u de volgende onderhoudsgrens aan. Onderhoud registreren handelt bestaande mankementen niet af en geeft voertuigen niet automatisch vrij.

Tankbeurten bevatten datum, kilometerstand, liters, totaalbedrag, valuta, tankstation en een vinkje voor een volle tank. Registreer tankbeurten op datumvolgorde, zonder dalende kilometerstanden. Verbruik wordt uitsluitend berekend over volledige intervallen van een volle tank tot de volgende volle tank; tussentijdse gedeeltelijke tankbeurten tellen mee. Zonder twee bruikbare volle-tankmetingen wordt geen verbruik getoond. Een supervisor kan een onjuiste kostenregistratie met een reden ongeldig maken; het oorspronkelijke record en de audit blijven bewaard. Een ongeldig gemaakte registratie verlaagt de opgeslagen kilometerstand niet.

Onderhouds- en brandstofkosten zijn operationele registraties. Ze schrijven geen kas- of boekhoudtransacties. Het managementoverzicht toont ze apart, zodat een uitgave die ook in Boekhouding is geboekt niet dubbel van het resultaat wordt afgetrokken. Bedragen in USD, SRD en EUR worden gescheiden gehouden.

## Sleutels en beveiligingslogboek

**Beveiliging & sleutels** valt binnen Operations en heeft een eigen bedrijfsmoduleschakelaar. Bestaande aangepaste licenties moeten de module `security` expliciet bevatten; de demo en nieuwe Operations-pakketten bevatten haar. De Super Admin kan toegang toewijzen via Personeel: bekijken (`securityView`), registreren (`securityRegister`), beoordelen (`securityReview`) en sleutelbeheer (`securityManage`). De bestaande beveiligingsprofielen bevatten de nieuwe rechten bij het kiezen van het profiel; bestaande medewerkers krijgen niet stilzwijgend extra rechten. Werknemers zien uitsluitend toegewezen locaties.

Voeg sleutels toe met een unieke naam en koppel ze aan een bestaande kamer, een voertuig of een andere referentie. Een sleutel kan maar één open uitgifte hebben. Bij uitgifte worden houder, notitie, tijd en beveiliger opgeslagen; bij inleveren worden tijd, ontvanger en notitie toegevoegd. Een uitgeleende sleutel kan niet worden gewijzigd of uitgeschakeld. De historie bewaart de sleutelnaam en referentie op het moment van uitgifte.

Het logboek ondersteunt incidenten, bezoekers en dienstoverdrachten, met ernst, omschrijving en maximaal vier private JPEG-, PNG- of WebP-foto's van elk maximaal 1 MB. Bezoekers hebben een naam en bestemming; hun vertrek wordt afzonderlijk vastgelegd. Supervisors zetten incidenten en overdrachten in behandeling of sluiten ze af met een verplichte opvolgingsnotitie. Tijd, medewerker en wijzigingsversie worden bewaard. De camera-invoer hangt af van het gebruikte toestel; uploaden blijft mogelijk.

## Managementoverzicht

Onder **Alle locaties** staat het managementoverzicht met periode, locatie- en valutafilter en CSV-export. Omzet, boekhoudkosten, resultaat, ontvangen betalingen en openstaande bedragen volgen de bestaande boekhoudrapportage. Bezetting, aankomsten en vertrekken horen bij de gekozen einddatum. Een reservering die later wordt gewijzigd vormt geen onveranderlijke historische momentopname. Sleutel- en bezoekersaantallen tonen de actuele status. Voertuigkosten en documentmeldingen worden alleen getoond met toegang tot Voertuigbeheer; beveiligingsaantallen alleen met toegang tot Beveiliging & sleutels.

## Installatie en gegevens

Maak vóór deployment een SQLite-back-up. Migratie `0017_field_operations.sql` voegt zeven tabellen toe zonder bestaande bedrijfsgegevens te wijzigen. De bestaande back-upfunctie neemt de nieuwe tabellen mee; oudere JSON-back-ups worden met lege tabellen aangevuld en verwijzingen worden gecontroleerd. Gebruik bij veel foto's de volledige SQLite-back-up; de bestaande JSON-herstelroute accepteert maximaal 12 MB. De hoteldata-reset wist deze voertuig- en beveiligingsregistraties niet impliciet.

Deze uitbreiding voegt geen e-mail- of WhatsApp-verzending toe.
