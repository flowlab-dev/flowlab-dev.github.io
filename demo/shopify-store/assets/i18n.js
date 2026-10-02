// MONO: language (EN / RU) and theme (light / dark). The early choice is made in <head> so nothing flashes;
// this file swaps the texts and wires the two switches. app.js reads window.MONO for its own strings.
(function () {
  const D = {
    en: {
      demo: 'Demo store<span class="long"> by Flow Lab</span> · Shopify mock data<span class="long"> from <a href="https://mock.shop" rel="noopener">mock.shop</a> · nothing is sold here</span>',
      collections: 'Collections', men: 'Men', women: 'Women', shoes: 'Shoes', accessories: 'Accessories', featured: 'Featured',
      cart: 'Cart', cart_sr: ' items, open cart', lang_group: 'Language', theme: 'Dark theme',
      title_home: 'MONO · demo store (Shopify mock data)', title_product: 'Product · MONO demo store', title_suffix: 'MONO demo store',
      hero_aria: 'New season', eyebrow: 'New season', h1: 'Everyday basics, built to layer.',
      hero_p: 'Hoodies, crewnecks and sneakers from the Shopify demo catalog.', shop_btn: 'Shop the collection',
      speed: 'Poster first (30 KB) · video loads after the page',
      hero_alt: 'Model in a grey hoodie and joggers holding a black duffel bag',
      shop: 'Shop', filter: 'Filter by collection', why: 'Why this page stays fast on a phone',
      how1_b: 'The poster is the first thing you see', how1: 'A 30 KB WebP frame paints the hero, so the page is readable before any video arrives.',
      how2_b: 'Video waits its turn', how2: 'The 290 KB clip loads after the page, and not at all with Data Saver, a slow connection or reduced motion.',
      how3_b: "Images sized by Shopify's CDN", how3: 'Each product photo is requested at the width the screen needs, and the cart talks to the Storefront API directly.',
      footer: 'MONO is a demo built by Flow Lab with Claude Code. Products, prices and checkout are Shopify mock data.',
      cart_title: 'Your cart', close_cart: 'Close cart', subtotal: 'Subtotal', demo_checkout: 'Demo checkout on Shopify mock data. Nothing is charged.', checkout: 'Checkout',
      back: '← All products', loading: 'Loading…', add: 'Add to cart', adding: 'Adding…', en_note: '', tr_note: '',
      no_products: 'No products in this collection.', catalog_fail: "The demo catalog didn't load. Please refresh the page.",
      product_fail: "This product didn't load. Please refresh.", not_found: 'Product not found',
      stock_na: "This combination isn't available.", in_stock: 'In stock · demo only, nothing ships', sold_out: 'Sold out in this combination.',
      add_fail: "Couldn't add to cart. Try again.", cart_fail: "Couldn't update the cart.", cart_empty: 'Your cart is empty.',
      dec: 'Decrease quantity', inc: 'Increase quantity'
    },
    ru: {
      demo: 'Демо-магазин<span class="long"> от Flow Lab</span> · демо-данные Shopify<span class="long"> с <a href="https://mock.shop" rel="noopener">mock.shop</a>, тексты товаров перевели мы · здесь ничего не продаётся</span>',
      collections: 'Коллекции', men: 'Мужское', women: 'Женское', shoes: 'Обувь', accessories: 'Аксессуары', featured: 'Подборка',
      cart: 'Корзина', cart_sr: ' шт., открыть корзину', lang_group: 'Язык', theme: 'Тёмная тема',
      title_home: 'MONO · демо-магазин (демо-данные Shopify)', title_product: 'Товар · демо-магазин MONO', title_suffix: 'демо-магазин MONO',
      hero_aria: 'Новый сезон', eyebrow: 'Новый сезон', h1: 'Базовые вещи на\u00a0каждый день. Носите слоями.',
      hero_p: 'Худи, свитшоты и кроссовки из демо-каталога Shopify.', shop_btn: 'Смотреть коллекцию',
      speed: 'Сначала заставка (30 КБ), видео загрузится после загрузки страницы',
      hero_alt: 'Модель в сером худи и джоггерах с чёрной спортивной сумкой',
      shop: 'Каталог', filter: 'Фильтр по коллекциям', why: 'Почему эта страница быстро открывается на телефоне',
      how1_b: 'Первым вы видите кадр-заставку', how1: 'Кадр WebP весом 30 КБ сразу рисует первый экран, и страницу можно читать ещё до того, как придёт видео.',
      how2_b: 'Видео ждёт своей очереди', how2: 'Ролик весом 290 КБ загружается после загрузки страницы, а при экономии трафика, медленной сети или включённом «Уменьшении движения» не грузится вовсе.',
      how3_b: 'Картинки нужного размера с CDN Shopify', how3: 'Каждое фото товара приходит ровно той ширины, которая нужна экрану, а корзина работает напрямую через Storefront API.',
      footer: 'MONO — демо, которое Flow Lab сделала с помощью Claude Code. Товары, цены и оформление заказа взяты из демо-данных Shopify.',
      cart_title: 'Ваша корзина', close_cart: 'Закрыть корзину', subtotal: 'Итого', demo_checkout: 'Оформление заказа на демо-данных Shopify. Деньги не списываются.', checkout: 'Оформить заказ',
      back: '← Все товары', loading: 'Загрузка…', add: 'В корзину', adding: 'Добавляем…',
      en_note: 'Название и описание товара взяты из демо-каталога Shopify, поэтому они на английском.',
      tr_note: 'Название и описание товара мы перевели: в демо-каталоге Shopify они на английском.',
      no_products: 'В этой коллекции нет товаров.', catalog_fail: 'Демо-каталог не загрузился. Обновите страницу.',
      product_fail: 'Товар не загрузился. Обновите страницу.', not_found: 'Товар не найден',
      stock_na: 'Такого сочетания нет.', in_stock: 'В наличии · это демо, заказ не отправляется', sold_out: 'В этом сочетании товар закончился.',
      add_fail: 'Не получилось добавить в корзину. Попробуйте ещё раз.', cart_fail: 'Не получилось обновить корзину.', cart_empty: 'Корзина пуста.',
      dec: 'Уменьшить количество', inc: 'Увеличить количество'
    }
  };
  // Option names and values come from the Shopify catalog in English; the radio values stay English, only the labels change.
  const RU_WORDS = {
    size: 'Размер', color: 'Цвет', colour: 'Цвет', material: 'Материал', style: 'Фасон',
    green: 'Зелёный', olive: 'Оливковый', ocean: 'Морской', purple: 'Фиолетовый', red: 'Красный', black: 'Чёрный', white: 'Белый',
    gray: 'Серый', grey: 'Серый', navy: 'Тёмно-синий', blue: 'Синий', beige: 'Бежевый', brown: 'Коричневый',
    'x-small': 'XS', small: 'S', medium: 'M', large: 'L', 'x-large': 'XL', 'xx-large': 'XXL'
  };

  // Product texts of the mock.shop demo catalog are English. RU shows our translation by product handle;
  // a product missing here stays in English and the page says so (en_note).
  const RU_PRODUCTS = {
    'men-t-shirt': ['Мужская футболка', 'Классическая футболка из органического хлопка: свободный крой, круглый вырез, вид, который не устаревает. 100% органический хлопок, мягкий и дышащий.'],
    'women-t-shirt': ['Женская футболка', 'Классическая футболка из органического хлопка: свободный крой, круглый вырез, вид, который не устаревает. 100% органический хлопок, мягкий и дышащий.'],
    'men-crewneck': ['Мужской свитшот', 'Качественный свитшот на каждый день. Из 100% хлопка: мягкий, удобный и стильный. Длинный рукав и классический крой легко сочетаются с чем угодно, такой свитшот пригодится в любом гардеробе.'],
    'women-crewneck': ['Женский свитшот', 'Качественный свитшот на каждый день. Из 100% хлопка: мягкий, удобный и стильный. Длинный рукав и классический крой легко сочетаются с чем угодно, такой свитшот пригодится в любом гардеробе.'],
    'hoodie-old': ['Худи', 'Удобное и тёплое худи из 100% хлопка. Внутри мягкий пушистый флис, размеры унисекс. Лёгкое и мягкое, оно станет любимым в прохладные дни.'],
    'sweatpants': ['Спортивные брюки', 'Мягкие удобные спортивные брюки стильных оттенков. Уютная эластичная ткань греет ровно настолько, насколько нужно: в них приятно отдыхать дома.'],
    'shorts': ['Шорты', 'Шорты для тренировок на пределе возможностей. Прочный нейлон в нескольких оттенках: служат долго и очень удобны.'],
    'workout-shirt': ['Спортивная майка', 'Майка для тренировок из качественного нейлона, удобная и прочная. Сетчатая ткань дышит и не даёт перегреться, а антистатическая и антибактериальная обработка сохраняет её лёгкой и мягкой после множества стирок. Лёгкая, с регулируемыми бретелями, не сползает даже на самой тяжёлой тренировке.'],
    'leggings': ['Леггинсы', 'Лёгкие спортивные леггинсы, в которых свободно двигаться. Ткань отводит влагу, прочные швы держат форму, поэтому прохладно и надёжно. Много цветов, чтобы и на тренировке выглядеть стильно.'],
    'black-sunnies': ['Чёрные солнцезащитные очки', 'Современные чёрные очки с зеркальными линзами и защитой UV400: задерживают 100% вредного ультрафиолета. Лёгкие и удобно сидят, а классический вид не выходит из моды.'],
    'clear-sunnies': ['Очки в прозрачной оправе', 'Современные солнцезащитные очки в прозрачной оправе, с зеркальными линзами и защитой UV400: задерживают 100% вредного ультрафиолета. Лёгкие и удобно сидят, а классический вид не выходит из моды.'],
    'high-top-sneakers': ['Высокие кеды', 'Стильные и прочные высокие кеды на каждый день. Мягкая пенная подошва и усиленный задник дают удобство и защиту стопы.'],
    'white-leather-sneakers': ['Белые кожаные кроссовки', ''],
    'canvas-sneakers': ['Кеды из канваса', 'Качественные кеды из плотного хлопка (канваса): удобно сидят и хорошо пропускают воздух, мягкая промежуточная подошва смягчает шаг. Прочные, в нескольких стильных цветах, на каждый день.'],
    'gray-leather-sneakers': ['Серые кожаные кроссовки', 'Серые кожаные кроссовки для делового образа, удобные и стильные. Кожа дышит и мягко облегает ногу: подходят для офиса и официальных случаев. Ручная работа, служат долго.'],
    'gray-runners': ['Серые беговые кроссовки', 'Серые кроссовки для тех, кто любит бегать. Хорошо дышат и удобно сидят, поэтому можно бежать дольше и меньше уставать. Лёгкий сетчатый верх, прочная конструкция и поддержка, нужная для хорошего результата.'],
    'slides': ['Шлёпанцы', 'Простые, лаконичные и удобные шлёпанцы классического вида в оттенке «железо». Дома или по делам в городе, в них удобно весь день.'],
    'frontpack': ['Нагрудная сумка', 'Нагрудная сумка, в которой продуманы и вид, и польза: современный спортивный дизайн и запатентованная конструкция, чтобы носить с собой много вещей. Лёгкая и удобная, регулируемые ремни подходят под любую фигуру. Водоотталкивающий верх сохранит вещи сухими.']
  };

  const root = document.documentElement;
  const lang = () => (root.lang === 'ru' ? 'ru' : 'en');
  const t = (k) => (D[lang()][k] ?? D.en[k] ?? k);
  const word = (w) => (lang() === 'ru' && RU_WORDS[String(w).toLowerCase()]) || w;
  const variant = (title) => String(title).split(' / ').map(word).join(' / ');
  const locale = () => (lang() === 'ru' ? 'ru-RU' : 'en-US');
  // { title, description, translated } of a catalog product in the current language.
  const product = (handle, p) => {
    const r = lang() === 'ru' && RU_PRODUCTS[handle];
    return r ? { title: r[0], description: r[1], translated: true } : { title: p.title, description: p.description, translated: false };
  };

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => { const [a, k] = pair.split(':'); el.setAttribute(a, t(k)); });
    });
    const tk = document.body.dataset.pageTitle;
    if (tk) document.title = t(tk);
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang())));
    paintTheme();
    root.classList.add('i18n-ready');
  }

  function isDark() {
    return root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function paintTheme() {
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(isDark())));
  }

  function setLang(l) {
    if (l === lang()) return;
    root.lang = l;
    try { localStorage.setItem('mono-lang', l); } catch (e) {}
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.set('lang', l); history.replaceState(null, '', u); }
    apply();
    document.dispatchEvent(new CustomEvent('langchange'));
  }

  function toggleTheme() {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('mono-theme', root.dataset.theme); } catch (e) {}
    paintTheme();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang],[data-theme-toggle]');
    if (!b) return;
    if (b.dataset.lang) setLang(b.dataset.lang); else toggleTheme();
  });

  window.MONO = { t, word, variant, locale, lang, product };
  apply();
})();
