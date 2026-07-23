/* ==========================================================================
   Per-page tour content.

   One file for every page so the copy lives together and stays consistent in
   tone. Each page registers only its own tour, picked by the document's
   filename, and AppTour skips any step whose target is not on screen.
   ========================================================================== */
(function () {
  "use strict";

  if (!window.AppTour) return;

  var page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';

  var TOURS = {
    index: {
      // The home tour doubles as first-run onboarding, so it opens with a
      // welcome card before pointing at anything.
      delay: 1400,
      steps: [
        {
          title: 'أهلاً بك',
          text: 'جولة سريعة في أهم ما تقدّمه الصفحة الرئيسية. يمكنك تخطّيها في أي وقت.'
        },
        {
          selector: '#homePrayerWidget',
          title: 'مواقيت الصلاة',
          text: 'الصلاة القادمة والوقت المتبقي لها بالثانية. اسمح بالوصول للموقع لتظهر مواقيت مدينتك بدقة.'
        },
        {
          selector: '#trackerRow',
          title: 'متابعة الصلوات',
          text: 'اضغط على أي صلاة لتسجيلها بعد أدائها، وتابع سلسلة أيامك في المحافظة على الصلوات الخمس.'
        },
        {
          selector: '.quick-grid',
          title: 'وصول سريع',
          text: 'متابعة القراءة من حيث توقفت، والأذكار، والمسبحة، وبقية الأقسام.'
        },
        {
          selector: '#dailyVerseCard',
          title: 'آية اليوم',
          text: 'آية مختارة كل يوم — احفظها لتجدها لاحقاً في صفحة العلامات المرجعية.'
        },
        {
          selector: 'app-bottom-nav',
          title: 'التنقل',
          text: 'شريط التنقل السفلي ينقلك بين الأقسام الرئيسية في أي وقت.'
        }
      ]
    },

    quran: {
      delay: 1200,
      steps: [
        {
          selector: '.quick-resume',
          title: 'متابعة القراءة',
          text: 'يعيدك إلى آخر سورة وصفحة توقفت عندها.'
        },
        {
          selector: '.quran-tabs',
          title: 'ثلاث طرق للتصفح',
          text: 'تصفّح المصحف بالسور، أو بالأجزاء الثلاثين، أو بصفحات المصحف الـ604.'
        },
        {
          selector: '#surahSearch',
          title: 'البحث',
          text: 'ابحث باسم السورة أو برقمها، أو اكتب جزءاً من نص الآية للبحث داخل المصحف كاملاً.'
        },
        {
          selector: '#surahList .surah-item',
          title: 'بطاقة السورة',
          text: 'يظهر لكل سورة نوعها (مكية أو مدنية) وعدد آياتها ورقم جزئها. اضغط لفتحها.'
        }
      ]
    },

    'prayer-times': {
      delay: 1600,
      steps: [
        {
          selector: '#locationSection',
          title: 'حدّد موقعك',
          text: 'تلقائياً عبر الجهاز، أو يدوياً باختيار دولتك — المواقيت تُحسب حسب الموقع.'
        },
        {
          selector: '#dayNav',
          title: 'تصفّح الأيام',
          text: 'انتقل لمواقيت الغد أو الأمس، مع التاريخ الهجري لكل يوم.'
        },
        {
          selector: '#prayerGrid',
          title: 'وقت كل صلاة',
          text: 'كل صلاة تُعرض كمدة تبدأ وتنتهي، مع تمييز الوقت الحالي، لا كلحظة واحدة.'
        },
        {
          selector: '#forbiddenSection',
          title: 'أوقات الكراهة',
          text: 'الأوقات الثلاثة التي تُكره فيها صلاة التطوع، وهي تقريبية لأنها مرتبطة بموضع الشمس.'
        },
        {
          selector: '#qiblaSection',
          title: 'اتجاه القبلة',
          text: 'بوصلة تشير إلى الكعبة. حرّك الهاتف بحركة شكل 8 لمعايرتها إن كانت غير مستقرة.'
        }
      ]
    },

    azkar: {
      delay: 900,
      steps: [
        {
          selector: '.azkar-search-bar',
          title: 'ابحث في الأذكار',
          text: 'اكتب أي كلمة للبحث في كل الأذكار مباشرة دون تصفّح المجموعات.'
        },
        {
          selector: '.azkar-group',
          title: 'مجموعات مرتّبة',
          text: 'الأذكار مصنّفة في مجموعات — اضغط على أي مجموعة لفتحها ومتابعة تقدّمك فيها.'
        }
      ]
    },

    settings: {
      delay: 700,
      steps: [
        {
          selector: '#themeModeLabel',
          title: 'المظهر',
          text: 'فاتح أو داكن دائماً، أو «تلقائي» ليتبع التطبيق إعداد جهازك.'
        },
        {
          selector: '#quranFontPicker',
          title: 'خط المصحف',
          text: 'اختر خط عرض الآيات داخل القارئ من بين عدة خطوط عربية.'
        },
        {
          selector: '#prayerMethodSelect',
          title: 'حساب المواقيت',
          text: 'اختر الهيئة التي تعتمدها لحساب الفجر والعشاء، ومذهب العصر.'
        },
        {
          selector: '#storageMeter',
          title: 'بياناتك',
          text: 'احفظ نسخة احتياطية من علاماتك وتقدّمك، أو استعدها على جهاز آخر.'
        }
      ]
    },

    masbaha: {
      delay: 700,
      steps: [
        {
          selector: '.masbaha-container',
          title: 'المسبحة',
          text: 'اضغط في أي مكان على الدائرة للتسبيح. يُحفظ العدد تلقائياً حتى لو أغلقت التطبيق.'
        }
      ]
    },

    bookmarks: {
      delay: 700,
      steps: [
        {
          selector: '#savedVersesSection',
          title: 'الآيات المحفوظة',
          text: 'كل آية حفظتها من «آية اليوم» تجدها هنا.'
        },
        {
          selector: '.bookmarks-container',
          title: 'علاماتك المرجعية',
          text: 'مواضع القراءة التي حفظتها من المصحف — اضغط أياً منها للعودة إليها مباشرة.'
        }
      ]
    },

    khatma: {
      delay: 700,
      steps: [
        {
          selector: '.khatma-page-container',
          title: 'الختمة',
          text: 'حدّد خطة ختمك وتابع تقدّمك اليومي حتى تختم المصحف.'
        }
      ]
    }
  };

  var tour = TOURS[page];
  if (!tour) return;

  // The onboarding wizard owns the screen on first run; auto-starting the home
  // tour underneath it would stack two overlays. The help button still mounts,
  // and the tour runs on the next visit.
  var onboardingPending = window.AppOnboarding && !window.AppOnboarding.isDone();

  window.AppTour.register(page, tour.steps, {
    delay: tour.delay,
    skipAutoStart: onboardingPending
  });
})();
