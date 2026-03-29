# شرح Web Components في HTML بالمصري (ببساطة جدًا)

## يعني إيه Web Component؟
تخيل عندك "قطعة ليجو" بتكررها في كذا صفحة (زي النافبار أو الكارد).
بدل ما تنسخ نفس الـ HTML كل مرة، بتعملها مرة واحدة كـ Component، وبعد كده تستخدمها كأنها تاج HTML عادي.

يعني بدل 50 سطر كل مرة، تكتب سطر واحد بس:

```html
<app-sidebar current="home"></app-sidebar>
```

---

## ليه ده مفيد؟
- وفر وقت
- يقلل الأخطاء
- أي تعديل تعمله مرة واحدة يطبق في كل الصفحات
- الكود يبقى أنضف وأسهل في الصيانة

---

## الفكرة في 3 خطوات

## 1) تعمل Class جديدة

```js
class MyHello extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute('name') || 'يا بطل';
    this.innerHTML = `<p>أهلا ${name}</p>`;
  }
}
```

## 2) تسجلها باسم (لازم فيه -)

```js
customElements.define('my-hello', MyHello);
```

مهم جدًا: اسم الـ component لازم يكون فيه شرطة `-`.
صح: `my-hello`
غلط: `myhello`

## 3) تستخدمها في HTML

```html
<my-hello name="فادي"></my-hello>
```

بس كده. أول ما المتصفح يقرا التاج ده، هيشغل الكود ويحط المحتوى.

---

## مثال عملي شبه اللي عندك في المشروع

## في JavaScript (مثلا common.js)

```js
function buildSidebarMarkup(currentKey) {
  return `
    <aside class="desktop-sidebar">
      <nav>
        <a href="/" class="${currentKey === 'home' ? 'active' : ''}">الرئيسية</a>
        <a href="quran.html" class="${currentKey === 'quran' ? 'active' : ''}">القرآن</a>
      </nav>
    </aside>
  `;
}

class AppSidebar extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute('current') || 'home';
    this.innerHTML = buildSidebarMarkup(current);
  }
}

customElements.define('app-sidebar', AppSidebar);
```

## في HTML

```html
<app-sidebar current="quran"></app-sidebar>
```

يعني أنت كده عملت "قطعة جاهزة" للسايدبار.

---

## Shadow DOM (اختياري)
لو عايز CSS بتاع الـ component يكون معزول ومش يتلخبط مع باقي الصفحة، استخدم Shadow DOM:

```js
class FancyCard extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .card {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #ddd;
        }
      </style>
      <div class="card"><slot></slot></div>
    `;
  }
}

customElements.define('fancy-card', FancyCard);
```

الاستخدام:

```html
<fancy-card>محتوى الكارد</fancy-card>
```

---

## أشهر الأخطاء (خلي بالك)
- نسيت `customElements.define(...)`
- اسم التاج مفيهوش `-`
- ملف الـ JS مش متحمل (مافيش `<script src="..."></script>`)
- عرّفت نفس الاسم مرتين (هيطلع Error)

---

## Recipe سريعة جدًا (Copy/Paste)
1. اعمل ملف JS مشترك (زي `common.js`).
2. اكتب class extends `HTMLElement`.
3. حط شكل المكون جوه `connectedCallback()`.
4. سجل المكون بـ `customElements.define('name-with-dash', ClassName)`.
5. استخدمه في أي صفحة HTML كتاج عادي.

---

## الخلاصة
Web Components = "اكتب مرة، استخدم كتير".
لو عندك عناصر متكررة زي:
- Navbar
- Sidebar
- Bottom Nav
- Cards

يبقى دي أحسن طريقة بسيطة ونضيفة جدًا.
