// UCL Quarter-Finalists 1995-2025 squad data (teams that reached the QF
// but were eliminated BEFORE the semifinal). One iconic side per season.
// Format mirrors seasons.js. Overalls reflect that specific season's level.

const T = (club, country, crest, players) => ({ club, country, crest, players });
const P = (name, primary, secondary, overall, nationality = "") => ({ name, primary, secondary, overall, nationality });

export const QUARTERFINALISTS = {
  1995: [
    // Real Madrid 1995-96, eliminated by Juventus in the QF
    T("Real Madrid", "🇪🇸", "RMA", [
      P("Paco Buyo","GK","GK",83,"🇪🇸"),
      P("Manolo Sanchís","CB","CB",85,"🇪🇸"),
      P("Fernando Hierro","CB","CDM",88,"🇪🇸"),
      P("Rafael Alkorta","CB","CB",82,"🇪🇸"),
      P("Quique Sánchez Flores","RB","CB",78,"🇪🇸"),
      P("Roberto Carlos","LB","LWB",84,"🇧🇷"),
      P("Fernando Redondo","CDM","CM",88,"🇦🇷"),
      P("Luis Enrique","CM","CAM",84,"🇪🇸"),
      P("Michael Laudrup","CAM","CF",89,"🇩🇰"),
      P("José Emilio Amavisca","LW","LM",80,"🇪🇸"),
      P("Iván Zamorano","ST","CF",87,"🇨🇱"),
      P("Juan Esnáider","ST","CF",80,"🇦🇷"),
      P("Santiago Cañizares","GK","GK",81,"🇪🇸"),
    ]),
  ],

  1996: [
    // Manchester United 1996-97, eliminated by Borussia Dortmund in SF? Actually MU reached SF. Skip.
    // Pick Atlético Madrid 1996-97 — won La Liga the previous season, in CL eliminated by Ajax in QF
    T("Atlético Madrid", "🇪🇸", "ATM", [
      P("José Francisco Molina","GK","GK",83,"🇪🇸"),
      P("Delfí Geli","RB","CB",78,"🇪🇸"),
      P("Roberto Solozábal","CB","CB",79,"🇪🇸"),
      P("Santi Denia","CB","CB",78,"🇪🇸"),
      P("Toni Muñoz","LB","LB",77,"🇪🇸"),
      P("Diego Simeone","CDM","CM",87,"🇦🇷"),
      P("José Luis Caminero","CM","CDM",83,"🇪🇸"),
      P("Juan Esnáider","ST","CF",80,"🇦🇷"),
      P("Milinko Pantić","CAM","CM",84,"🇷🇸"),
      P("Lyuboslav Penev","ST","CF",81,"🇧🇬"),
      P("Kiko","ST","CF",83,"🇪🇸"),
      P("Christian Vieri","ST","CF",87,"🇮🇹"),
      P("Juan Vizcaíno","CM","CDM",78,"🇪🇸"),
    ]),
  ],

  1997: [
    // Bayer Leverkusen 1997-98, eliminated by Real Madrid in QF
    T("Bayer Leverkusen", "🇩🇪", "B04", [
      P("Dirk Heinen","GK","GK",80,"🇩🇪"),
      P("Jens Nowotny","CB","CB",85,"🇩🇪"),
      P("Christian Wörns","CB","CB",83,"🇩🇪"),
      P("Markus Happe","CB","RB",78,"🇩🇪"),
      P("Wolfgang Feiersinger","CB","CDM",78,"🇦🇹"),
      P("Paulo Sérgio","CAM","CM",85,"🇧🇷"),
      P("Bernd Schneider","RM","CM",83,"🇩🇪"),
      P("Jens Heinrich","CM","CDM",80,"🇩🇪"),
      P("Emerson","CDM","CM",85,"🇧🇷"),
      P("Ulf Kirsten","ST","CF",85,"🇩🇪"),
      P("Rudi Völler","ST","CF",81,"🇩🇪"),
      P("Markus Münch","CB","CB",76,"🇩🇪"),
      P("Erik Meijer","ST","CF",77,"🇳🇱"),
    ]),
  ],

  1998: [
    // Inter Milan 1998-99, eliminated by Manchester United in QF
    T("Inter", "🇮🇹", "INT", [
      P("Gianluca Pagliuca","GK","GK",85,"🇮🇹"),
      P("Javier Zanetti","RB","RM",88,"🇦🇷"),
      P("Giuseppe Bergomi","CB","CB",83,"🇮🇹"),
      P("Salvatore Fresi","CB","CB",78,"🇮🇹"),
      P("Aron Winter","CM","CAM",82,"🇳🇱"),
      P("Diego Simeone","CDM","CM",86,"🇦🇷"),
      P("Youri Djorkaeff","CAM","CF",87,"🇫🇷"),
      P("Roberto Baggio","CAM","CF",89,"🇮🇹"),
      P("Iván Zamorano","ST","CF",84,"🇨🇱"),
      P("Ronaldo","ST","CF",94,"🇧🇷"),
      P("Álvaro Recoba","CAM","LW",86,"🇺🇾"),
      P("Francesco Colonnese","LB","CB",78,"🇮🇹"),
      P("Nicola Ventola","ST","CF",79,"🇮🇹"),
    ]),
  ],

  1999: [
    // Chelsea 1999-2000, eliminated by Barcelona in QF
    T("Chelsea", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "CHE", [
      P("Ed de Goey","GK","GK",83,"🇳🇱"),
      P("Albert Ferrer","RB","RB",81,"🇪🇸"),
      P("Marcel Desailly","CB","CDM",89,"🇫🇷"),
      P("Frank Leboeuf","CB","CB",85,"🇫🇷"),
      P("Celestine Babayaro","LB","LM",80,"🇳🇬"),
      P("Dennis Wise","CDM","CM",83,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Roberto Di Matteo","CM","CDM",83,"🇮🇹"),
      P("Gustavo Poyet","CAM","CM",84,"🇺🇾"),
      P("Gianfranco Zola","CAM","CF",88,"🇮🇹"),
      P("Tore André Flo","ST","CF",81,"🇳🇴"),
      P("George Weah","ST","CF",83,"🇱🇷"),
      P("Didier Deschamps","CDM","CM",84,"🇫🇷"),
      P("Dan Petrescu","RB","RM",81,"🇷🇴"),
    ]),
  ],

  2000: [
    // Arsenal 2000-01, eliminated by Valencia in QF on away goals
    T("Arsenal", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "ARS", [
      P("David Seaman","GK","GK",86,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Lee Dixon","RB","CB",80,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Tony Adams","CB","CB",85,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Martin Keown","CB","CB",83,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Ashley Cole","LB","LWB",82,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Patrick Vieira","CDM","CM",91,"🇫🇷"),
      P("Emmanuel Petit","CM","CDM",84,"🇫🇷"),
      P("Robert Pirès","LW","CAM",87,"🇫🇷"),
      P("Fredrik Ljungberg","RW","RM",84,"🇸🇪"),
      P("Dennis Bergkamp","CAM","CF",89,"🇳🇱"),
      P("Thierry Henry","ST","LW",90,"🇫🇷"),
      P("Sylvain Wiltord","ST","RW",83,"🇫🇷"),
      P("Gilles Grimandi","CDM","CB",78,"🇫🇷"),
    ]),
  ],

  2001: [
    // Liverpool 2001-02, eliminated by Bayer Leverkusen in QF
    T("Liverpool", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "LIV", [
      P("Jerzy Dudek","GK","GK",84,"🇵🇱"),
      P("Stéphane Henchoz","CB","CB",82,"🇨🇭"),
      P("Sami Hyypiä","CB","CB",87,"🇫🇮"),
      P("Jamie Carragher","CB","RB",83,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("John Arne Riise","LB","LM",83,"🇳🇴"),
      P("Steven Gerrard","CM","CAM",87,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Dietmar Hamann","CDM","CM",84,"🇩🇪"),
      P("Danny Murphy","CM","CAM",81,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Vladimír Šmicer","CAM","RW",80,"🇨🇿"),
      P("Emile Heskey","ST","LW",81,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Michael Owen","ST","CF",89,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Robbie Fowler","ST","CF",83,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Patrik Berger","CAM","LM",80,"🇨🇿"),
    ]),
  ],

  2002: [
    // Manchester United 2002-03, eliminated by Real Madrid in QF
    T("Manchester United", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MUN", [
      P("Fabien Barthez","GK","GK",84,"🇫🇷"),
      P("Gary Neville","RB","RB",83,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Rio Ferdinand","CB","CB",88,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Mikaël Silvestre","CB","LB",83,"🇫🇷"),
      P("Phil Neville","LB","CDM",80,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Roy Keane","CDM","CM",90,"🇮🇪"),
      P("Paul Scholes","CM","CAM",89,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("David Beckham","RM","CAM",90,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Ryan Giggs","LW","LM",88,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Juan Sebastián Verón","CM","CAM",84,"🇦🇷"),
      P("Ruud van Nistelrooy","ST","CF",92,"🇳🇱"),
      P("Ole Gunnar Solskjær","ST","CF",83,"🇳🇴"),
      P("Diego Forlán","ST","CF",81,"🇺🇾"),
    ]),
  ],

  2003: [
    // Arsenal 2003-04 (Invincibles season), eliminated by Chelsea in QF
    T("Arsenal", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "ARS", [
      P("Jens Lehmann","GK","GK",86,"🇩🇪"),
      P("Lauren","RB","CB",83,"🇨🇲"),
      P("Sol Campbell","CB","CB",87,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Kolo Touré","CB","CDM",84,"🇨🇮"),
      P("Ashley Cole","LB","LWB",85,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Patrick Vieira","CDM","CM",92,"🇫🇷"),
      P("Gilberto Silva","CDM","CM",84,"🇧🇷"),
      P("Freddie Ljungberg","RW","RM",85,"🇸🇪"),
      P("Robert Pirès","LW","CAM",89,"🇫🇷"),
      P("Dennis Bergkamp","CAM","CF",87,"🇳🇱"),
      P("Thierry Henry","ST","LW",95,"🇫🇷"),
      P("José Antonio Reyes","LW","CAM",80,"🇪🇸"),
      P("Edu","CM","CAM",80,"🇧🇷"),
    ]),
  ],

  2004: [
    // Real Madrid 2004-05, eliminated by Juventus in R16... actually Real reached R16, eliminated by Juventus.
    // Pick Bayern Munich 2004-05, eliminated by Chelsea in QF
    T("Bayern Munich", "🇩🇪", "FCB", [
      P("Oliver Kahn","GK","GK",90,"🇩🇪"),
      P("Willy Sagnol","RB","RB",83,"🇫🇷"),
      P("Lúcio","CB","CB",86,"🇧🇷"),
      P("Robert Kovač","CB","CB",81,"🇭🇷"),
      P("Bixente Lizarazu","LB","LB",84,"🇫🇷"),
      P("Michael Ballack","CM","CAM",90,"🇩🇪"),
      P("Torsten Frings","CDM","CM",84,"🇩🇪"),
      P("Zé Roberto","LM","LWB",84,"🇧🇷"),
      P("Mehmet Scholl","CAM","RM",83,"🇩🇪"),
      P("Roy Makaay","ST","CF",87,"🇳🇱"),
      P("Claudio Pizarro","ST","CF",82,"🇵🇪"),
      P("Owen Hargreaves","CDM","CM",81,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Bastian Schweinsteiger","CM","LM",80,"🇩🇪"),
    ]),
  ],

  2005: [
    // Juventus 2005-06, eliminated by Arsenal in QF
    T("Juventus", "🇮🇹", "JUV", [
      P("Gianluigi Buffon","GK","GK",92,"🇮🇹"),
      P("Lilian Thuram","CB","RB",86,"🇫🇷"),
      P("Fabio Cannavaro","CB","CB",92,"🇮🇹"),
      P("Gianluca Zambrotta","RB","LB",85,"🇮🇹"),
      P("Federico Balzaretti","LB","LB",78,"🇮🇹"),
      P("Patrick Vieira","CDM","CM",87,"🇫🇷"),
      P("Pavel Nedvěd","CAM","LM",90,"🇨🇿"),
      P("Mauro Camoranesi","RM","CAM",84,"🇦🇷"),
      P("Emerson","CDM","CM",84,"🇧🇷"),
      P("David Trezeguet","ST","CF",87,"🇫🇷"),
      P("Zlatan Ibrahimović","ST","CF",87,"🇸🇪"),
      P("Adrian Mutu","ST","CAM",81,"🇷🇴"),
      P("Jonathan Zebina","CB","RB",78,"🇫🇷"),
    ]),
  ],

  2006: [
    // Roma 2006-07, eliminated by Manchester United in QF
    T("Roma", "🇮🇹", "ROM", [
      P("Doni","GK","GK",83,"🇧🇷"),
      P("Christian Panucci","CB","RB",82,"🇮🇹"),
      P("Philippe Mexès","CB","CB",83,"🇫🇷"),
      P("Cristian Chivu","CB","LB",83,"🇷🇴"),
      P("Marco Cassetti","RB","RM",78,"🇮🇹"),
      P("Daniele De Rossi","CDM","CM",87,"🇮🇹"),
      P("Simone Perrotta","CM","CAM",83,"🇮🇹"),
      P("David Pizarro","CM","CDM",83,"🇨🇱"),
      P("Mancini","RW","CAM",82,"🇧🇷"),
      P("Francesco Totti","CAM","CF",92,"🇮🇹"),
      P("Mirko Vučinić","ST","CF",80,"🇲🇪"),
      P("Rodrigo Taddei","RM","CM",78,"🇧🇷"),
      P("Matteo Brighi","CM","CDM",77,"🇮🇹"),
    ]),
  ],

  2007: [
    // Arsenal 2007-08, eliminated by Liverpool in QF
    T("Arsenal", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "ARS", [
      P("Manuel Almunia","GK","GK",80,"🇪🇸"),
      P("Bacary Sagna","RB","RB",84,"🇫🇷"),
      P("Kolo Touré","CB","CDM",84,"🇨🇮"),
      P("William Gallas","CB","CB",85,"🇫🇷"),
      P("Gaël Clichy","LB","LB",83,"🇫🇷"),
      P("Mathieu Flamini","CDM","CM",83,"🇫🇷"),
      P("Cesc Fàbregas","CM","CAM",88,"🇪🇸"),
      P("Alexander Hleb","CAM","RW",83,"🇧🇾"),
      P("Tomáš Rosický","CAM","CM",82,"🇨🇿"),
      P("Emmanuel Adebayor","ST","CF",85,"🇹🇬"),
      P("Robin van Persie","ST","LW",83,"🇳🇱"),
      P("Theo Walcott","RW","ST",80,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Eduardo","ST","CF",80,"🇭🇷"),
    ]),
  ],

  2008: [
    // Liverpool 2008-09, eliminated by Chelsea in QF
    T("Liverpool", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "LIV", [
      P("Pepe Reina","GK","GK",87,"🇪🇸"),
      P("Álvaro Arbeloa","RB","CB",81,"🇪🇸"),
      P("Jamie Carragher","CB","CB",85,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Martin Škrtel","CB","CB",82,"🇸🇰"),
      P("Fábio Aurélio","LB","LM",80,"🇧🇷"),
      P("Javier Mascherano","CDM","CM",87,"🇦🇷"),
      P("Xabi Alonso","CM","CDM",88,"🇪🇸"),
      P("Steven Gerrard","CAM","CM",92,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Dirk Kuyt","RW","ST",83,"🇳🇱"),
      P("Fernando Torres","ST","CF",91,"🇪🇸"),
      P("Yossi Benayoun","CAM","RW",81,"🇮🇱"),
      P("Albert Riera","LW","LM",78,"🇪🇸"),
      P("Lucas Leiva","CDM","CM",78,"🇧🇷"),
    ]),
  ],

  2009: [
    // Manchester United 2009-10, eliminated by Bayern Munich in QF
    T("Manchester United", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MUN", [
      P("Edwin van der Sar","GK","GK",87,"🇳🇱"),
      P("Gary Neville","RB","RB",80,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Rio Ferdinand","CB","CB",88,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Nemanja Vidić","CB","CB",89,"🇷🇸"),
      P("Patrice Evra","LB","LWB",85,"🇫🇷"),
      P("Michael Carrick","CDM","CM",83,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Paul Scholes","CM","CAM",86,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Darren Fletcher","CM","CDM",81,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Antonio Valencia","RW","RM",84,"🇪🇨"),
      P("Ryan Giggs","LW","CAM",85,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Wayne Rooney","ST","CF",92,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Dimitar Berbatov","ST","CF",83,"🇧🇬"),
      P("Nani","LW","RW",81,"🇵🇹"),
    ]),
  ],

  2010: [
    // Tottenham 2010-11, eliminated by Real Madrid in QF
    T("Tottenham", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "TOT", [
      P("Heurelho Gomes","GK","GK",81,"🇧🇷"),
      P("Alan Hutton","RB","RB",78,"🏴󠁧󠁢󠁳󠁣󠁴󠁿"),
      P("Michael Dawson","CB","CB",82,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Younès Kaboul","CB","CB",80,"🇫🇷"),
      P("Benoît Assou-Ekotto","LB","LB",80,"🇨🇲"),
      P("Sandro","CDM","CM",80,"🇧🇷"),
      P("Luka Modrić","CAM","CM",86,"🇭🇷"),
      P("Rafael van der Vaart","CAM","CF",85,"🇳🇱"),
      P("Aaron Lennon","RW","RM",81,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Gareth Bale","LW","LM",87,"🏴󠁧󠁢󠁷󠁬󠁳󠁿"),
      P("Peter Crouch","ST","CF",80,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Jermain Defoe","ST","CF",80,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Tom Huddlestone","CM","CDM",78,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
    ]),
  ],

  2011: [
    // Chelsea 2011-12 reached SF & won — skip. Pick AC Milan 2011-12, eliminated by Barcelona in QF
    T("AC Milan", "🇮🇹", "MIL", [
      P("Christian Abbiati","GK","GK",83,"🇮🇹"),
      P("Ignazio Abate","RB","RB",80,"🇮🇹"),
      P("Thiago Silva","CB","CB",90,"🇧🇷"),
      P("Philippe Mexès","CB","CB",83,"🇫🇷"),
      P("Luca Antonini","LB","LM",78,"🇮🇹"),
      P("Massimo Ambrosini","CDM","CM",81,"🇮🇹"),
      P("Mark van Bommel","CDM","CM",83,"🇳🇱"),
      P("Antonio Nocerino","CM","CAM",80,"🇮🇹"),
      P("Kevin-Prince Boateng","CAM","CM",83,"🇬🇭"),
      P("Zlatan Ibrahimović","ST","CF",92,"🇸🇪"),
      P("Robinho","LW","ST",83,"🇧🇷"),
      P("Alexandre Pato","ST","CF",83,"🇧🇷"),
      P("Clarence Seedorf","CAM","CM",83,"🇳🇱"),
    ]),
  ],

  2012: [
    // Juventus 2012-13, eliminated by Bayern Munich in QF
    T("Juventus", "🇮🇹", "JUV", [
      P("Gianluigi Buffon","GK","GK",90,"🇮🇹"),
      P("Stephan Lichtsteiner","RB","RM",83,"🇨🇭"),
      P("Andrea Barzagli","CB","CB",85,"🇮🇹"),
      P("Leonardo Bonucci","CB","CB",86,"🇮🇹"),
      P("Giorgio Chiellini","CB","LB",87,"🇮🇹"),
      P("Kwadwo Asamoah","LM","LWB",81,"🇬🇭"),
      P("Andrea Pirlo","CM","CDM",91,"🇮🇹"),
      P("Arturo Vidal","CM","CDM",89,"🇨🇱"),
      P("Claudio Marchisio","CM","CAM",85,"🇮🇹"),
      P("Paul Pogba","CM","CAM",84,"🇫🇷"),
      P("Mirko Vučinić","ST","CF",83,"🇲🇪"),
      P("Sebastian Giovinco","CAM","ST",80,"🇮🇹"),
      P("Fabio Quagliarella","ST","CF",81,"🇮🇹"),
    ]),
  ],

  2013: [
    // Manchester United 2013-14 didn't reach QF (Moyes era, eliminated by Bayern in QF actually).
    // Pick Manchester United 2013-14, eliminated by Bayern Munich in QF
    T("Manchester United", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MUN", [
      P("David De Gea","GK","GK",87,"🇪🇸"),
      P("Rafael","RB","RB",80,"🇧🇷"),
      P("Nemanja Vidić","CB","CB",85,"🇷🇸"),
      P("Rio Ferdinand","CB","CB",82,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Patrice Evra","LB","LWB",82,"🇫🇷"),
      P("Michael Carrick","CDM","CM",84,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Marouane Fellaini","CDM","CM",80,"🇧🇪"),
      P("Antonio Valencia","RW","RB",82,"🇪🇨"),
      P("Juan Mata","CAM","RW",84,"🇪🇸"),
      P("Wayne Rooney","ST","CAM",88,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Robin van Persie","ST","CF",87,"🇳🇱"),
      P("Danny Welbeck","ST","LW",80,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Adnan Januzaj","LW","CAM",78,"🇧🇪"),
    ]),
  ],

  2014: [
    // PSG 2014-15, eliminated by Barcelona in QF
    T("Paris Saint-Germain", "🇫🇷", "PSG", [
      P("Salvatore Sirigu","GK","GK",82,"🇮🇹"),
      P("Gregory van der Wiel","RB","RB",80,"🇳🇱"),
      P("Thiago Silva","CB","CB",90,"🇧🇷"),
      P("David Luiz","CB","CDM",85,"🇧🇷"),
      P("Maxwell","LB","LWB",83,"🇧🇷"),
      P("Marquinhos","CB","RB",83,"🇧🇷"),
      P("Marco Verratti","CM","CDM",85,"🇮🇹"),
      P("Thiago Motta","CDM","CM",83,"🇮🇹"),
      P("Yohan Cabaye","CM","CAM",82,"🇫🇷"),
      P("Blaise Matuidi","CM","CDM",85,"🇫🇷"),
      P("Edinson Cavani","ST","CF",87,"🇺🇾"),
      P("Zlatan Ibrahimović","ST","CF",91,"🇸🇪"),
      P("Ezequiel Lavezzi","LW","ST",82,"🇦🇷"),
      P("Javier Pastore","CAM","LW",83,"🇦🇷"),
    ]),
  ],

  2015: [
    // Barcelona 2015-16, eliminated by Atlético Madrid in QF
    T("Barcelona", "🇪🇸", "FCB", [
      P("Marc-André ter Stegen","GK","GK",87,"🇩🇪"),
      P("Dani Alves","RB","RM",87,"🇧🇷"),
      P("Gerard Piqué","CB","CB",90,"🇪🇸"),
      P("Javier Mascherano","CB","CDM",87,"🇦🇷"),
      P("Jordi Alba","LB","LWB",87,"🇪🇸"),
      P("Sergio Busquets","CDM","CM",90,"🇪🇸"),
      P("Andrés Iniesta","CM","CAM",90,"🇪🇸"),
      P("Ivan Rakitić","CM","CAM",86,"🇭🇷"),
      P("Lionel Messi","RW","CF",95,"🇦🇷"),
      P("Luis Suárez","ST","CF",93,"🇺🇾"),
      P("Neymar","LW","CF",91,"🇧🇷"),
      P("Arda Turan","CAM","RW",82,"🇹🇷"),
      P("Sergi Roberto","RB","CM",80,"🇪🇸"),
    ]),
  ],

  2016: [
    // Borussia Dortmund 2016-17, eliminated by Monaco in QF
    T("Borussia Dortmund", "🇩🇪", "BVB", [
      P("Roman Bürki","GK","GK",83,"🇨🇭"),
      P("Łukasz Piszczek","RB","RB",81,"🇵🇱"),
      P("Sokratis Papastathopoulos","CB","CB",83,"🇬🇷"),
      P("Marc Bartra","CB","CB",81,"🇪🇸"),
      P("Marcel Schmelzer","LB","LB",80,"🇩🇪"),
      P("Julian Weigl","CDM","CM",82,"🇩🇪"),
      P("Gonzalo Castro","CM","CAM",80,"🇩🇪"),
      P("Ousmane Dembélé","RW","LW",85,"🇫🇷"),
      P("Marco Reus","LW","CAM",86,"🇩🇪"),
      P("Mario Götze","CAM","CM",81,"🇩🇪"),
      P("Pierre-Emerick Aubameyang","ST","CF",90,"🇬🇦"),
      P("Christian Pulisic","RW","CAM",78,"🇺🇸"),
      P("André Schürrle","LW","ST",81,"🇩🇪"),
    ]),
  ],

  2017: [
    // Barcelona 2017-18, eliminated by Roma in QF (the comeback)
    T("Barcelona", "🇪🇸", "FCB", [
      P("Marc-André ter Stegen","GK","GK",88,"🇩🇪"),
      P("Sergi Roberto","RB","CM",82,"🇪🇸"),
      P("Gerard Piqué","CB","CB",89,"🇪🇸"),
      P("Samuel Umtiti","CB","CB",84,"🇫🇷"),
      P("Jordi Alba","LB","LWB",86,"🇪🇸"),
      P("Sergio Busquets","CDM","CM",89,"🇪🇸"),
      P("Ivan Rakitić","CM","CAM",85,"🇭🇷"),
      P("Andrés Iniesta","CM","CAM",87,"🇪🇸"),
      P("Philippe Coutinho","CAM","LW",85,"🇧🇷"),
      P("Lionel Messi","RW","CF",95,"🇦🇷"),
      P("Luis Suárez","ST","CF",90,"🇺🇾"),
      P("Ousmane Dembélé","RW","LW",82,"🇫🇷"),
      P("Paulinho","CM","CAM",82,"🇧🇷"),
    ]),
  ],

  2018: [
    // Manchester City 2018-19, eliminated by Tottenham in QF on away goals
    T("Manchester City", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MCI", [
      P("Ederson","GK","GK",88,"🇧🇷"),
      P("Kyle Walker","RB","RB",85,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Aymeric Laporte","CB","CB",87,"🇫🇷"),
      P("Vincent Kompany","CB","CB",83,"🇧🇪"),
      P("Benjamin Mendy","LB","LWB",82,"🇫🇷"),
      P("Fernandinho","CDM","CM",87,"🇧🇷"),
      P("Kevin De Bruyne","CAM","CM",92,"🇧🇪"),
      P("David Silva","CAM","LW",89,"🇪🇸"),
      P("Bernardo Silva","RW","CAM",88,"🇵🇹"),
      P("Raheem Sterling","LW","ST",89,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Sergio Agüero","ST","CF",91,"🇦🇷"),
      P("Leroy Sané","LW","RW",85,"🇩🇪"),
      P("Riyad Mahrez","RW","CAM",84,"🇩🇿"),
      P("İlkay Gündoğan","CM","CAM",84,"🇩🇪"),
    ]),
  ],

  2019: [
    // Atalanta 2019-20, eliminated by PSG in QF
    T("Atalanta", "🇮🇹", "ATA", [
      P("Pierluigi Gollini","GK","GK",81,"🇮🇹"),
      P("Rafael Tolói","CB","RB",82,"🇧🇷"),
      P("José Luis Palomino","CB","CB",80,"🇦🇷"),
      P("Berat Djimsiti","CB","CB",78,"🇦🇱"),
      P("Hans Hateboer","RB","RM",80,"🇳🇱"),
      P("Robin Gosens","LB","LM",82,"🇩🇪"),
      P("Marten de Roon","CDM","CM",81,"🇳🇱"),
      P("Remo Freuler","CM","CDM",81,"🇨🇭"),
      P("Alejandro Gómez","CAM","LW",86,"🇦🇷"),
      P("Josip Iličić","CAM","RW",85,"🇸🇮"),
      P("Duván Zapata","ST","CF",84,"🇨🇴"),
      P("Luis Muriel","ST","CF",82,"🇨🇴"),
      P("Ruslan Malinovskyi","CM","CAM",81,"🇺🇦"),
    ]),
  ],

  2020: [
    // Bayern Munich 2020-21, eliminated by PSG in QF on away goals
    T("Bayern Munich", "🇩🇪", "FCB", [
      P("Manuel Neuer","GK","GK",90,"🇩🇪"),
      P("Benjamin Pavard","RB","CB",83,"🇫🇷"),
      P("Jérôme Boateng","CB","CB",83,"🇩🇪"),
      P("David Alaba","CB","LB",87,"🇦🇹"),
      P("Lucas Hernández","CB","LB",84,"🇫🇷"),
      P("Alphonso Davies","LB","LWB",85,"🇨🇦"),
      P("Joshua Kimmich","CDM","RB",90,"🇩🇪"),
      P("Leon Goretzka","CM","CAM",86,"🇩🇪"),
      P("Thomas Müller","CAM","RW",88,"🇩🇪"),
      P("Kingsley Coman","LW","RW",85,"🇫🇷"),
      P("Serge Gnabry","RW","LW",86,"🇩🇪"),
      P("Robert Lewandowski","ST","CF",94,"🇵🇱"),
      P("Leroy Sané","LW","RW",84,"🇩🇪"),
      P("Corentin Tolisso","CM","CDM",82,"🇫🇷"),
    ]),
  ],

  2021: [
    // Bayern Munich 2021-22, eliminated by Villarreal in QF
    T("Bayern Munich", "🇩🇪", "FCB", [
      P("Manuel Neuer","GK","GK",89,"🇩🇪"),
      P("Benjamin Pavard","RB","CB",83,"🇫🇷"),
      P("Niklas Süle","CB","CB",83,"🇩🇪"),
      P("Dayot Upamecano","CB","CB",83,"🇫🇷"),
      P("Lucas Hernández","CB","LB",84,"🇫🇷"),
      P("Alphonso Davies","LB","LWB",84,"🇨🇦"),
      P("Joshua Kimmich","CDM","CM",90,"🇩🇪"),
      P("Leon Goretzka","CM","CAM",86,"🇩🇪"),
      P("Thomas Müller","CAM","RW",87,"🇩🇪"),
      P("Serge Gnabry","RW","LW",85,"🇩🇪"),
      P("Leroy Sané","LW","RW",85,"🇩🇪"),
      P("Kingsley Coman","LW","RW",84,"🇫🇷"),
      P("Robert Lewandowski","ST","CF",93,"🇵🇱"),
      P("Jamal Musiala","CAM","CM",84,"🇩🇪"),
    ]),
  ],

  2022: [
    // Napoli 2022-23, eliminated by AC Milan in QF
    T("Napoli", "🇮🇹", "NAP", [
      P("Alex Meret","GK","GK",83,"🇮🇹"),
      P("Giovanni Di Lorenzo","RB","RB",84,"🇮🇹"),
      P("Amir Rrahmani","CB","CB",82,"🇽🇰"),
      P("Kim Min-jae","CB","CB",86,"🇰🇷"),
      P("Mário Rui","LB","LWB",81,"🇵🇹"),
      P("Stanislav Lobotka","CDM","CM",85,"🇸🇰"),
      P("Frank Anguissa","CM","CDM",84,"🇨🇲"),
      P("Piotr Zieliński","CAM","CM",84,"🇵🇱"),
      P("Hirving Lozano","RW","LW",83,"🇲🇽"),
      P("Khvicha Kvaratskhelia","LW","CAM",88,"🇬🇪"),
      P("Victor Osimhen","ST","CF",89,"🇳🇬"),
      P("Matteo Politano","RW","RM",82,"🇮🇹"),
      P("Eljif Elmas","CAM","LW",80,"🇲🇰"),
      P("Giacomo Raspadori","ST","CF",80,"🇮🇹"),
    ]),
  ],

  2023: [
    // Manchester City 2023-24, eliminated by Real Madrid in QF on penalties
    T("Manchester City", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "MCI", [
      P("Ederson","GK","GK",88,"🇧🇷"),
      P("Kyle Walker","RB","CB",84,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Rúben Dias","CB","CB",89,"🇵🇹"),
      P("Manuel Akanji","CB","RB",84,"🇨🇭"),
      P("John Stones","CB","CDM",84,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Joško Gvardiol","LB","CB",84,"🇭🇷"),
      P("Rodri","CDM","CM",91,"🇪🇸"),
      P("Bernardo Silva","CAM","RW",88,"🇵🇹"),
      P("Kevin De Bruyne","CAM","CM",89,"🇧🇪"),
      P("Phil Foden","CAM","LW",88,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Julián Álvarez","ST","CAM",85,"🇦🇷"),
      P("Erling Haaland","ST","CF",91,"🇳🇴"),
      P("Jack Grealish","LW","CAM",84,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Jérémy Doku","LW","RW",82,"🇧🇪"),
    ]),
  ],

  2024: [
    // Real Madrid 2024-25, eliminated by Arsenal in QF
    T("Real Madrid", "🇪🇸", "RMA", [
      P("Thibaut Courtois","GK","GK",88,"🇧🇪"),
      P("Dani Carvajal","RB","RB",83,"🇪🇸"),
      P("Antonio Rüdiger","CB","CB",86,"🇩🇪"),
      P("Aurélien Tchouaméni","CB","CDM",85,"🇫🇷"),
      P("Ferland Mendy","LB","LB",82,"🇫🇷"),
      P("Eduardo Camavinga","CM","CDM",83,"🇫🇷"),
      P("Federico Valverde","CM","RM",88,"🇺🇾"),
      P("Jude Bellingham","CAM","CM",89,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Vinícius Júnior","LW","ST",91,"🇧🇷"),
      P("Rodrygo","RW","LW",86,"🇧🇷"),
      P("Kylian Mbappé","ST","LW",92,"🇫🇷"),
      P("Luka Modrić","CM","CAM",84,"🇭🇷"),
      P("Lucas Vázquez","RB","RM",80,"🇪🇸"),
      P("Raúl Asencio","CB","CB",78,"🇪🇸"),
    ]),
  ],

  2025: [
    // 2025-26 season is ongoing; Bayern Munich added as an iconic top-tier
    // squad placeholder until the season's QF teams are confirmed.
    T("Bayern Munich", "🇩🇪", "FCB", [
      P("Manuel Neuer","GK","GK",85,"🇩🇪"),
      P("Konrad Laimer","RB","CM",82,"🇦🇹"),
      P("Dayot Upamecano","CB","CB",84,"🇫🇷"),
      P("Jonathan Tah","CB","CB",84,"🇩🇪"),
      P("Josip Stanišić","LB","RB",80,"🇭🇷"),
      P("Joshua Kimmich","CDM","CM",88,"🇩🇪"),
      P("Aleksandar Pavlović","CM","CDM",80,"🇩🇪"),
      P("Jamal Musiala","CAM","LW",88,"🇩🇪"),
      P("Michael Olise","RW","CAM",85,"🇫🇷"),
      P("Serge Gnabry","RW","LW",83,"🇩🇪"),
      P("Luis Díaz","LW","ST",85,"🇨🇴"),
      P("Harry Kane","ST","CF",90,"🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      P("Leon Goretzka","CM","CAM",83,"🇩🇪"),
      P("Sacha Boey","RB","RB",78,"🇫🇷"),
    ]),
  ],
};
