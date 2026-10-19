import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Region } from "@/lib/api-types";
import { fetchComuni } from "@/lib/api-client";
import { Globe, MapPin, Building2, Navigation, Mail, ChevronDown, X, Check, Search } from "lucide-react";


interface Props {
  comune: string;
  provincia: string;
  regione: Region;
  cap?: string;
  onComune: (v: string) => void;
  onProvincia: (v: string) => void;
  onRegione: (r: Region) => void;
  onCap?: (v: string) => void;
}

// All 107 Italian Provinces sorted alphabetically by code
const PROVINCE_ITALIANE = [
  { code: "AG", name: "Agrigento", reg: "Sicilia" },
  { code: "AL", name: "Alessandria", reg: "Piemonte" },
  { code: "AN", name: "Ancona", reg: "Marche" },
  { code: "AO", name: "Aosta", reg: "Valle d'Aosta" },
  { code: "AR", name: "Arezzo", reg: "Toscana" },
  { code: "AP", name: "Ascoli Piceno", reg: "Marche" },
  { code: "AT", name: "Asti", reg: "Piemonte" },
  { code: "AV", name: "Avellino", reg: "Campania" },
  { code: "BA", name: "Bari", reg: "Puglia" },
  { code: "BT", name: "Barletta-Andria-Trani", reg: "Puglia" },
  { code: "BL", name: "Belluno", reg: "Veneto" },
  { code: "BN", name: "Benevento", reg: "Campania" },
  { code: "BG", name: "Bergamo", reg: "Lombardia" },
  { code: "BI", name: "Biella", reg: "Piemonte" },
  { code: "BO", name: "Bologna", reg: "Emilia-Romagna" },
  { code: "BZ", name: "Bolzano", reg: "Trentino-Alto Adige" },
  { code: "BS", name: "Brescia", reg: "Lombardia" },
  { code: "BR", name: "Brindisi", reg: "Puglia" },
  { code: "CA", name: "Cagliari", reg: "Sardegna" },
  { code: "CL", name: "Caltanissetta", reg: "Sicilia" },
  { code: "CB", name: "Campobasso", reg: "Molise" },
  { code: "CE", name: "Caserta", reg: "Campania" },
  { code: "CT", name: "Catania", reg: "Sicilia" },
  { code: "CZ", name: "Catanzaro", reg: "Calabria" },
  { code: "CH", name: "Chieti", reg: "Abruzzo" },
  { code: "CO", name: "Como", reg: "Lombardia" },
  { code: "CS", name: "Cosenza", reg: "Calabria" },
  { code: "CR", name: "Cremona", reg: "Lombardia" },
  { code: "KR", name: "Crotone", reg: "Calabria" },
  { code: "CN", name: "Cuneo", reg: "Piemonte" },
  { code: "EN", name: "Enna", reg: "Sicilia" },
  { code: "FM", name: "Fermo", reg: "Marche" },
  { code: "FE", name: "Ferrara", reg: "Emilia-Romagna" },
  { code: "FI", name: "Firenze", reg: "Toscana" },
  { code: "FG", name: "Foggia", reg: "Puglia" },
  { code: "FC", name: "Forlì-Cesena", reg: "Emilia-Romagna" },
  { code: "FR", name: "Frosinone", reg: "Lazio" },
  { code: "GE", name: "Genova", reg: "Liguria" },
  { code: "GO", name: "Gorizia", reg: "Friuli-Venezia Giulia" },
  { code: "GR", name: "Grosseto", reg: "Toscana" },
  { code: "IM", name: "Imperia", reg: "Liguria" },
  { code: "IS", name: "Isernia", reg: "Molise" },
  { code: "SP", name: "La Spezia", reg: "Liguria" },
  { code: "AQ", name: "L'Aquila", reg: "Abruzzo" },
  { code: "LT", name: "Latina", reg: "Lazio" },
  { code: "LE", name: "Lecce", reg: "Puglia" },
  { code: "LC", name: "Lecco", reg: "Lombardia" },
  { code: "LI", name: "Livorno", reg: "Toscana" },
  { code: "LO", name: "Lodi", reg: "Lombardia" },
  { code: "LU", name: "Lucca", reg: "Toscana" },
  { code: "MC", name: "Macerata", reg: "Marche" },
  { code: "MN", name: "Mantova", reg: "Lombardia" },
  { code: "MS", name: "Massa-Carrara", reg: "Toscana" },
  { code: "MT", name: "Matera", reg: "Basilicata" },
  { code: "ME", name: "Messina", reg: "Sicilia" },
  { code: "MI", name: "Milano", reg: "Lombardia" },
  { code: "MO", name: "Modena", reg: "Emilia-Romagna" },
  { code: "MB", name: "Monza e della Brianza", reg: "Lombardia" },
  { code: "NA", name: "Napoli", reg: "Campania" },
  { code: "NO", name: "Novara", reg: "Piemonte" },
  { code: "NU", name: "Nuoro", reg: "Sardegna" },
  { code: "OR", name: "Oristano", reg: "Sardegna" },
  { code: "PD", name: "Padova", reg: "Veneto" },
  { code: "PA", name: "Palermo", reg: "Sicilia" },
  { code: "PR", name: "Parma", reg: "Emilia-Romagna" },
  { code: "PV", name: "Pavia", reg: "Lombardia" },
  { code: "PG", name: "Perugia", reg: "Umbria" },
  { code: "PU", name: "Pesaro e Urbino", reg: "Marche" },
  { code: "PE", name: "Pescara", reg: "Abruzzo" },
  { code: "PC", name: "Piacenza", reg: "Emilia-Romagna" },
  { code: "PI", name: "Pisa", reg: "Toscana" },
  { code: "PT", name: "Pistoia", reg: "Toscana" },
  { code: "PN", name: "Pordenone", reg: "Friuli-Venezia Giulia" },
  { code: "PZ", name: "Potenza", reg: "Basilicata" },
  { code: "PO", name: "Prato", reg: "Toscana" },
  { code: "RG", name: "Ragusa", reg: "Sicilia" },
  { code: "RA", name: "Ravenna", reg: "Emilia-Romagna" },
  { code: "RC", name: "Reggio Calabria", reg: "Calabria" },
  { code: "RE", name: "Reggio Emilia", reg: "Emilia-Romagna" },
  { code: "RI", name: "Rieti", reg: "Lazio" },
  { code: "RN", name: "Rimini", reg: "Emilia-Romagna" },
  { code: "RM", name: "Roma", reg: "Lazio" },
  { code: "RO", name: "Rovigo", reg: "Veneto" },
  { code: "SA", name: "Salerno", reg: "Campania" },
  { code: "SS", name: "Sassari", reg: "Sardegna" },
  { code: "SV", name: "Savona", reg: "Liguria" },
  { code: "SI", name: "Siena", reg: "Toscana" },
  { code: "SR", name: "Siracusa", reg: "Sicilia" },
  { code: "SO", name: "Sondrio", reg: "Lombardia" },
  { code: "SU", name: "Sud Sardegna", reg: "Sardegna" },
  { code: "TA", name: "Taranto", reg: "Puglia" },
  { code: "TE", name: "Teramo", reg: "Abruzzo" },
  { code: "TR", name: "Terni", reg: "Umbria" },
  { code: "TO", name: "Torino", reg: "Piemonte" },
  { code: "TP", name: "Trapani", reg: "Sicilia" },
  { code: "TN", name: "Trento", reg: "Trentino-Alto Adige" },
  { code: "TV", name: "Treviso", reg: "Veneto" },
  { code: "TS", name: "Trieste", reg: "Friuli-Venezia Giulia" },
  { code: "UD", name: "Udine", reg: "Friuli-Venezia Giulia" },
  { code: "VA", name: "Varese", reg: "Lombardia" },
  { code: "VE", name: "Venezia", reg: "Veneto" },
  { code: "VB", name: "Verbano-Cusio-Ossola", reg: "Piemonte" },
  { code: "VC", name: "Vercelli", reg: "Piemonte" },
  { code: "VR", name: "Verona", reg: "Veneto" },
  { code: "VV", name: "Vibo Valentia", reg: "Calabria" },
  { code: "VI", name: "Vicenza", reg: "Veneto" },
  { code: "VT", name: "Viterbo", reg: "Lazio" },
];

const REGIONI_ITALIANE: { code: Region; name: string; desc: string }[] = [
  { code: "nord", name: "Nord Italia", desc: "Macroregione Settentrionale" },
  { code: "centro", name: "Centro Italia", desc: "Macroregione Centrale" },
  { code: "sud", name: "Sud e Isole", desc: "Macroregione Meridionale & Isole" },
  { code: "lombardia", name: "Lombardia", desc: "MI, BG, BS, MB, CO..." },
  { code: "lazio", name: "Lazio", desc: "RM, LT, FR, VT, RI..." },
  { code: "veneto", name: "Veneto", desc: "VE, VR, PD, VI, TV..." },
  { code: "campania", name: "Campania", desc: "NA, SA, CE, AV, BN..." },
  { code: "emilia", name: "Emilia-Romagna", desc: "BO, MO, PR, RE, FO..." },
  { code: "piemonte", name: "Piemonte", desc: "TO, CN, AL, NO, AT..." },
  { code: "sicilia", name: "Sicilia", desc: "PA, CT, ME, SR, TP..." },
  { code: "puglia", name: "Puglia", desc: "BA, LE, FG, TA, BR..." },
  { code: "toscana", name: "Toscana", desc: "FI, PI, LI, AR, PO..." },
  { code: "calabria", name: "Calabria", desc: "RC, CS, CZ, KR, VV..." },
  { code: "sardegna", name: "Sardegna", desc: "CA, SS, NU, OR, SU..." },
];

// Major Italian cities mapped to their province codes
const MAJOR_COMUNI: { name: string; prov: string }[] = [
  // Lombardia
  { name: "Milano", prov: "MI" }, { name: "Sesto San Giovanni", prov: "MI" }, { name: "Cinisello Balsamo", prov: "MI" }, { name: "Legnano", prov: "MI" }, { name: "Rho", prov: "MI" }, { name: "Cologno Monzese", prov: "MI" }, { name: "Paderno Dugnano", prov: "MI" }, { name: "Rozzano", prov: "MI" }, { name: "San Giuliano Milanese", prov: "MI" }, { name: "Pioltello", prov: "MI" }, { name: "Bollate", prov: "MI" }, { name: "Segrate", prov: "MI" }, { name: "Corsico", prov: "MI" }, { name: "Cernusco sul Naviglio", prov: "MI" }, { name: "Abbiategrasso", prov: "MI" }, { name: "San Donato Milanese", prov: "MI" }, { name: "Parabiago", prov: "MI" }, { name: "Garbagnate Milanese", prov: "MI" }, { name: "Bresso", prov: "MI" }, { name: "Buccinasco", prov: "MI" },
  { name: "Bergamo", prov: "BG" }, { name: "Treviglio", prov: "BG" }, { name: "Seriate", prov: "BG" }, { name: "Dalmine", prov: "BG" }, { name: "Romano di Lombardia", prov: "BG" },
  { name: "Brescia", prov: "BS" }, { name: "Desenzano del Garda", prov: "BS" }, { name: "Montichiari", prov: "BS" }, { name: "Lumezzane", prov: "BS" }, { name: "Palazzolo sull'Oglio", prov: "BS" },
  { name: "Monza", prov: "MB" }, { name: "Lissone", prov: "MB" }, { name: "Seregno", prov: "MB" }, { name: "Desio", prov: "MB" }, { name: "Cesano Maderno", prov: "MB" }, { name: "Vimercate", prov: "MB" },
  { name: "Como", prov: "CO" }, { name: "Cantù", prov: "CO" }, { name: "Mariano Comense", prov: "CO" }, { name: "Erba", prov: "CO" },
  { name: "Varese", prov: "VA" }, { name: "Busto Arsizio", prov: "VA" }, { name: "Gallarate", prov: "VA" }, { name: "Saronno", prov: "VA" }, { name: "Tradate", prov: "VA" },
  { name: "Pavia", prov: "PV" }, { name: "Vigevano", prov: "PV" }, { name: "Voghera", prov: "PV" },
  { name: "Cremona", prov: "CR" }, { name: "Crema", prov: "CR" }, { name: "Casalmaggiore", prov: "CR" },
  { name: "Lecco", prov: "LC" }, { name: "Merate", prov: "LC" },
  { name: "Lodi", prov: "LO" }, { name: "Codogno", prov: "LO" },
  { name: "Mantova", prov: "MN" }, { name: "Castiglione delle Stiviere", prov: "MN" },
  { name: "Sondrio", prov: "SO" }, { name: "Morbegno", prov: "SO" },
  // Lazio
  { name: "Roma", prov: "RM" }, { name: "Guidonia Montecelio", prov: "RM" }, { name: "Fiumicino", prov: "RM" }, { name: "Pomezia", prov: "RM" }, { name: "Tivoli", prov: "RM" }, { name: "Anzio", prov: "RM" }, { name: "Velletri", prov: "RM" }, { name: "Civitavecchia", prov: "RM" }, { name: "Ardea", prov: "RM" }, { name: "Nettuno", prov: "RM" }, { name: "Marino", prov: "RM" }, { name: "Albano Laziale", prov: "RM" }, { name: "Ladispoli", prov: "RM" }, { name: "Monterotondo", prov: "RM" }, { name: "Ciampino", prov: "RM" },
  { name: "Latina", prov: "LT" }, { name: "Aprilia", prov: "LT" }, { name: "Terracina", prov: "LT" }, { name: "Formia", prov: "LT" }, { name: "Fondi", prov: "LT" },
  { name: "Frosinone", prov: "FR" }, { name: "Cassino", prov: "FR" }, { name: "Alatri", prov: "FR" }, { name: "Sora", prov: "FR" },
  { name: "Viterbo", prov: "VT" }, { name: "Civita Castellana", prov: "VT" }, { name: "Tarquinia", prov: "VT" },
  { name: "Rieti", prov: "RI" }, { name: "Fara in Sabina", prov: "RI" },
  // Campania
  { name: "Napoli", prov: "NA" }, { name: "Giugliano in Campania", prov: "NA" }, { name: "Torre del Greco", prov: "NA" }, { name: "Pozzuoli", prov: "NA" }, { name: "Casoria", prov: "NA" }, { name: "Castellammare di Stabia", prov: "NA" }, { name: "Afragola", prov: "NA" }, { name: "Marano di Napoli", prov: "NA" }, { name: "Acerra", prov: "NA" }, { name: "Portici", prov: "NA" }, { name: "Ercolano", prov: "NA" }, { name: "Casalnuovo di Napoli", prov: "NA" }, { name: "San Giorgio a Cremano", prov: "NA" }, { name: "Torre Annunziata", prov: "NA" },
  { name: "Salerno", prov: "SA" }, { name: "Cava de' Tirreni", prov: "SA" }, { name: "Battipaglia", prov: "SA" }, { name: "Scafati", prov: "SA" }, { name: "Nocera Inferiore", prov: "SA" }, { name: "Eboli", prov: "SA" },
  { name: "Caserta", prov: "CE" }, { name: "Aversa", prov: "CE" }, { name: "Marcianise", prov: "CE" }, { name: "Maddaloni", prov: "CE" }, { name: "Santa Maria Capua Vetere", prov: "CE" },
  { name: "Avellino", prov: "AV" }, { name: "Ariano Irpino", prov: "AV" },
  { name: "Benevento", prov: "BN" }, { name: "Montesarchio", prov: "BN" },
  // Veneto
  { name: "Venezia", prov: "VE" }, { name: "Chioggia", prov: "VE" }, { name: "San Donà di Piave", prov: "VE" }, { name: "Mira", prov: "VE" }, { name: "Spinea", prov: "VE" }, { name: "Mirano", prov: "VE" }, { name: "Jesolo", prov: "VE" },
  { name: "Verona", prov: "VR" }, { name: "Villafranca di Verona", prov: "VR" }, { name: "Legnago", prov: "VR" }, { name: "San Giovanni Lupatoto", prov: "VR" },
  { name: "Padova", prov: "PD" }, { name: "Albignasego", prov: "PD" }, { name: "Selvazzano Dentro", prov: "PD" }, { name: "Vigonza", prov: "PD" }, { name: "Cittadella", prov: "PD" }, { name: "Abano Terme", prov: "PD" },
  { name: "Vicenza", prov: "VI" }, { name: "Bassano del Grappa", prov: "VI" }, { name: "Schio", prov: "VI" }, { name: "Valdagno", prov: "VI" }, { name: "Arzignano", prov: "VI" },
  { name: "Treviso", prov: "TV" }, { name: "Conegliano", prov: "TV" }, { name: "Castelfranco Veneto", prov: "TV" }, { name: "Montebelluna", prov: "TV" }, { name: "Vittorio Veneto", prov: "TV" },
  { name: "Rovigo", prov: "RO" }, { name: "Adria", prov: "RO" },
  { name: "Belluno", prov: "BL" }, { name: "Feltre", prov: "BL" },
  // Piemonte
  { name: "Torino", prov: "TO" }, { name: "Moncalieri", prov: "TO" }, { name: "Collegno", prov: "TO" }, { name: "Rivoli", prov: "TO" }, { name: "Nichelino", prov: "TO" }, { name: "Settimo Torinese", prov: "TO" }, { name: "Grugliasco", prov: "TO" }, { name: "Chieri", prov: "TO" }, { name: "Pinerolo", prov: "TO" }, { name: "Venaria Reale", prov: "TO" }, { name: "Carmagnola", prov: "TO" }, { name: "Chivasso", prov: "TO" }, { name: "Ivrea", prov: "TO" },
  { name: "Novara", prov: "NO" }, { name: "Borgomanero", prov: "NO" }, { name: "Trecate", prov: "NO" }, { name: "Galliate", prov: "NO" },
  { name: "Alessandria", prov: "AL" }, { name: "Casale Monferrato", prov: "AL" }, { name: "Novi Ligure", prov: "AL" }, { name: "Tortona", prov: "AL" },
  { name: "Cuneo", prov: "CN" }, { name: "Alba", prov: "CN" }, { name: "Bra", prov: "CN" }, { name: "Fossano", prov: "CN" }, { name: "Mondovì", prov: "CN" },
  { name: "Asti", prov: "AT" }, { name: "Canelli", prov: "AT" },
  { name: "Vercelli", prov: "VC" }, { name: "Borgosesia", prov: "VC" },
  { name: "Biella", prov: "BI" }, { name: "Cossato", prov: "BI" },
  { name: "Verbania", prov: "VB" }, { name: "Domodossola", prov: "VB" }, { name: "Omegna", prov: "VB" },
  // Emilia-Romagna
  { name: "Bologna", prov: "BO" }, { name: "Imola", prov: "BO" }, { name: "Casalecchio di Reno", prov: "BO" }, { name: "San Lazzaro di Savena", prov: "BO" }, { name: "Valsamoggia", prov: "BO" },
  { name: "Modena", prov: "MO" }, { name: "Carpi", prov: "MO" }, { name: "Sassuolo", prov: "MO" }, { name: "Formigine", prov: "MO" }, { name: "Castelfranco Emilia", prov: "MO" }, { name: "Vignola", prov: "MO" },
  { name: "Parma", prov: "PR" }, { name: "Fidenza", prov: "PR" }, { name: "Salsomaggiore Terme", prov: "PR" }, { name: "Collecchio", prov: "PR" },
  { name: "Reggio nell'Emilia", prov: "RE" }, { name: "Correggio", prov: "RE" }, { name: "Scandiano", prov: "RE" }, { name: "Casalgrande", prov: "RE" }, { name: "Guastalla", prov: "RE" },
  { name: "Ravenna", prov: "RA" }, { name: "Faenza", prov: "RA" }, { name: "Lugo", prov: "RA" }, { name: "Cervia", prov: "RA" },
  { name: "Rimini", prov: "RN" }, { name: "Riccione", prov: "RN" }, { name: "Santarcangelo di Romagna", prov: "RN" }, { name: "Bellaria-Igea Marina", prov: "RN" }, { name: "Cattolica", prov: "RN" },
  { name: "Ferrara", prov: "FE" }, { name: "Cento", prov: "FE" }, { name: "Comacchio", prov: "FE" },
  { name: "Forlì", prov: "FC" }, { name: "Cesena", prov: "FC" }, { name: "Cesenatico", prov: "FC" }, { name: "Savignano sul Rubicone", prov: "FC" },
  { name: "Piacenza", prov: "PC" }, { name: "Fiorenzuola d'Arda", prov: "PC" }, { name: "Castelsangiovanni", prov: "PC" },
  // Sicilia
  { name: "Palermo", prov: "PA" }, { name: "Bagheria", prov: "PA" }, { name: "Monreale", prov: "PA" }, { name: "Carini", prov: "PA" }, { name: "Partinico", prov: "PA" }, { name: "Termini Imerese", prov: "PA" },
  { name: "Catania", prov: "CT" }, { name: "Acireale", prov: "CT" }, { name: "Misterbianco", prov: "CT" }, { name: "Paternò", prov: "CT" }, { name: "Caltagirone", prov: "CT" }, { name: "Adrano", prov: "CT" }, { name: "Mascalucia", prov: "CT" }, { name: "Aci Catena", prov: "CT" },
  { name: "Messina", prov: "ME" }, { name: "Barcellona Pozzo di Gotto", prov: "ME" }, { name: "Milazzo", prov: "ME" }, { name: "Taormina", prov: "ME" },
  { name: "Siracusa", prov: "SR" }, { name: "Augusta", prov: "SR" }, { name: "Avola", prov: "SR" }, { name: "Noto", prov: "SR" }, { name: "Lentini", prov: "SR" }, { name: "Floridia", prov: "SR" },
  { name: "Marsala", prov: "TP" }, { name: "Trapani", prov: "TP" }, { name: "Mazara del Vallo", prov: "TP" }, { name: "Alcamo", prov: "TP" }, { name: "Castelvetrano", prov: "TP" }, { name: "Erice", prov: "TP" },
  { name: "Ragusa", prov: "RG" }, { name: "Vittoria", prov: "RG" }, { name: "Modica", prov: "RG" }, { name: "Comiso", prov: "RG" }, { name: "Scicli", prov: "RG" },
  { name: "Caltanissetta", prov: "CL" }, { name: "Gela", prov: "CL" }, { name: "Niscemi", prov: "CL" }, { name: "San Cataldo", prov: "CL" },
  { name: "Agrigento", prov: "AG" }, { name: "Sciacca", prov: "AG" }, { name: "Licata", prov: "AG" }, { name: "Canicattì", prov: "AG" }, { name: "Favara", prov: "AG" },
  { name: "Enna", prov: "EN" }, { name: "Piazza Armerina", prov: "EN" }, { name: "Nicosia", prov: "EN" },
  // Puglia
  { name: "Bari", prov: "BA" }, { name: "Altamura", prov: "BA" }, { name: "Molfetta", prov: "BA" }, { name: "Bitonto", prov: "BA" }, { name: "Monopoli", prov: "BA" }, { name: "Corato", prov: "BA" }, { name: "Gravina in Puglia", prov: "BA" }, { name: "Modugno", prov: "BA" }, { name: "Gioia del Colle", prov: "BA" },
  { name: "Taranto", prov: "TA" }, { name: "Martina Franca", prov: "TA" }, { name: "Grottaglie", prov: "TA" }, { name: "Manduria", prov: "TA" }, { name: "Massafra", prov: "TA" },
  { name: "Foggia", prov: "FG" }, { name: "Cerignola", prov: "FG" }, { name: "Manfredonia", prov: "FG" }, { name: "San Severo", prov: "FG" }, { name: "Lucera", prov: "FG" },
  { name: "Lecce", prov: "LE" }, { name: "Nardò", prov: "LE" }, { name: "Galatina", prov: "LE" }, { name: "Copertino", prov: "LE" }, { name: "Gallipoli", prov: "LE" }, { name: "Casarano", prov: "LE" },
  { name: "Andria", prov: "BT" }, { name: "Barletta", prov: "BT" }, { name: "Trani", prov: "BT" }, { name: "Bisceglie", prov: "BT" }, { name: "Canosa di Puglia", prov: "BT" },
  { name: "Brindisi", prov: "BR" }, { name: "Fasano", prov: "BR" }, { name: "Francavilla Fontana", prov: "BR" }, { name: "Ostuni", prov: "BR" }, { name: "Mesagne", prov: "BR" },
  // Toscana
  { name: "Firenze", prov: "FI" }, { name: "Scandicci", prov: "FI" }, { name: "Sesto Fiorentino", prov: "FI" }, { name: "Empoli", prov: "FI" }, { name: "Campi Bisenzio", prov: "FI" }, { name: "Bagno a Ripoli", prov: "FI" },
  { name: "Prato", prov: "PO" }, { name: "Montemurlo", prov: "PO" },
  { name: "Livorno", prov: "LI" }, { name: "Piombino", prov: "LI" }, { name: "Rosignano Marittimo", prov: "LI" }, { name: "Cecina", prov: "LI" },
  { name: "Arezzo", prov: "AR" }, { name: "Montevarchi", prov: "AR" }, { name: "Cortona", prov: "AR" }, { name: "San Giovanni Valdarno", prov: "AR" },
  { name: "Pisa", prov: "PI" }, { name: "Cascina", prov: "PI" }, { name: "San Giuliano Terme", prov: "PI" }, { name: "Pontedera", prov: "PI" }, { name: "San Miniato", prov: "PI" },
  { name: "Pistoia", prov: "PT" }, { name: "Quarrata", prov: "PT" }, { name: "Monsummano Terme", prov: "PT" }, { name: "Montecatini-Terme", prov: "PT" }, { name: "Pescia", prov: "PT" },
  { name: "Lucca", prov: "LU" }, { name: "Viareggio", prov: "LU" }, { name: "Capannori", prov: "LU" }, { name: "Camaiore", prov: "LU" }, { name: "Pietrasanta", prov: "LU" },
  { name: "Grosseto", prov: "GR" }, { name: "Follonica", prov: "GR" }, { name: "Orbetello", prov: "GR" },
  { name: "Massa", prov: "MS" }, { name: "Carrara", prov: "MS" },
  { name: "Siena", prov: "SI" }, { name: "Poggibonsi", prov: "SI" }, { name: "Colle di Val d'Elsa", prov: "SI" },
  // Calabria
  { name: "Reggio di Calabria", prov: "RC" }, { name: "Palmi", prov: "RC" }, { name: "Gioia Tauro", prov: "RC" }, { name: "Siderno", prov: "RC" },
  { name: "Catanzaro", prov: "CZ" }, { name: "Lamezia Terme", prov: "CZ" },
  { name: "Cosenza", prov: "CS" }, { name: "Corigliano-Rossano", prov: "CS" }, { name: "Rende", prov: "CS" }, { name: "Castrovillari", prov: "CS" },
  { name: "Crotone", prov: "KR" }, { name: "Isola di Capo Rizzuto", prov: "KR" },
  { name: "Vibo Valentia", prov: "VV" }, { name: "Pizzo", prov: "VV" },
  // Sardegna
  { name: "Cagliari", prov: "CA" }, { name: "Quartu Sant'Elena", prov: "CA" }, { name: "Selargius", prov: "CA" }, { name: "Assemini", prov: "CA" }, { name: "Capoterra", prov: "CA" },
  { name: "Sassari", prov: "SS" }, { name: "Olbia", prov: "SS" }, { name: "Alghero", prov: "SS" }, { name: "Porto Torres", prov: "SS" },
  { name: "Nuoro", prov: "NU" }, { name: "Siniscola", prov: "NU" }, { name: "Macomer", prov: "NU" },
  { name: "Oristano", prov: "OR" }, { name: "Terralba", prov: "OR" },
  { name: "Carbonia", prov: "SU" }, { name: "Iglesias", prov: "SU" }, { name: "Villacidro", prov: "SU" },
  // Liguria
  { name: "Genova", prov: "GE" }, { name: "Rapallo", prov: "GE" }, { name: "Chiavari", prov: "GE" }, { name: "Sestri Levante", prov: "GE" }, { name: "Sanremo", prov: "IM" }, { name: "Imperia", prov: "IM" }, { name: "Ventimiglia", prov: "IM" }, { name: "Savona", prov: "SV" }, { name: "Albenga", prov: "SV" }, { name: "La Spezia", prov: "SP" }, { name: "Sarzana", prov: "SP" },
  // Marche
  { name: "Ancona", prov: "AN" }, { name: "Senigallia", prov: "AN" }, { name: "Jesi", prov: "AN" }, { name: "Osimo", prov: "AN" }, { name: "Pesaro", prov: "PU" }, { name: "Fano", prov: "PU" }, { name: "Urbino", prov: "PU" }, { name: "Macerata", prov: "MC" }, { name: "Civitanova Marche", prov: "MC" }, { name: "Recanati", prov: "MC" }, { name: "Ascoli Piceno", prov: "AP" }, { name: "San Benedetto del Tronto", prov: "AP" }, { name: "Fermo", prov: "FM" }, { name: "Porto Sant'Elpidio", prov: "FM" },
  // Abruzzo
  { name: "Pescara", prov: "PE" }, { name: "Montesilvano", prov: "PE" }, { name: "Spoltore", prov: "PE" }, { name: "L'Aquila", prov: "AQ" }, { name: "Avezzano", prov: "AQ" }, { name: "Sulmona", prov: "AQ" }, { name: "Teramo", prov: "TE" }, { name: "Roseto degli Abruzzi", prov: "TE" }, { name: "Giulianova", prov: "TE" }, { name: "Chieti", prov: "CH" }, { name: "Vasto", prov: "CH" }, { name: "Lanciano", prov: "CH" },
  // Friuli-Venezia Giulia
  { name: "Trieste", prov: "TS" }, { name: "Muggia", prov: "TS" }, { name: "Udine", prov: "UD" }, { name: "Codroipo", prov: "UD" }, { name: "Tavagnacco", prov: "UD" }, { name: "Pordenone", prov: "PN" }, { name: "Sacile", prov: "PN" }, { name: "Cordenons", prov: "PN" }, { name: "Gorizia", prov: "GO" }, { name: "Monfalcone", prov: "GO" },
  // Trentino-Alto Adige
  { name: "Trento", prov: "TN" }, { name: "Rovereto", prov: "TN" }, { name: "Pergine Valsugana", prov: "TN" }, { name: "Riva del Garda", prov: "TN" }, { name: "Bolzano", prov: "BZ" }, { name: "Merano", prov: "BZ" }, { name: "Bressanone", prov: "BZ" }, { name: "Laives", prov: "BZ" },
  // Umbria
  { name: "Perugia", prov: "PG" }, { name: "Foligno", prov: "PG" }, { name: "Città di Castello", prov: "PG" }, { name: "Spoleto", prov: "PG" }, { name: "Gubbio", prov: "PG" }, { name: "Assisi", prov: "PG" }, { name: "Terni", prov: "TR" }, { name: "Orvieto", prov: "TR" }, { name: "Narni", prov: "TR" },
  // Basilicata
  { name: "Potenza", prov: "PZ" }, { name: "Melfi", prov: "PZ" }, { name: "Lavello", prov: "PZ" }, { name: "Matera", prov: "MT" }, { name: "Pisticci", prov: "MT" }, { name: "Policoro", prov: "MT" },
  // Molise
  { name: "Campobasso", prov: "CB" }, { name: "Termoli", prov: "CB" }, { name: "Bojano", prov: "CB" }, { name: "Isernia", prov: "IS" }, { name: "Venafro", prov: "IS" },
  // Valle d'Aosta
  { name: "Aosta", prov: "AO" }, { name: "Sarre", prov: "AO" }, { name: "Châtillon", prov: "AO" }, { name: "Saint-Vincent", prov: "AO" }
];

// Dynamically ensure every one of the 107 provinces has its capital and towns present
const ALL_COMUNI_BY_PROV: { name: string; prov: string }[] = (() => {
  const list = [...MAJOR_COMUNI];
  const names = new Set(list.map((c) => c.name.toLowerCase()));
  PROVINCE_ITALIANE.forEach((p) => {
    let capital = p.name;
    if (capital.includes("-")) {
      capital.split("-").forEach((sub) => {
        const trimmed = sub.trim();
        if (!names.has(trimmed.toLowerCase())) {
          list.push({ name: trimmed, prov: p.code });
          names.add(trimmed.toLowerCase());
        }
      });
    } else {
      if (!names.has(capital.toLowerCase())) {
        list.push({ name: capital, prov: p.code });
        names.add(capital.toLowerCase());
      }
    }
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
})();

let dynamicComuniList: { name: string; prov: string }[] = [...ALL_COMUNI_BY_PROV];
let isComuniLoaded = false;
let comuniListeners: Array<() => void> = [];

function loadDynamicComuni() {
  if (isComuniLoaded) return;
  isComuniLoaded = true;
  fetchComuni().then((res) => {
    if (res && res.length > 0) {
      dynamicComuniList = res;
      comuniListeners.forEach((l) => l());
    }
  }).catch((e) => console.error("Error loading dynamic comuni:", e));
}

function useComuniList() {
  const [list, setList] = useState(dynamicComuniList);
  useEffect(() => {
    loadDynamicComuni();
    const listener = () => setList([...dynamicComuniList]);
    comuniListeners.push(listener);
    return () => {
      comuniListeners = comuniListeners.filter((l) => l !== listener);
    };
  }, []);
  return list;
}

// Helper functions for hierarchical procedural logic

function getProvinceRegion(provCode: string): string | null {
  if (!provCode) return null;
  const p = PROVINCE_ITALIANE.find((item) => item.code.toUpperCase() === provCode.toUpperCase());
  return p ? p.reg : null;
}

function getRegionCodeFromRegString(regStr: string): Region | "" {
  const r = regStr.toLowerCase().trim();
  if (r === "lombardia") return "lombardia";
  if (r === "lazio") return "lazio";
  if (r === "veneto") return "veneto";
  if (r === "campania") return "campania";
  if (r === "emilia-romagna" || r === "emilia") return "emilia";
  if (r === "piemonte") return "piemonte";
  if (r === "sicilia") return "sicilia";
  if (r === "puglia") return "puglia";
  if (r === "toscana") return "toscana";
  if (r === "calabria") return "calabria";
  if (r === "sardegna") return "sardegna";
  return "";
}

function isProvinceInRegion(provCode: string, regCode: Region | string): boolean {
  if (!regCode || !provCode) return true;
  const regList = regCode.split(",").map(r => r.trim()).filter(Boolean);
  if (regList.length === 0) return true;
  return regList.some(r => isProvinceInSingleRegion(provCode, r));
}

function isProvinceInSingleRegion(provCode: string, regCode: string): boolean {
  if (!regCode || !provCode) return true;
  const provRegStr = getProvinceRegion(provCode);
  if (!provRegStr) return true;
  const r = provRegStr.toLowerCase();
  const c = regCode.toLowerCase();
  if (c === "nord") {
    return ["lombardia", "piemonte", "veneto", "emilia-romagna", "liguria", "friuli-venezia giulia", "toscana", "trentino-alto adige", "valle d'aosta"].includes(r);
  }
  if (c === "centro") {
    return ["lazio", "toscana", "marche", "umbria", "abruzzo"].includes(r);
  }
  if (c === "sud") {
    return ["campania", "sicilia", "puglia", "calabria", "sardegna", "basilicata", "molise", "abruzzo"].includes(r);
  }
  if (c === "emilia") return r === "emilia-romagna";
  if (c === "valle d'aosta" || c === "aosta") return r === "valle d'aosta";
  if (c === "trentino" || c === "trentino-alto adige") return r === "trentino-alto adige";
  if (c === "friuli" || c === "friuli-venezia giulia") return r === "friuli-venezia giulia";
  return r === c;
}

function isCityInProvince(cityName: string, provCode: string): boolean {
  if (!provCode || !cityName) return true;
  const provList = provCode.split(",").map(p => p.trim().toUpperCase()).filter(Boolean);
  if (provList.length === 0) return true;
  const found = dynamicComuniList.find((c) => c.name.toLowerCase() === cityName.toLowerCase());
  if (!found) return true; // allow custom typed cities not in list

  return provList.includes(found.prov.toUpperCase());
}

export function GeoFilters({
  comune,
  provincia,
  regione,
  cap = "",
  onComune,
  onProvincia,
  onRegione,
  onCap,
}: Props) {
  const { t } = useT();
  const comuniList = useComuniList();

  const hasAnyGeo = Boolean(regione || provincia || comune || cap);


  const handleResetGeo = () => {
    onRegione("");
    onProvincia("");
    onComune("");
    if (onCap) onCap("");
  };

  // Procedural handlers to enforce hierarchy with MULTI-SELECT support
  const handleRegioneChange = (newReg: string) => {
    onRegione(newReg);
    if (newReg && provincia) {
      const provList = provincia.split(",").map(p => p.trim().toUpperCase()).filter(Boolean);
      const validProvs = provList.filter(p => isProvinceInRegion(p, newReg));
      const validProvsStr = validProvs.join(", ");
      if (validProvsStr !== provincia) {
        onProvincia(validProvsStr);
      }
      if (comune) {
        const cityList = comune.split(",").map(c => c.trim()).filter(Boolean);
        const validCities = cityList.filter(c => {
          if (validProvs.length > 0) return isCityInProvince(c, validProvsStr);
          const found = dynamicComuniList.find(item => item.name.toLowerCase() === c.toLowerCase());
          return found ? isProvinceInRegion(found.prov, newReg) : true;
        });

        const validCitiesStr = validCities.join(", ");
        if (validCitiesStr !== comune) {
          onComune(validCitiesStr);
        }
      }
    }
  };

  const handleProvinciaChange = (newProv: string) => {
    onProvincia(newProv);
    if (newProv) {
      const provList = newProv.split(",").map(p => p.trim().toUpperCase()).filter(Boolean);
      // Auto-expand Regione if a newly selected province doesn't belong to current region list
      if (regione) {
        const currentRegs = regione.split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
        let updatedRegs = [...currentRegs];
        let changed = false;
        for (const p of provList) {
          if (!isProvinceInRegion(p, updatedRegs.join(","))) {
            const provRegStr = getProvinceRegion(p);
            if (provRegStr) {
              const rCode = getRegionCodeFromRegString(provRegStr);
              if (rCode && !updatedRegs.includes(rCode)) {
                updatedRegs.push(rCode);
                changed = true;
              }
            }
          }
        }
        if (changed) {
          onRegione(updatedRegs.join(", "));
        }
      } else if (provList.length === 1) {
        const provRegStr = getProvinceRegion(provList[0]);
        if (provRegStr) {
          const rCode = getRegionCodeFromRegString(provRegStr);
          if (rCode) onRegione(rCode);
        }
      }

      if (comune) {
        const cityList = comune.split(",").map(c => c.trim()).filter(Boolean);
        const validCities = cityList.filter(c => isCityInProvince(c, newProv));
        const validCitiesStr = validCities.join(", ");
        if (validCitiesStr !== comune) {
          onComune(validCitiesStr);
        }
      }
    } else {
      onComune("");
    }
  };

  const handleComuneChange = (newCity: string) => {
    onComune(newCity);
    if (newCity && !provincia && !regione) {
      const cityList = newCity.split(",").map(c => c.trim()).filter(Boolean);
      if (cityList.length === 1) {
        const foundCity = dynamicComuniList.find((c) => c.name.toLowerCase() === cityList[0].toLowerCase());
        if (foundCity) {

          onProvincia(foundCity.prov);
          const provRegStr = getProvinceRegion(foundCity.prov);
          if (provRegStr) {
            const rCode = getRegionCodeFromRegString(provRegStr);
            if (rCode) onRegione(rCode);
          }
        }
      }
    }
  };

  const activeProvincesCount = useMemo(() => {
    if (!regione) return PROVINCE_ITALIANE.length;
    return PROVINCE_ITALIANE.filter((p) => isProvinceInRegion(p.code, regione)).length;
  }, [regione]);

  const activeCitiesCount = useMemo(() => {
    if (provincia) {
      const provList = provincia.split(",").map(p => p.trim().toUpperCase()).filter(Boolean);
      return comuniList.filter((c) => provList.includes(c.prov.toUpperCase())).length;
    }
    if (regione) return comuniList.filter((c) => isProvinceInRegion(c.prov, regione)).length;
    return comuniList.length;
  }, [provincia, regione, comuniList]);


  return (
    <div className="w-full space-y-4">
      {/* Top Bar for Geo: Status and Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-transparent p-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>{t("geo.bar.subtitle" as any) || "Filtro Geografico e Territoriale"}</span>
              {hasAnyGeo ? (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                  {t("geo.active" as any) || "FILTRO ATTIVO"}
                </span>
              ) : (
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400 border border-white/10">
                  {t("geo.scope.nazionale" as any) || "Nazionale (Tutta Italia)"}
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-300">
              Sistema procedurale gerarchico: selezionando una Regione si filtrano automaticamente le Province, e selezionando una Provincia si mostrano solo i Comuni appartenenti ad essa.
            </div>
          </div>
        </div>

        {hasAnyGeo && (
          <button
            type="button"
            onClick={handleResetGeo}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 border border-red-500/30 hover:bg-red-500/30 hover:text-white transition-all shadow-sm"
          >
            <X className="h-3.5 w-3.5" />
            <span>{t("geo.reset" as any) || "Azzera Geometria (Tutta Italia)"}</span>
          </button>
        )}
      </div>

      {/* Quick Pills for Most Popular Macroregions & Regions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] font-mono uppercase text-zinc-400 mr-1 flex items-center gap-1">
          <Navigation className="h-3 w-3 text-cyan-400" /> Selezioni Principali:
        </span>
        {[
          { code: "nord" as Region, label: "Nord Italia" },
          { code: "centro" as Region, label: "Centro Italia" },
          { code: "sud" as Region, label: "Sud e Isole" },
          { code: "lombardia" as Region, label: "Lombardia" },
          { code: "lazio" as Region, label: "Lazio" },
          { code: "veneto" as Region, label: "Veneto" },
          { code: "campania" as Region, label: "Campania" },
          { code: "emilia" as Region, label: "Emilia-Romagna" },
          { code: "piemonte" as Region, label: "Piemonte" },
          { code: "sicilia" as Region, label: "Sicilia" },
        ].map((item) => {
          const currentRegs = (regione || "").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
          const isActive = currentRegs.includes(item.code);
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                if (isActive) {
                  handleRegioneChange(currentRegs.filter(c => c !== item.code).join(", "));
                } else {
                  handleRegioneChange([...currentRegs, item.code].join(", "));
                }
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-all border",
                isActive
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] font-bold"
                  : "bg-black/40 text-zinc-400 border-white/5 hover:border-white/20 hover:text-white"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 4-COLUMN HORIZONTAL GRID FOR MAXIMUM READABILITY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-1">
        {/* Column 1: REGIONE */}
        <div className="space-y-1.5 bg-black/40 p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 transition-all shadow-inner">
          <Label className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {t("geo.col.regione" as any) || "Regione / Macro"}
            </span>
          </Label>
          <RegionFloatingSelector value={regione} onChange={handleRegioneChange} />
        </div>

        {/* Column 2: PROVINCIA */}
        <div className="space-y-1.5 bg-black/40 p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 transition-all shadow-inner">
          <Label className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5" />
              {regione ? `Provincia (${regione.toUpperCase()}: ${activeProvincesCount})` : "Provincia (107)"}
            </span>
          </Label>
          <ProvinceFloatingSelector value={provincia} onChange={handleProvinciaChange} regione={regione} />
        </div>

        {/* Column 3: COMUNE / CITTÀ */}
        <div className="space-y-1.5 bg-black/40 p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 transition-all shadow-inner">
          <Label className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {provincia ? `Città / Comune (prov. ${provincia}: ${activeCitiesCount})` : "Città / Comune"}
            </span>
          </Label>
          <CityFloatingSelector value={comune} onChange={handleComuneChange} provincia={provincia} regione={regione} />
        </div>

        {/* Column 4: CAP */}
        <div className="space-y-1.5 bg-black/40 p-3.5 rounded-xl border border-white/10 hover:border-cyan-500/40 transition-all shadow-inner">
          <Label className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {t("geo.col.cap" as any) || "CAP (Codice Postale)"}
            </span>
          </Label>
          <div className="relative">
            <Input
              value={cap}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 5);
                if (onCap) onCap(val);
              }}
              maxLength={5}
              placeholder={t("geo.cap.placeholder" as any) || "es. 00100, 20100..."}
              className="glass h-11 w-full border-white/15 bg-black/60 font-mono tracking-wider text-sm text-white focus:border-cyan-500 pr-8"
            />
            {cap && (
              <button
                type="button"
                onClick={() => { if (onCap) onCap(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Floating Region Combobox Selector (Multi-select with Chips)
function RegionFloatingSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCodes = useMemo(() => {
    return (value || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  }, [value]);

  const toggleRegion = (code: string) => {
    if (!code) {
      onChange("");
      setOpen(false);
      return;
    }
    if (selectedCodes.includes(code)) {
      const next = selectedCodes.filter(c => c !== code);
      onChange(next.join(", "));
    } else {
      const next = [...selectedCodes, code];
      onChange(next.join(", "));
    }
  };

  const removeRegion = (codeToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedCodes.filter(c => c !== codeToRemove);
    onChange(next.join(", "));
  };

  return (
    <div className="relative w-full space-y-1.5" ref={containerRef}>
      <div
        onClick={() => setOpen(!open)}
        className={cn(
          "glass flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3 py-1.5 text-sm text-white shadow-sm transition-all cursor-pointer gap-2",
          open ? "border-cyan-500 bg-black/80 shadow-[0_0_20px_rgba(6,182,212,0.2)]" : "border-white/15 bg-black/50 hover:border-white/30"
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-hidden py-0.5">
          {selectedCodes.length > 0 ? (
            selectedCodes.map((code) => {
              const rObj = REGIONI_ITALIANE.find(r => r.code === code) || { name: code.toUpperCase() };
              return (
                <span key={code} className="inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg px-2 py-0.5 text-xs font-semibold shadow-sm">
                  <span>{rObj.name}</span>
                  <button
                    type="button"
                    onClick={(e) => removeRegion(code, e)}
                    className="hover:text-white transition-colors ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-zinc-500 text-xs truncate py-1">
              {t("geo.regioni.label" as any) || "Seleziona una o più Regioni..."}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedCodes.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              title="Azzera regioni"
              className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform duration-200", open && "rotate-180 text-cyan-400")} />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/20 bg-[#0B0F14]/95 backdrop-blur-2xl p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-150 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
          <button
            type="button"
            onClick={() => toggleRegion("")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all",
              selectedCodes.length === 0 ? "bg-white/10 text-white font-bold" : "text-zinc-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <span>Tutta Italia (Nessuna restrizione)</span>
            {selectedCodes.length === 0 && <Check className="h-3.5 w-3.5 text-emerald-400" />}
          </button>
          {REGIONI_ITALIANE.map((r) => {
            const isSelected = selectedCodes.includes(r.code);
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => toggleRegion(r.code)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all",
                  isSelected
                    ? "bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white font-bold border border-cyan-500/30"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate">{r.name}</span>
                  <span className="text-[10px] text-zinc-500 hidden xl:inline">({r.desc})</span>
                </div>
                {isSelected ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded border border-white/20 inline-block" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Floating Province Combobox Selector (Multi-select with Chips & Search)
function ProvinceFloatingSelector({ value, onChange, regione }: { value: string; onChange: (v: string) => void; regione: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCodes = useMemo(() => {
    return (value || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  }, [value]);

  const filtered = useMemo(() => {
    let list = PROVINCE_ITALIANE;
    if (regione) {
      list = list.filter((p) => isProvinceInRegion(p.code, regione));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.reg.toLowerCase().includes(q)
    );
  }, [search, regione]);

  const toggleProvince = (code: string) => {
    const upper = code.toUpperCase();
    if (selectedCodes.includes(upper)) {
      const next = selectedCodes.filter(c => c !== upper);
      onChange(next.join(", "));
    } else {
      const next = [...selectedCodes, upper];
      onChange(next.join(", "));
    }
  };

  const removeProvince = (codeToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedCodes.filter(c => c !== codeToRemove);
    onChange(next.join(", "));
  };

  return (
    <div className="relative w-full space-y-1.5" ref={containerRef}>
      <div className="relative">
        <div
          onClick={() => setOpen(!open)}
          className={cn(
            "glass flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3 py-1.5 text-sm text-white shadow-sm transition-all cursor-pointer gap-2",
            open ? "border-cyan-500 bg-black/80 shadow-[0_0_20px_rgba(6,182,212,0.2)]" : "border-white/15 bg-black/50 hover:border-white/30"
          )}
        >
          <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-hidden py-0.5">
            {selectedCodes.length > 0 ? (
              selectedCodes.map((code) => {
                const pObj = PROVINCE_ITALIANE.find(p => p.code === code) || { name: code };
                return (
                  <span key={code} className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg px-2 py-0.5 text-xs font-semibold shadow-sm">
                    <span className="font-mono font-bold bg-black/30 px-1 rounded text-[10px] text-emerald-400">{code}</span>
                    <span className="truncate max-w-[120px]">{pObj.name}</span>
                    <button
                      type="button"
                      onClick={(e) => removeProvince(code, e)}
                      className="hover:text-white transition-colors ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })
            ) : (
              <span className="text-zinc-500 text-xs truncate py-1">
                {regione ? `Seleziona tra ${filtered.length} province (o più)...` : (t("geo.provincia.placeholder" as any) || "es. RM, MI, NA, TO...")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedCodes.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setSearch("");
                }}
                className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform duration-200", open && "rotate-180 text-cyan-400")} />
          </div>
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-hidden rounded-xl border border-white/20 bg-[#0B0F14]/95 backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2.5">
              <Search className="h-4 w-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={regione ? `Cerca provincia in ${regione.toUpperCase()}...` : "Cerca sigla (RM) o città (Roma)..."}
                className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                autoFocus
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-zinc-500 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Nessuna provincia per "{search}"
                </div>
              ) : (
                filtered.map((p) => {
                  const isSelected = selectedCodes.includes(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => toggleProvince(p.code)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all",
                        isSelected
                          ? "bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white font-bold border border-cyan-500/30"
                          : "text-zinc-300 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className={cn(
                            "flex h-5 w-7 items-center justify-center rounded font-mono text-[11px] font-bold",
                            isSelected ? "bg-cyan-400 text-black shadow-sm" : "bg-white/10 text-cyan-400"
                          )}
                        >
                          {p.code}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 hidden sm:inline">({p.reg})</span>
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded border border-white/20 inline-block" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Floating City Combobox Selector (Multi-select with Chips & Search)
function CityFloatingSelector({ value, onChange, provincia, regione }: { value: string; onChange: (v: string) => void; provincia: string; regione: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const comuniList = useComuniList();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCities = useMemo(() => {
    return (value || "").split(",").map(s => s.trim()).filter(Boolean);
  }, [value]);

  const availableCities = useMemo(() => {
    let list = comuniList;
    if (provincia) {
      const provList = provincia.split(",").map(p => p.trim().toUpperCase()).filter(Boolean);
      list = list.filter((c) => provList.includes(c.prov.toUpperCase()));
    } else if (regione) {
      list = list.filter((c) => isProvinceInRegion(c.prov, regione));
    }
    return list;
  }, [provincia, regione, comuniList]);


  const filtered = useMemo(() => {
    if (!search.trim()) return availableCities;
    const q = search.toLowerCase().trim();
    return availableCities.filter((c) => c.name.toLowerCase().includes(q));
  }, [search, availableCities]);

  const toggleCity = (name: string) => {
    if (selectedCities.some(c => c.toLowerCase() === name.toLowerCase())) {
      const next = selectedCities.filter(c => c.toLowerCase() !== name.toLowerCase());
      onChange(next.join(", "));
    } else {
      const next = [...selectedCities, name];
      onChange(next.join(", "));
    }
  };

  const removeCity = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedCities.filter(c => c.toLowerCase() !== nameToRemove.toLowerCase());
    onChange(next.join(", "));
  };

  return (
    <div className="relative w-full space-y-1.5" ref={containerRef}>
      <div className="relative">
        <div
          onClick={() => setOpen(!open)}
          className={cn(
            "glass flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3 py-1.5 text-sm text-white shadow-sm transition-all cursor-pointer gap-2",
            open ? "border-cyan-500 bg-black/80 shadow-[0_0_20px_rgba(6,182,212,0.2)]" : "border-white/15 bg-black/50 hover:border-white/30"
          )}
        >
          <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-hidden py-0.5">
            {selectedCities.length > 0 ? (
              selectedCities.map((city) => {
                const cObj = comuniList.find(c => c.name.toLowerCase() === city.toLowerCase()) || { name: city, prov: "?" };
                return (

                  <span key={city} className="inline-flex items-center gap-1 bg-violet-500/20 text-violet-300 border border-violet-500/40 rounded-lg px-2 py-0.5 text-xs font-semibold shadow-sm">
                    <span>{city}</span>
                    <span className="text-[10px] text-violet-400 font-mono">({cObj.prov})</span>
                    <button
                      type="button"
                      onClick={(e) => removeCity(city, e)}
                      className="hover:text-white transition-colors ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })
            ) : (
              <span className="text-zinc-500 text-xs truncate py-1">
                {provincia ? `Seleziona tra ${availableCities.length} comuni (o più)...` : (t("geo.citta.placeholder" as any) || "es. Roma, Milano, Napoli...")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedCities.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setSearch("");
                }}
                className="rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform duration-200", open && "rotate-180 text-cyan-400")} />
          </div>
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-hidden rounded-xl border border-white/20 bg-[#0B0F14]/95 backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2.5">
              <Search className="h-4 w-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    e.preventDefault();
                    toggleCity(search.trim());
                    setSearch("");
                  }
                }}
                placeholder="Cerca o digita nome comune e premi Enter per aggiungere..."
                className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                autoFocus
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-zinc-500 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400">
                  <p>Nessun comune in lista per "{search}".</p>
                  <button
                    type="button"
                    onClick={() => {
                      toggleCity(search.trim());
                      setSearch("");
                    }}
                    className="mt-2 rounded bg-cyan-500/20 text-cyan-300 px-3 py-1.5 text-xs font-bold border border-cyan-500/30 hover:bg-cyan-500/30"
                  >
                    + Aggiungi "{search}" come comune custom
                  </button>
                </div>
              ) : (
                filtered.map((c) => {
                  const isSelected = selectedCities.some(city => city.toLowerCase() === c.name.toLowerCase());
                  return (
                    <button
                      key={`${c.name}-${c.prov}`}
                      type="button"
                      onClick={() => toggleCity(c.name)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-all",
                        isSelected
                          ? "bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-white font-bold border border-cyan-500/30"
                          : "text-zinc-300 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Building2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate font-semibold">{c.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">({c.prov})</span>
                      </div>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded border border-white/20 inline-block" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
