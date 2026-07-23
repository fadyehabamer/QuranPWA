/* ==========================================================================
   Canonical surah reference data — the single source of truth.

   Replaces three hand-maintained copies that had drifted apart:
     - HOME_SURAH_NAMES  (js/page-scripts/index.js)
     - a name list       (js/page-scripts/bookmarks.js)
     - surahInfo + surahToJuz (js/page-scripts/quran.js + quran-data.js)

   Load this BEFORE common.js and any page script. Classic script (no module),
   so it exposes its data on window.* for every page to share.
   ========================================================================== */
(function () {
  "use strict";

  var SURAHS = [
  { number: 1, name: "الفاتحة", verses: 7, type: "مكية", juz: 1 },
  { number: 2, name: "البقرة", verses: 286, type: "مدنية", juz: 1 },
  { number: 3, name: "آل عمران", verses: 200, type: "مدنية", juz: 3 },
  { number: 4, name: "النساء", verses: 176, type: "مدنية", juz: 4 },
  { number: 5, name: "المائدة", verses: 120, type: "مدنية", juz: 6 },
  { number: 6, name: "الأنعام", verses: 165, type: "مكية", juz: 7 },
  { number: 7, name: "الأعراف", verses: 206, type: "مكية", juz: 8 },
  { number: 8, name: "الأنفال", verses: 75, type: "مدنية", juz: 9 },
  { number: 9, name: "التوبة", verses: 129, type: "مدنية", juz: 10 },
  { number: 10, name: "يونس", verses: 109, type: "مكية", juz: 11 },
  { number: 11, name: "هود", verses: 123, type: "مكية", juz: 11 },
  { number: 12, name: "يوسف", verses: 111, type: "مكية", juz: 12 },
  { number: 13, name: "الرعد", verses: 43, type: "مدنية", juz: 13 },
  { number: 14, name: "ابراهيم", verses: 52, type: "مكية", juz: 13 },
  { number: 15, name: "الحجر", verses: 99, type: "مكية", juz: 14 },
  { number: 16, name: "النحل", verses: 128, type: "مكية", juz: 14 },
  { number: 17, name: "الإسراء", verses: 111, type: "مكية", juz: 15 },
  { number: 18, name: "الكهف", verses: 110, type: "مكية", juz: 15 },
  { number: 19, name: "مريم", verses: 98, type: "مكية", juz: 16 },
  { number: 20, name: "طه", verses: 135, type: "مكية", juz: 16 },
  { number: 21, name: "الأنبياء", verses: 112, type: "مكية", juz: 17 },
  { number: 22, name: "الحج", verses: 78, type: "مدنية", juz: 17 },
  { number: 23, name: "المؤمنون", verses: 118, type: "مكية", juz: 18 },
  { number: 24, name: "النور", verses: 64, type: "مدنية", juz: 18 },
  { number: 25, name: "الفرقان", verses: 77, type: "مكية", juz: 18 },
  { number: 26, name: "الشعراء", verses: 227, type: "مكية", juz: 19 },
  { number: 27, name: "النمل", verses: 93, type: "مكية", juz: 19 },
  { number: 28, name: "القصص", verses: 88, type: "مكية", juz: 20 },
  { number: 29, name: "العنكبوت", verses: 69, type: "مكية", juz: 20 },
  { number: 30, name: "الروم", verses: 60, type: "مكية", juz: 21 },
  { number: 31, name: "لقمان", verses: 34, type: "مكية", juz: 21 },
  { number: 32, name: "السجدة", verses: 30, type: "مكية", juz: 21 },
  { number: 33, name: "الأحزاب", verses: 73, type: "مدنية", juz: 21 },
  { number: 34, name: "سبإ", verses: 54, type: "مكية", juz: 22 },
  { number: 35, name: "فاطر", verses: 45, type: "مكية", juz: 22 },
  { number: 36, name: "يس", verses: 83, type: "مكية", juz: 22 },
  { number: 37, name: "الصافات", verses: 182, type: "مكية", juz: 23 },
  { number: 38, name: "ص", verses: 88, type: "مكية", juz: 23 },
  { number: 39, name: "الزمر", verses: 75, type: "مكية", juz: 23 },
  { number: 40, name: "غافر", verses: 85, type: "مكية", juz: 24 },
  { number: 41, name: "فصلت", verses: 54, type: "مكية", juz: 24 },
  { number: 42, name: "الشورى", verses: 53, type: "مكية", juz: 25 },
  { number: 43, name: "الزخرف", verses: 89, type: "مكية", juz: 25 },
  { number: 44, name: "الدخان", verses: 59, type: "مكية", juz: 25 },
  { number: 45, name: "الجاثية", verses: 37, type: "مكية", juz: 25 },
  { number: 46, name: "الأحقاف", verses: 35, type: "مكية", juz: 26 },
  { number: 47, name: "محمد", verses: 38, type: "مدنية", juz: 26 },
  { number: 48, name: "الفتح", verses: 29, type: "مدنية", juz: 26 },
  { number: 49, name: "الحجرات", verses: 18, type: "مدنية", juz: 26 },
  { number: 50, name: "ق", verses: 45, type: "مكية", juz: 26 },
  { number: 51, name: "الذاريات", verses: 60, type: "مكية", juz: 26 },
  { number: 52, name: "الطور", verses: 49, type: "مكية", juz: 27 },
  { number: 53, name: "النجم", verses: 62, type: "مكية", juz: 27 },
  { number: 54, name: "القمر", verses: 55, type: "مكية", juz: 27 },
  { number: 55, name: "الرحمن", verses: 78, type: "مكية", juz: 27 },
  { number: 56, name: "الواقعة", verses: 96, type: "مكية", juz: 27 },
  { number: 57, name: "الحديد", verses: 29, type: "مدنية", juz: 27 },
  { number: 58, name: "المجادلة", verses: 22, type: "مدنية", juz: 28 },
  { number: 59, name: "الحشر", verses: 24, type: "مدنية", juz: 28 },
  { number: 60, name: "الممتحنة", verses: 13, type: "مدنية", juz: 28 },
  { number: 61, name: "الصف", verses: 14, type: "مدنية", juz: 28 },
  { number: 62, name: "الجمعة", verses: 11, type: "مدنية", juz: 28 },
  { number: 63, name: "المنافقون", verses: 11, type: "مدنية", juz: 28 },
  { number: 64, name: "التغابن", verses: 18, type: "مدنية", juz: 28 },
  { number: 65, name: "الطلاق", verses: 12, type: "مدنية", juz: 28 },
  { number: 66, name: "التحريم", verses: 12, type: "مدنية", juz: 28 },
  { number: 67, name: "الملك", verses: 30, type: "مكية", juz: 29 },
  { number: 68, name: "القلم", verses: 52, type: "مكية", juz: 29 },
  { number: 69, name: "الحاقة", verses: 52, type: "مكية", juz: 29 },
  { number: 70, name: "المعارج", verses: 44, type: "مكية", juz: 29 },
  { number: 71, name: "نوح", verses: 28, type: "مكية", juz: 29 },
  { number: 72, name: "الجن", verses: 28, type: "مكية", juz: 29 },
  { number: 73, name: "المزمل", verses: 20, type: "مكية", juz: 29 },
  { number: 74, name: "المدثر", verses: 56, type: "مكية", juz: 29 },
  { number: 75, name: "القيامة", verses: 40, type: "مكية", juz: 29 },
  { number: 76, name: "الانسان", verses: 31, type: "مدنية", juz: 29 },
  { number: 77, name: "المرسلات", verses: 50, type: "مكية", juz: 29 },
  { number: 78, name: "النبإ", verses: 40, type: "مكية", juz: 30 },
  { number: 79, name: "النازعات", verses: 46, type: "مكية", juz: 30 },
  { number: 80, name: "عبس", verses: 42, type: "مكية", juz: 30 },
  { number: 81, name: "التكوير", verses: 29, type: "مكية", juz: 30 },
  { number: 82, name: "الإنفطار", verses: 19, type: "مكية", juz: 30 },
  { number: 83, name: "المطففين", verses: 36, type: "مكية", juz: 30 },
  { number: 84, name: "الإنشقاق", verses: 25, type: "مكية", juz: 30 },
  { number: 85, name: "البروج", verses: 22, type: "مكية", juz: 30 },
  { number: 86, name: "الطارق", verses: 17, type: "مكية", juz: 30 },
  { number: 87, name: "الأعلى", verses: 19, type: "مكية", juz: 30 },
  { number: 88, name: "الغاشية", verses: 26, type: "مكية", juz: 30 },
  { number: 89, name: "الفجر", verses: 30, type: "مكية", juz: 30 },
  { number: 90, name: "البلد", verses: 20, type: "مكية", juz: 30 },
  { number: 91, name: "الشمس", verses: 15, type: "مكية", juz: 30 },
  { number: 92, name: "الليل", verses: 21, type: "مكية", juz: 30 },
  { number: 93, name: "الضحى", verses: 11, type: "مكية", juz: 30 },
  { number: 94, name: "الشرح", verses: 8, type: "مكية", juz: 30 },
  { number: 95, name: "التين", verses: 8, type: "مكية", juz: 30 },
  { number: 96, name: "العلق", verses: 19, type: "مكية", juz: 30 },
  { number: 97, name: "القدر", verses: 5, type: "مكية", juz: 30 },
  { number: 98, name: "البينة", verses: 8, type: "مدنية", juz: 30 },
  { number: 99, name: "الزلزلة", verses: 8, type: "مدنية", juz: 30 },
  { number: 100, name: "العاديات", verses: 11, type: "مكية", juz: 30 },
  { number: 101, name: "القارعة", verses: 11, type: "مكية", juz: 30 },
  { number: 102, name: "التكاثر", verses: 8, type: "مكية", juz: 30 },
  { number: 103, name: "العصر", verses: 3, type: "مكية", juz: 30 },
  { number: 104, name: "الهمزة", verses: 9, type: "مكية", juz: 30 },
  { number: 105, name: "الفيل", verses: 5, type: "مكية", juz: 30 },
  { number: 106, name: "قريش", verses: 4, type: "مكية", juz: 30 },
  { number: 107, name: "الماعون", verses: 7, type: "مكية", juz: 30 },
  { number: 108, name: "الكوثر", verses: 3, type: "مكية", juz: 30 },
  { number: 109, name: "الكافرون", verses: 6, type: "مكية", juz: 30 },
  { number: 110, name: "النصر", verses: 3, type: "مدنية", juz: 30 },
  { number: 111, name: "المسد", verses: 5, type: "مكية", juz: 30 },
  { number: 112, name: "الإخلاص", verses: 4, type: "مكية", juz: 30 },
  { number: 113, name: "الفلق", verses: 5, type: "مكية", juz: 30 },
  { number: 114, name: "الناس", verses: 6, type: "مكية", juz: 30 },
  ];

  var NAMES = SURAHS.map(function (s) { return s.name; });

  var TO_JUZ = {};
  SURAHS.forEach(function (s) { TO_JUZ[s.number] = s.juz; });

  function normalizeIndex(n) {
    var i = parseInt(n, 10);
    return Number.isFinite(i) ? i : 0;
  }

  window.QURAN_SURAHS = SURAHS;              // [{number,name,verses,type,juz}]
  window.QURAN_SURAH_NAMES = NAMES;          // ['الفاتحة', ...] (index 0 = surah 1)
  window.QURAN_SURAH_TO_JUZ = TO_JUZ;        // { 1: 1, 2: 1, ... }
  window.QURAN_TOTAL_SURAHS = SURAHS.length; // 114

  window.getSurahInfo = function (surahNumber) {
    return SURAHS[normalizeIndex(surahNumber) - 1] || null;
  };
  window.getSurahName = function (surahNumber) {
    var s = SURAHS[normalizeIndex(surahNumber) - 1];
    return s ? s.name : 'سورة';
  };
  window.getSurahJuz = function (surahNumber) {
    return TO_JUZ[normalizeIndex(surahNumber)] || null;
  };
})();
