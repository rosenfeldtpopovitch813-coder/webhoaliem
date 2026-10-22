// Periodic-table fallback data (118 IUPAC elements). Detailed configurations and specimen
// images are enriched from public references at runtime when the user is online.
const RAW = `H|Hydrogen|1.008
He|Helium|4.0026
Li|Lithium|6.94
Be|Beryllium|9.0122
B|Boron|10.81
C|Carbon|12.011
N|Nitrogen|14.007
O|Oxygen|15.999
F|Fluorine|18.998
Ne|Neon|20.180
Na|Sodium|22.990
Mg|Magnesium|24.305
Al|Aluminium|26.982
Si|Silicon|28.085
P|Phosphorus|30.974
S|Sulfur|32.06
Cl|Chlorine|35.45
Ar|Argon|39.948
K|Potassium|39.098
Ca|Calcium|40.078
Sc|Scandium|44.956
Ti|Titanium|47.867
V|Vanadium|50.942
Cr|Chromium|51.996
Mn|Manganese|54.938
Fe|Iron|55.845
Co|Cobalt|58.933
Ni|Nickel|58.693
Cu|Copper|63.546
Zn|Zinc|65.38
Ga|Gallium|69.723
Ge|Germanium|72.630
As|Arsenic|74.922
Se|Selenium|78.971
Br|Bromine|79.904
Kr|Krypton|83.798
Rb|Rubidium|85.468
Sr|Strontium|87.62
Y|Yttrium|88.906
Zr|Zirconium|91.224
Nb|Niobium|92.906
Mo|Molybdenum|95.95
Tc|Technetium|98
Ru|Ruthenium|101.07
Rh|Rhodium|102.906
Pd|Palladium|106.42
Ag|Silver|107.868
Cd|Cadmium|112.414
In|Indium|114.818
Sn|Tin|118.710
Sb|Antimony|121.760
Te|Tellurium|127.60
I|Iodine|126.904
Xe|Xenon|131.293
Cs|Caesium|132.905
Ba|Barium|137.327
La|Lanthanum|138.905
Ce|Cerium|140.116
Pr|Praseodymium|140.908
Nd|Neodymium|144.242
Pm|Promethium|145
Sm|Samarium|150.36
Eu|Europium|151.964
Gd|Gadolinium|157.25
Tb|Terbium|158.925
Dy|Dysprosium|162.500
Ho|Holmium|164.930
Er|Erbium|167.259
Tm|Thulium|168.934
Yb|Ytterbium|173.045
Lu|Lutetium|174.967
Hf|Hafnium|178.49
Ta|Tantalum|180.948
W|Tungsten|183.84
Re|Rhenium|186.207
Os|Osmium|190.23
Ir|Iridium|192.217
Pt|Platinum|195.084
Au|Gold|196.967
Hg|Mercury|200.592
Tl|Thallium|204.38
Pb|Lead|207.2
Bi|Bismuth|208.980
Po|Polonium|209
At|Astatine|210
Rn|Radon|222
Fr|Francium|223
Ra|Radium|226
Ac|Actinium|227
Th|Thorium|232.038
Pa|Protactinium|231.036
U|Uranium|238.029
Np|Neptunium|237
Pu|Plutonium|244
Am|Americium|243
Cm|Curium|247
Bk|Berkelium|247
Cf|Californium|251
Es|Einsteinium|252
Fm|Fermium|257
Md|Mendelevium|258
No|Nobelium|259
Lr|Lawrencium|266
Rf|Rutherfordium|267
Db|Dubnium|268
Sg|Seaborgium|269
Bh|Bohrium|270
Hs|Hassium|277
Mt|Meitnerium|278
Ds|Darmstadtium|281
Rg|Roentgenium|282
Cn|Copernicium|285
Nh|Nihonium|286
Fl|Flerovium|289
Mc|Moscovium|290
Lv|Livermorium|293
Ts|Tennessine|294
Og|Oganesson|294`;
const ITEMS = RAW.split('\n').map((line, i) => {
  const [symbol, name, massText] = line.split('|');
  const z = i + 1, mass = Number(massText);
  let period, group, row, col;
  if (z === 1) { period = 1; group = 1; row = 1; col = 1; }
  else if (z === 2) { period = 1; group = 18; row = 1; col = 18; }
  else if (z <= 10) { period = 2; group = z <= 4 ? z - 2 : z + 8; row = period; col = group; }
  else if (z <= 18) { period = 3; group = z <= 12 ? z - 10 : z; row = period; col = group; }
  else if (z <= 36) { period = 4; group = z - 18; row = period; col = group; }
  else if (z <= 54) { period = 5; group = z - 36; row = period; col = group; }
  else if (z <= 86) {
    period = 6;
    if (z <= 57) group = z - 54;
    else if (z <= 71) group = 3 + z - 57; // f-block is displayed on a separate row below the main table.
    else group = z - 68;
    row = z >= 58 && z <= 71 ? 8 : period;
    col = row === 8 ? z - 54 : group;
  } else {
    period = 7;
    if (z <= 89) group = z - 86;
    else if (z <= 103) group = 3 + z - 89;
    else group = z - 100;
    row = z >= 90 && z <= 103 ? 9 : period;
    col = row === 9 ? z - 86 : group;
  }
  const metalloids = new Set(['B','Si','Ge','As','Sb','Te','Po']);
  const nonmetals = new Set(['H','C','N','O','P','S','Se']);
  const halogens = new Set(['F','Cl','Br','I','At','Ts']);
  const noble = new Set(['He','Ne','Ar','Kr','Xe','Rn','Og']);
  const category = z === 1 ? 'diatomic nonmetal' : noble.has(symbol) ? 'noble gas' : halogens.has(symbol) ? 'halogen' : metalloids.has(symbol) ? 'metalloid' : nonmetals.has(symbol) ? 'nonmetal' : z >= 57 && z <= 71 ? 'lanthanoid' : z >= 89 && z <= 103 ? 'actinoid' : group === 1 ? 'alkali metal' : group === 2 ? 'alkaline earth metal' : group >= 3 && group <= 12 ? 'transition metal' : z >= 113 || (z >= 81 && z <= 84) ? 'post-transition metal' : 'post-transition metal';
  const gas = new Set(['H','He','N','O','F','Ne','Cl','Ar','Kr','Xe','Rn']);
  const phase = symbol === 'Hg' || symbol === 'Br' ? 'Liquid' : gas.has(symbol) || symbol === 'Og' ? 'Gas' : 'Solid';
  return { z, symbol, name, mass, period, group, row, col, category, phase };
});

// Build a fallback shell-count diagram using the Aufbau orbital sequence. Runtime metadata
// replaces this with the source electron configuration whenever the data endpoint is available.
const ORBITALS = [[1,'s',2],[2,'s',2],[2,'p',6],[3,'s',2],[3,'p',6],[4,'s',2],[3,'d',10],[4,'p',6],[5,'s',2],[4,'d',10],[5,'p',6],[6,'s',2],[4,'f',14],[5,'d',10],[6,'p',6],[7,'s',2],[5,'f',14],[6,'d',10],[7,'p',6]];
const CONFIG_EXCEPTIONS = {24:[[4,'s',1],[3,'d',5]],29:[[4,'s',1],[3,'d',10]],41:[[5,'s',1],[4,'d',4]],42:[[5,'s',1],[4,'d',5]],44:[[5,'s',1],[4,'d',7]],45:[[5,'s',1],[4,'d',8]],46:[[5,'s',0],[4,'d',10]],47:[[5,'s',1],[4,'d',10]],57:[[6,'s',2],[5,'d',1]],58:[[6,'s',2],[4,'f',1],[5,'d',1]],64:[[6,'s',2],[4,'f',7],[5,'d',1]],78:[[6,'s',1],[5,'d',9]],79:[[6,'s',1],[5,'d',10]],89:[[7,'s',2],[6,'d',1]],90:[[7,'s',2],[6,'d',2]],91:[[7,'s',2],[5,'f',2],[6,'d',1]],92:[[7,'s',2],[5,'f',3],[6,'d',1]],93:[[7,'s',2],[5,'f',4],[6,'d',1]],96:[[7,'s',2],[5,'f',7],[6,'d',1]]};
export function estimateShells(z) {
  const occ = new Map(); let left = z;
  for (const [n, orb, cap] of ORBITALS) { const used = Math.min(left, cap); occ.set(`${n}${orb}`, used); left -= used; if (!left) break; }
  const shells = [];
  for (const [key, count] of occ) { const n = Number(key.match(/^\d/)[0]); shells[n-1] = (shells[n-1] || 0) + count; }
  return shells.filter(v => v !== undefined);
}
export function shellsFromConfiguration(configuration, fallbackZ) {
  if (typeof configuration !== 'string') return estimateShells(fallbackZ);
  const shells = [];
  for (const match of configuration.matchAll(/(\d+)[spdf](\d+)/g)) {
    const n = Number(match[1]), count = Number(match[2]);
    shells[n-1] = (shells[n-1] || 0) + count;
  }
  return shells.some(v => v !== undefined) ? shells.map(v => v || 0) : estimateShells(fallbackZ);
}
export const ELEMENTS = Object.freeze(ITEMS.map(e => Object.freeze([
  e.z, e.symbol, e.name, e.mass, `Lớp e: ${estimateShells(e.z).join(' – ')}`, e.period, e.group, e.category, e.phase, e.row, e.col
])));
export const IR_BANDS=Object.freeze([
['O–H (alcohol)','3200–3600','Rộng, biến thiên do liên kết hydrogen'],['O–H (carboxylic acid)','2500–3300','Rất rộng, thường đi kèm C=O'],['N–H','3300–3500','Thường sắc hơn O–H'],['C–H sp³','2850–2960','Liên kết C–H no'],['C–H sp²','3000–3100','Liên kết C–H không no'],['C≡N','2210–2260','Dải mạnh, tương đối sắc'],['C≡C','2100–2260','Có thể yếu hoặc không quan sát được'],['C=O (ketone)','~1715','Có thể thay đổi do liên hợp'],['C=O (ester)','1735–1750','Phụ thuộc cấu trúc'],['C=O (carboxylic acid)','~1710','Đi kèm O–H rất rộng'],['C=C','1620–1680','Cường độ thay đổi'],['C–O','1000–1300','Nhiều môi trường hóa học']
]);

let metadataPromise;
export function loadPeriodicMetadata() {
  if (!metadataPromise) metadataPromise = fetch('https://staticdata.dev/v1/periodic-table.json', { headers: { Accept: 'application/json' } })
    .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then(rows => new Map(rows.filter(row => Number.isInteger(row.number)).map(row => [row.number, row])))
    .catch(() => new Map());
  return metadataPromise;
}
let imageSourcePromise;
function loadImageSource() {
  if (!imageSourcePromise) imageSourcePromise = fetch('https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json', { headers: { Accept: 'application/json' } }).then(response => { if (!response.ok) throw new Error('Image data unavailable'); return response.json(); }).then(data => data.elements || []).catch(() => []);
  return imageSourcePromise;
}
export async function loadElementImage(name) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replaceAll(' ', '_'))}`;
  const wikiPage = `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}`;
  try {
    const sourceRows = await loadImageSource();
    const match = sourceRows.find(row => row.name?.toLowerCase() === name.toLowerCase());
    if (match?.image?.url) return { image: match.image.url, description: match.appearance || match.image.title || '', page: match.source || wikiPage, title: match.image.title || name, attribution: match.image.attribution || '' };
  } catch { /* Use the article-summary API as a fallback. */ }
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Không tải được ảnh (${response.status})`);
  const data = await response.json();
  return { image: data.thumbnail?.source || data.originalimage?.source || '', description: data.description || data.extract || '', page: data.content_urls?.desktop?.page || wikiPage, title: data.title || name, attribution: '' };
}
export const ELEMENT_RECORDS = Object.freeze(ITEMS.map(e => Object.freeze({ ...e })));
