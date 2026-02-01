const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CAP_SOURCES_DIR = path.join(__dirname, '..', 'cap-sources');
const OUTPUT_FILE = path.join(__dirname, '..', 'cap', 'cap-data.json');

// Dönem kodu -> Akademik yıl (202510 -> 2024-2025)
function donemToAkademikYil(kod) {
  const yil = parseInt(kod.substring(0, 4));
  return `${yil - 1}-${yil}`;
}

// Dosya adından dönem kodunu çıkart
function extractDonemKod(filename) {
  const match = filename.match(/(\d{6})/);
  return match ? match[1] : null;
}

// GPA değerini parse et
function parseGPA(text) {
  if (!text) return null;
  const cleaned = text.toString().trim();
  if (cleaned === '--' || cleaned === '-' || cleaned === '') return null;
  const num = parseFloat(cleaned.replace(',', '.'));
  return isNaN(num) ? null : num;
}

// Sayıyı parse et
function parseNumber(text) {
  if (!text) return 0;
  const cleaned = text.toString().trim();
  if (cleaned === '--' || cleaned === '-' || cleaned === '') return 0;
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

// Program adını normalize et
function normalizeProgram(name) {
  if (!name) return null;
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(KKTC\)/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
}

// Modern format parser (2025-2026 - cap-taban-tavan-202610.php)
function parseModernFormat($) {
  const data = {};
  let currentFakulte = null;

  $('table tr').each((i, row) => {
    const tds = $(row).find('td');

    // Başlık satırını atla
    if ($(row).attr('style')?.includes('font-weight:bold') && tds.length > 1) {
      return;
    }

    // Fakülte başlığı (colspan içeren satır)
    if (tds.length === 1) {
      const text = $(tds[0]).text().trim();
      const boldText = $(tds[0]).find('b').text().trim();
      if (boldText) {
        currentFakulte = boldText;
      } else if (text && !text.includes('Yarıyıl') && !text.includes('Program')) {
        currentFakulte = text;
      }
      return;
    }

    // Veri satırı (7 kolon: Program, Yarıyıl, Kontenjan, Yerleşen, Tavan, Taban, Açıklama)
    if (tds.length >= 6) {
      const program = normalizeProgram($(tds[0]).text());
      const yariyil = $(tds[1]).text().trim();
      const kontenjan = parseNumber($(tds[2]).text());
      const yerlesen = parseNumber($(tds[3]).text());
      const tavan = parseGPA($(tds[4]).text());
      const taban = parseGPA($(tds[5]).text());
      const aciklama = tds.length > 6 ? $(tds[6]).text().trim() || null : null;

      if (!program || !yariyil || yariyil.includes('Yarıyıl') === false) return;

      // Yarıyıl normalizasyonu
      const normalizedYariyil = yariyil.includes('3') ? '3.Yarıyıl' : '5.Yarıyıl';

      if (!data[program]) {
        data[program] = { fakulte: currentFakulte, yariyillar: {} };
      }

      // Aynı program için farklı açıklamalar olabilir (özel kontenjanlar)
      const key = aciklama ? `${normalizedYariyil}_${aciklama}` : normalizedYariyil;
      data[program].yariyillar[key] = {
        yariyil: normalizedYariyil,
        kontenjan,
        yerlesen,
        tavan,
        taban,
        aciklama
      };
    }
  });

  return data;
}

// Eski/Yeni format parser (2011-2024)
function parseOldNewFormat($) {
  const data = {};
  let currentFakulte = null;

  $('table tr, TABLE TR').each((i, row) => {
    const tds = $(row).find('td, TD');

    // Başlık satırlarını atla
    if ($(row).attr('style')?.includes('font-weight:bold') ||
        $(row).find('b').length > 0 && tds.length <= 2) {
      // Fakülte başlığı kontrolü
      if (tds.length === 1) {
        const boldText = $(tds[0]).find('b, B').text().trim();
        if (boldText) {
          currentFakulte = boldText;
        }
      }
      return;
    }

    // Fakülte başlığı (colspan içeren satır)
    if (tds.length === 1) {
      const text = $(tds[0]).text().trim();
      const boldText = $(tds[0]).find('b, B').text().trim();
      if (boldText) {
        currentFakulte = boldText;
      } else if (text && !text.includes('Yarıyıl') && !text.includes('Program') && !text.includes('Bölüm')) {
        currentFakulte = text;
      }
      return;
    }

    // Veri satırı (7 kolon: Program, 3YY Yerleşen, Tavan, Taban, 5YY Yerleşen, Tavan, Taban)
    if (tds.length === 7) {
      const firstCell = $(tds[0]).text().trim();

      // Başlık satırını kontrol et
      if (firstCell.includes('Program') || firstCell.includes('Bölüm') ||
          firstCell.includes('YY') || firstCell.includes('Yerleşen')) {
        return;
      }

      const program = normalizeProgram(firstCell);
      if (!program) return;

      const yerlesen3 = parseNumber($(tds[1]).text());
      const tavan3 = parseGPA($(tds[2]).text());
      const taban3 = parseGPA($(tds[3]).text());
      const yerlesen5 = parseNumber($(tds[4]).text());
      const tavan5 = parseGPA($(tds[5]).text());
      const taban5 = parseGPA($(tds[6]).text());

      data[program] = {
        fakulte: currentFakulte,
        yariyillar: {
          '3.Yarıyıl': {
            yariyil: '3.Yarıyıl',
            kontenjan: null,
            yerlesen: yerlesen3,
            tavan: tavan3,
            taban: taban3,
            aciklama: null
          },
          '5.Yarıyıl': {
            yariyil: '5.Yarıyıl',
            kontenjan: null,
            yerlesen: yerlesen5,
            tavan: tavan5,
            taban: taban5,
            aciklama: null
          }
        }
      };
    }
  });

  return data;
}

// Format tespiti
function detectFormat(filename) {
  if (filename.endsWith('.php')) return 'modern';
  return 'old'; // Hem eski hem yeni format aynı parser'ı kullanıyor
}

// Verileri birleştir
function mergeData(result, parsedData, akademikYil) {
  for (const [program, info] of Object.entries(parsedData)) {
    if (!result.programlar[program]) {
      result.programlar[program] = {
        fakulte: info.fakulte,
        istatistikler: {}
      };
    }

    // Fakülte bilgisini güncelle (en güncel olanı kullan)
    if (info.fakulte) {
      result.programlar[program].fakulte = info.fakulte;
    }

    // İstatistikleri ekle
    if (!result.programlar[program].istatistikler[akademikYil]) {
      result.programlar[program].istatistikler[akademikYil] = {};
    }

    for (const [key, stats] of Object.entries(info.yariyillar)) {
      // Açıklama varsa ayrı tut, yoksa yarıyıl bazında
      const yariyil = stats.yariyil || key;

      if (stats.aciklama) {
        // Özel kontenjan - aciklama ile birlikte sakla
        if (!result.programlar[program].istatistikler[akademikYil][yariyil]) {
          result.programlar[program].istatistikler[akademikYil][yariyil] = [];
        }
        if (!Array.isArray(result.programlar[program].istatistikler[akademikYil][yariyil])) {
          const existing = result.programlar[program].istatistikler[akademikYil][yariyil];
          result.programlar[program].istatistikler[akademikYil][yariyil] = [existing];
        }
        result.programlar[program].istatistikler[akademikYil][yariyil].push({
          kontenjan: stats.kontenjan,
          yerlesen: stats.yerlesen,
          tavan: stats.tavan,
          taban: stats.taban,
          aciklama: stats.aciklama
        });
      } else {
        result.programlar[program].istatistikler[akademikYil][yariyil] = {
          kontenjan: stats.kontenjan,
          yerlesen: stats.yerlesen,
          tavan: stats.tavan,
          taban: stats.taban
        };
      }
    }
  }
}

// Ana fonksiyon
async function parseAllFiles() {
  console.log('CAP verileri parse ediliyor...\n');

  const files = fs.readdirSync(CAP_SOURCES_DIR)
    .filter(f => f.endsWith('.htm') || f.endsWith('.php'))
    .sort((a, b) => {
      // Dönem koduna göre sırala (yeniden eskiye)
      const kodA = extractDonemKod(a) || '0';
      const kodB = extractDonemKod(b) || '0';
      return kodB.localeCompare(kodA);
    });

  const result = {
    programlar: {},
    meta: {
      donemler: [],
      guncelleme_tarihi: new Date().toISOString().split('T')[0],
      veri_kaynaklari: {}
    }
  };

  for (const file of files) {
    const filepath = path.join(CAP_SOURCES_DIR, file);

    // Encoding'i tespit et ve oku
    let html;
    try {
      html = fs.readFileSync(filepath, 'utf-8');
      // windows-1254 encoding kontrolü
      if (html.includes('charset=windows-1254') || html.includes('charset=Windows-1254')) {
        // Node.js'de iconv-lite kullanılabilir, şimdilik UTF-8 varsayalım
        // Türkçe karakterler zaten okunuyor
      }
    } catch (e) {
      console.error(`Dosya okunamadı: ${file}`, e);
      continue;
    }

    const $ = cheerio.load(html, { decodeEntities: false });

    const donemKod = extractDonemKod(file);
    if (!donemKod) {
      console.warn(`Dönem kodu bulunamadı: ${file}`);
      continue;
    }

    const akademikYil = donemToAkademikYil(donemKod);
    const format = detectFormat(file);

    console.log(`Parse ediliyor: ${file} (${akademikYil}, format: ${format})`);

    let parsedData;
    try {
      if (format === 'modern') {
        parsedData = parseModernFormat($);
      } else {
        parsedData = parseOldNewFormat($);
      }
    } catch (e) {
      console.error(`Parse hatası: ${file}`, e);
      continue;
    }

    const programCount = Object.keys(parsedData).length;
    console.log(`  -> ${programCount} program bulundu`);

    // Verileri birleştir
    mergeData(result, parsedData, akademikYil);

    // Meta bilgileri güncelle
    if (!result.meta.donemler.includes(akademikYil)) {
      result.meta.donemler.push(akademikYil);
    }
    result.meta.veri_kaynaklari[akademikYil] = file;
  }

  // Dönemleri sırala (yeniden eskiye)
  result.meta.donemler.sort((a, b) => b.localeCompare(a));

  // Çıktı dizinini oluştur
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON'u kaydet
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n✓ CAP verileri kaydedildi: ${OUTPUT_FILE}`);
  console.log(`  Toplam ${Object.keys(result.programlar).length} program`);
  console.log(`  ${result.meta.donemler.length} dönem: ${result.meta.donemler[0]} - ${result.meta.donemler[result.meta.donemler.length - 1]}`);
}

parseAllFiles().catch(console.error);
