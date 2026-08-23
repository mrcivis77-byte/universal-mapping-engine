// Yucat\u00e1n Fishing \u2014 default species guide (rebuilt with user catch photos).
// Tap a Guide card for details; "Add fish" stores new species in PocketBase.
window.GUIDE_DATA = [
  {
    "id": "snook",
    "common": "Common Snook",
    "local": "Robalo",
    "sci": "Centropomus undecimalis",
    "where": "Estuary ecosystems: mangrove roots, deep holes and dock pilings of Ria Progreso and Ria Lagartos; inshore surf and piers.",
    "bait": "Live: shrimp, finger mullet, sardines. Artificial: paddle-tail jigs, jerkbaits, silver spoons.",
    "photo": "images/snook.jpg",
    "attribution": "User photo"
  },
  {
    "id": "tarpon",
    "common": "Baby Tarpon",
    "local": "Sabalo",
    "sci": "Megalops atlanticus",
    "where": "Shallow lagoons and mangrove channels, especially at dawn; roll on the surface in warm months.",
    "bait": "Live finger mullet or pilchards; artificial: small paddle-tails, soft plastic mullet, fly deceivers.",
    "photo": "images/tarpon.jpg",
    "attribution": "User photo"
  },
  {
    "id": "bonefish",
    "common": "Bonefish",
    "local": "Macabi",
    "sci": "Albula vulpes",
    "where": "Skinny flats and sandy potholes around Progreso and Telchac; tailing at high tide.",
    "bait": "Small shrimp or crab pieces; artificial: gotcha-style flies, tiny jigged shrimp.",
    "photo": "images/bonefish.png",
    "attribution": "User photo"
  },
  {
    "id": "seatrout",
    "common": "Spotted Seatrout",
    "local": "Corvina",
    "sci": "Cynoscion nebulosus",
    "where": "Shallow grassy flats and channels over seagrass; early morning topwater bites.",
    "bait": "Live shrimp under a cork; artificial: soft plastics on 1/4 oz jig heads, small topwater plugs.",
    "photo": "images/seatrout.jpg",
    "attribution": "User photo"
  },
  {
    "id": "mangrove-snapper",
    "common": "Mangrove Snapper",
    "local": "Pargo",
    "sci": "Lutjanus griseus",
    "where": "Around bridge pilings, rock jetties and nearshore reef structure.",
    "bait": "Small live shrimp or sardine chunks; artificial: small jigs tipped with shrimp.",
    "photo": "images/fish-placeholder.svg",
    "attribution": "User photo"
  },
  {
    "id": "red-grouper",
    "common": "Red Grouper",
    "local": "Mero rojo",
    "sci": "Epinephelus morio",
    "where": "Bottom structure and hard-bottom reefs a few miles offshore.",
    "bait": "Cut bait (sardine, bonito strips), live pinfish; bottom rigs near structure.",
    "photo": "images/grouper.jpg",
    "attribution": "User photo"
  },
  {
    "id": "black-grouper",
    "common": "Black Grouper",
    "local": "Mero negro",
    "sci": "Mycteroperca bonaci",
    "where": "Deep reefs, wrecks and rocky bottom offshore. \\u26a0\\ufe0f Veda/closed season: Feb 1 - Mar 31.",
    "bait": "Live pinfish/cabalito, large sardine strips; heavy bottom gear near structure.",
    "photo": "images/grouper-user.jpg",
    "attribution": "User photo"
  },
  {
    "id": "king",
    "common": "King Mackerel",
    "local": "Carito",
    "sci": "Scomberomorus cavalla",
    "where": "A few miles offshore over wrecks and along current edges; fast runs and jumps.",
    "bait": "Trolled spoons, dusters with strip bait, live blue runners; slow-troll live menhaden.",
    "photo": "images/king.jpg",
    "attribution": "User photo"
  },
  {
    "id": "barracuda",
    "common": "Great Barracuda",
    "local": "Barracuda",
    "sci": "Sphyraena barracuda",
    "where": "Around reefs, wrecks and channel markers; curious, follows lures to the boat.",
    "bait": "Tubed needlefish lures, wire leaders a must; live sardines or strip bait.",
    "photo": "images/barracuda.jpg",
    "attribution": "User photo"
  },
  {
    "id": "jack",
    "common": "Jack Crevalle",
    "local": "Toro",
    "sci": "Caranx hippos",
    "where": "Busting bait schools in the surf and channels; hardest fighter per pound in the area.",
    "bait": "Anything fast and loud: metal jigs, topwater poppers, live mullet.",
    "photo": "images/jack-crevalle.jpg",
    "attribution": "User photo"
  },
  {
    "id": "pompano",
    "common": "Pompano",
    "local": "Pampano",
    "sci": "Trachinotus carolinus",
    "where": "Sandy surf beaches and passes over clean bottom; spring and fall runs.",
    "bait": "Sand fleas (mole crabs), shrimp; artificial: small banana jigs tipped with shrimp.",
    "photo": "images/pompano.jpg",
    "attribution": "User photo"
  },
  {
    "id": "red-snapper",
    "common": "Red Snapper",
    "local": "Huachinango",
    "sci": "Lutjanus campechanus",
    "where": "Deep reefs and offshore bottom structure 10+ miles out.",
    "bait": "Cut sardine/squid on bottom rigs, live bait over wrecks; watch federal season dates.",
    "photo": "images/red-snapper.jpg",
    "attribution": "User photo"
  },
  {
    "id": "lobster",
    "common": "Spiny Lobster",
    "local": "Langosta",
    "sci": "Panulirus argus",
    "where": "Reefs, rock ledges and lobster casitas; season Aug - Feb (see veda).",
    "bait": "By hand or snare while freediving (license required); no traps without permit.",
    "photo": "images/lobster.jpg",
    "attribution": "User photo"
  },
  {
    "id": "shark",
    "common": "Reef Shark",
    "local": "Tiburon",
    "sci": "Carcharhinus spp.",
    "where": "Offshore deeper water; mostly released protected species.",
    "bait": "Catch & release only for most species; heavy tackle, wire trace, release quickly.",
    "photo": "images/shark.jpg",
    "attribution": "User photo"
  },
  {
    "id": "octopus",
    "common": "Octopus",
    "local": "Pulpo",
    "sci": "Octopus vulgaris",
    "where": "Rock patches and shallow reefs; traditionally hunted at night by light (Dec - Jul season). \\u26a0\\ufe0f Veda/closed season: Dec 16 - Jul 31.",
    "bait": "Octopus pots/jig (raab) by hand from a skiff; license required.",
    "photo": "images/octopus.jpg",
    "attribution": "User photo"
  },
  {
    "id": "catfish",
    "common": "Cenote Catfish",
    "local": "Bagre de cenote",
    "sci": "Rhamdia spp.",
    "where": "Freshwater cenotes and connected brackish lagoons inland.",
    "bait": "Dough balls, worms, small fish chunks fished on bottom.",
    "photo": "images/fish-placeholder.svg",
    "attribution": "User photo"
  }
];
