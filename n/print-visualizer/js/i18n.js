// Interface text in English and Russian. English is the default; the choice is remembered on this device.
// To add a string: add the same key to both `en` and `ru`. {name} placeholders are filled by t(key, { name }).
// Plural strings are arrays: en [one, other], ru [one, few, many].

const DICT = {
  en: {
    'meta.title': 'Print Visualizer · UV-printed tiles, glass, glass blocks, cabinet doors and metal in your room',
    'meta.description': 'Try UV-printed tile backsplashes, glass art, backlit panels, cabinet doors, metal panels and glass blocks in your own room: upload a photo, place prints, change size and light, then view them on your wall in AR.',
    'brand.sub': 'UV-printed tiles, glass, glass blocks, cabinet doors and metal, in your room',
    'lang.label': 'Language',
    'theme.toDark': 'Switch to dark theme',
    'theme.toLight': 'Switch to light theme',
    'btn.save': 'Save image',
    'btn.saveShort': 'Save',
    'btn.ar': 'View on my wall',
    'btn.arShort': 'AR',

    'stage.col': 'Room preview',
    'stage.aria': 'Room preview. Select a print, drag to move it, use arrow keys to nudge.',
    'stage.loading': 'Loading room…',
    'stage.layers': 'Prints in this room',
    'stage.hint': 'Drag a print to move it. Pull its corners to line it up with the wall.',
    'corner.0': 'Top-left', 'corner.1': 'Top-right', 'corner.2': 'Bottom-right', 'corner.3': 'Bottom-left',
    'corner.aria': '{name} corner. Drag, or use arrow keys to line it up with the wall.',
    'chip.add': 'Add print',
    'panel': 'Settings',

    'room.h': 'Room',
    'room.upload': 'Use a photo of your room',
    'room.uploadSub': 'Take one on your phone or upload. Stays on your device.',
    'room.custom': 'Your photo',

    'light.h': 'Lighting',
    'light.aria': 'Time of day',
    'light.day': 'Day', 'light.evening': 'Evening', 'light.night': 'Night',
    'light.brightness': 'Brightness',
    'light.warmth': 'Cool · Warm',

    'product.h': 'Product',
    'type.tile': 'Tile backsplash',
    'type.glass': 'Glass art',
    'type.backlit': 'Backlit glass',
    'type.cabinet': 'Cabinet doors',
    'type.metal': 'Metal panel',
    'type.glassblock': 'Glass blocks',
    'product.tile': 'UV-printed tile backsplash',
    'product.glass': 'UV-printed glass art',
    'product.backlit': 'Backlit printed glass (LED)',
    'product.cabinet': 'UV-printed cabinet doors',
    'product.metal': 'UV-printed metal panel',
    'product.glassblock': 'UV-printed glass block partition',
    'note.tile': 'Printed ceramic tiles with grout lines, as one image or a repeating pattern.',
    'note.glass': 'Tempered glass printed on the back, mounted on stand-off pins.',
    'note.backlit': 'Printed glass with an LED panel behind it. It glows in the evening.',
    'note.cabinet': 'One image printed across all the doors. The gaps cut it, just like on real cabinets.',
    'note.metal': 'Printed on brushed metal. Without a white underbase the metal shines through the light parts.',
    'note.glassblock': 'Printed on the face of each glass block. One image runs across the whole partition, and the mortar joints divide it.',
    'block.size': 'Block size',
    'block.mortar': 'Mortar',
    'block.mortarColour': 'Mortar color',
    'block.glass': 'Glass',
    'glass.wave': 'Wave',
    'glass.frosted': 'Frosted',

    'design.h': 'Design',
    'design.upload': 'Upload your own artwork',
    'design.uploadSub': 'Photo, logo or pattern, JPG or PNG',
    'design.yours': 'Your artwork',
    'design.marble': 'Calacatta Marble',
    'design.terrazzo': 'Terrazzo Warm',
    'design.moroccan': 'Moroccan Star',
    'design.citrus': 'Citrus Grove',
    'design.coast': 'Coastal Sunset',
    'design.aurora': 'Aurora Flow',
    'design.botanical': 'Botanical Leaves',
    'design.ink': 'Indigo Ink',

    'size.h': 'Size & fit',
    'size.width': 'Width',
    'size.height': 'Height',
    'unit.in': 'in',
    'unit.sqft': 'sq ft',
    'sum.areaCut': '{a} sq ft inside the outline',
    'stage.hintShape': 'Drag the points along the wall. Tap + on an edge to add a point, double-tap a point to remove it.',
    'size.lock': 'Keep proportions',
    'size.scale': 'Scale on wall',
    'tile.size': 'Tile size',
    'tile.opt': '{n} × {n} in',
    'tile.sheet': 'One glass sheet (no grout)',
    'tile.grout': 'Grout',
    'tile.groutColour': 'Grout color',
    'tile.layout': 'Layout',
    'layout.mural': 'One image',
    'layout.repeat': 'Pattern',
    'finish': 'Finish',
    'finish.gloss': 'Gloss',
    'finish.matte': 'Matte',
    'finish.gloss.lc': 'gloss',
    'finish.matte.lc': 'matte',
    'cab.doors': 'Doors across',
    'cab.fewer': 'Fewer doors',
    'cab.more': 'More doors',
    'cab.gap': 'Gap',
    'cab.handles': 'Handles',
    'handle.none': 'None',
    'handle.bar': 'Bar',
    'handle.knob': 'Knob',
    'metal.base': 'Metal',
    'metal.aluminium': 'Aluminum',
    'metal.steel': 'Steel',
    'metal.brass': 'Brass',
    'metal.underbase': 'White underbase',
    'metal.underNote': 'Off: light parts of the design let the metal shine through. On: colors print solid.',
    'led.on': 'LED light on',
    'led.colour': 'Light color',
    'led.glow': 'Glow',
    'clip': 'Cut the print to the outline',
    'shape.edit': 'Edit outline',
    'shape.reset': 'Reset outline',
    'shape.note': 'For walls with steps or breaks, like a taller area at the stove: drag the points, tap + on an edge to add one, double-tap a point to remove it.',
    'shape.point': 'Outline point {n}. Drag or use arrow keys; Delete removes it.',
    'shape.add': 'Add a point on this edge',
    'shape.min': 'An outline needs at least 3 points.',
    'move.group': 'Move selected print',
    'move.left': 'Move left', 'move.up': 'Move up', 'move.down': 'Move down', 'move.right': 'Move right',
    'move.square': 'Square up',
    'move.remove': 'Remove',
    'empty': 'No prints in this room yet. Tap <strong>Add print</strong> under the photo.',

    'sum.h': 'Your selection',
    'sum.none': 'Nothing selected yet.',
    'sum.copy': 'Copy list for a quote',
    'sum.copied': 'Copied. Paste it into the quote form or an email.',
    'sum.head': 'My print selection:',
    'sum.tiles': ['{n} tile {s}×{s} in', '{n} tiles {s}×{s} in'],
    'sum.doors': ['{n} door', '{n} doors'],
    'sum.gap': '{g} gaps',
    'sum.handle.none': 'no handles (push to open)',
    'sum.handle.bar': 'bar handles',
    'sum.handle.knob': 'knobs',
    'sum.metal.aluminium': 'brushed aluminum',
    'sum.metal.steel': 'brushed stainless steel',
    'sum.metal.brass': 'brushed brass',
    'sum.underbase': 'white underbase',
    'sum.noUnderbase': 'no white underbase, metal shows through',
    'sum.led': 'LED backlight',
    'sum.standoff': 'stand-off mount',
    'sum.blocks': ['{n} block {s}×{s} in', '{n} blocks {s}×{s} in'],
    'sum.glass.wave': 'wave glass',
    'sum.glass.frosted': 'frosted glass',

    'err.room': 'That room photo could not load. Please try again.',
    'err.photo': 'This photo format could not be opened here. Please use a JPG or PNG.',
    'err.art': 'This image could not be opened here. Please use a JPG or PNG.',

    'ar.title': 'View on your wall',
    'ar.close': 'Close',
    'ar.addFirst': 'Add a print first, then view it on your wall.',
    'ar.size': '{w} × {h} in, shown at real size.',
    'ar.howDefault': 'On a phone, tap <strong>AR</strong> in the corner of the preview, point the camera at a wall and the print appears at its real size. Walk closer or step back to judge it.',
    'ar.checking': 'Checking whether this phone supports AR…',
    'ar.desktop': 'AR works on phones: scan the code with your phone, then tap <strong>AR · place on wall</strong> and point the camera at a wall. The print appears at its real size.',
    'ar.can': 'Tap <strong>AR · place on wall</strong>, point the camera at a wall and the print appears at its real size. Walk closer or step back to judge it.',
    'ar.cannot': 'AR is not available in this browser. Open this page in Chrome on Android or Safari on iPhone to place the print on your wall. You can still turn the 3D preview with your finger.',
    'ar.preparing': 'Preparing 3D preview…',
    'ar.failed': '3D preview could not load. Check your connection and try again.',
    'ar.button': 'AR · place on wall',
    'ar.alt': '{design} print, {w} by {h} inches',
    'ar.qrAlt': 'QR code that opens this visualizer on your phone',
    'ar.qr': 'On a computer? Scan with your phone to open this same print in AR.',
    'ar.qrUpload': 'On a computer? Scan to open the visualizer on your phone. Your uploaded artwork stays on this computer, so upload it there too.',
  },

  ru: {
    'meta.title': 'Print Visualizer · УФ-печать на плитке, стекле, стеклоблоках, фасадах и металле в твоей комнате',
    'meta.description': 'Примерь УФ-печать на плитке, стекле, стеклоблоках, фасадах шкафов и металле в своей комнате: загрузи фото, поставь печать, поменяй размер и свет, а потом посмотри на стене в AR.',
    'brand.sub': 'УФ-печать на плитке, стекле, стеклоблоках, фасадах и металле прямо в твоей комнате',
    'lang.label': 'Язык',
    'theme.toDark': 'Включить тёмную тему',
    'theme.toLight': 'Включить светлую тему',
    'btn.save': 'Сохранить фото',
    'btn.saveShort': 'Фото',
    'btn.ar': 'Примерить на стене',
    'btn.arShort': 'AR',

    'stage.col': 'Примерка',
    'stage.aria': 'Комната с примеркой. Выбери печать и перетащи её, стрелками можно сдвигать точнее.',
    'stage.loading': 'Загружаю комнату…',
    'stage.layers': 'Печать в этой комнате',
    'stage.hint': 'Перетащи печать, чтобы сдвинуть. Тяни за углы, чтобы выровнять её по стене.',
    'corner.0': 'Левый верхний', 'corner.1': 'Правый верхний', 'corner.2': 'Правый нижний', 'corner.3': 'Левый нижний',
    'corner.aria': '{name} угол. Тяни или двигай стрелками, чтобы выровнять по стене.',
    'chip.add': 'Добавить печать',
    'panel': 'Настройки',

    'room.h': 'Комната',
    'room.upload': 'Загрузи фото своей комнаты',
    'room.uploadSub': 'Сними на телефон или выбери файл. Фото остаётся на твоём устройстве.',
    'room.custom': 'Твоё фото',

    'light.h': 'Свет',
    'light.aria': 'Время суток',
    'light.day': 'День', 'light.evening': 'Вечер', 'light.night': 'Ночь',
    'light.brightness': 'Яркость',
    'light.warmth': 'Холод · Тепло',

    'product.h': 'Изделие',
    'type.tile': 'Фартук из плитки',
    'type.glass': 'Картина на стекле',
    'type.backlit': 'Стекло с подсветкой',
    'type.cabinet': 'Фасады шкафов',
    'type.metal': 'Панель из металла',
    'type.glassblock': 'Стеклоблоки',
    'product.tile': 'Фартук из плитки с УФ-печатью',
    'product.glass': 'Картина на стекле с УФ-печатью',
    'product.backlit': 'Стекло с печатью и LED-подсветкой',
    'product.cabinet': 'Фасады шкафов с УФ-печатью',
    'product.metal': 'Металлическая панель с УФ-печатью',
    'product.glassblock': 'Перегородка из стеклоблоков с УФ-печатью',
    'note.tile': 'Керамическая плитка с печатью и швами: одна картина на всю стену или повторяющийся узор.',
    'note.glass': 'Закалённое стекло, запечатанное с обратной стороны, висит на дистанционных держателях.',
    'note.backlit': 'Стекло с печатью и LED-панелью сзади. Вечером светится.',
    'note.cabinet': 'Одна картина через все дверцы. Зазоры режут её, как на настоящих шкафах.',
    'note.metal': 'Печать на шлифованном металле. Без белой подложки металл блестит в светлых местах рисунка.',
    'note.glassblock': 'Печать на лицевой стороне каждого стеклоблока. Одна картина на всю перегородку, швы раствора делят её на блоки.',
    'block.size': 'Размер блока',
    'block.mortar': 'Раствор',
    'block.mortarColour': 'Цвет раствора',
    'block.glass': 'Стекло',
    'glass.wave': 'Волна',
    'glass.frosted': 'Матовое',

    'design.h': 'Рисунок',
    'design.upload': 'Загрузи свой рисунок',
    'design.uploadSub': 'Фото, логотип или узор, JPG или PNG',
    'design.yours': 'Твой рисунок',
    'design.marble': 'Мрамор калакатта',
    'design.terrazzo': 'Тёплое терраццо',
    'design.moroccan': 'Марокканская звезда',
    'design.citrus': 'Цитрусовый сад',
    'design.coast': 'Закат у моря',
    'design.aurora': 'Северное сияние',
    'design.botanical': 'Листья',
    'design.ink': 'Индиго',

    'size.h': 'Размер и место',
    'size.width': 'Ширина',
    'size.height': 'Высота',
    'unit.in': 'дюйм.',
    'unit.sqft': 'кв. фут.',
    'sum.areaCut': '{a} кв. фут. внутри контура',
    'stage.hintShape': 'Тяни точки по краю стены. Нажми + на краю, чтобы добавить точку; двойное касание убирает точку.',
    'size.lock': 'Сохранять пропорции',
    'size.scale': 'Масштаб на стене',
    'tile.size': 'Размер плитки',
    'tile.opt': '{n} × {n} дюйм.',
    'tile.sheet': 'Цельный лист стекла, без швов',
    'tile.grout': 'Затирка',
    'tile.groutColour': 'Цвет затирки',
    'tile.layout': 'Раскладка',
    'layout.mural': 'Одна картина',
    'layout.repeat': 'Узор',
    'finish': 'Поверхность',
    'finish.gloss': 'Глянец',
    'finish.matte': 'Мат',
    'finish.gloss.lc': 'глянец',
    'finish.matte.lc': 'мат',
    'cab.doors': 'Дверец в ряд',
    'cab.fewer': 'Меньше дверец',
    'cab.more': 'Больше дверец',
    'cab.gap': 'Зазор',
    'cab.handles': 'Ручки',
    'handle.none': 'Нет',
    'handle.bar': 'Планка',
    'handle.knob': 'Кнопка',
    'metal.base': 'Металл',
    'metal.aluminium': 'Алюминий',
    'metal.steel': 'Сталь',
    'metal.brass': 'Латунь',
    'metal.underbase': 'Белая подложка',
    'metal.underNote': 'Без подложки светлые места рисунка показывают металл. С подложкой цвета плотные.',
    'led.on': 'Подсветка включена',
    'led.colour': 'Цвет света',
    'led.glow': 'Свечение',
    'clip': 'Обрезать печать по контуру',
    'shape.edit': 'Править контур',
    'shape.reset': 'Сбросить контур',
    'shape.note': 'Для стен со ступеньками и выступами, например выше у плиты: тяни точки, нажми + на краю, чтобы добавить точку, двойное касание по точке её удаляет.',
    'shape.point': 'Точка контура {n}. Тяни или двигай стрелками; Delete удаляет её.',
    'shape.add': 'Добавить точку на этом крае',
    'shape.min': 'В контуре должно быть не меньше 3 точек.',
    'move.group': 'Сдвинуть выбранную печать',
    'move.left': 'Влево', 'move.up': 'Вверх', 'move.down': 'Вниз', 'move.right': 'Вправо',
    'move.square': 'Выпрямить',
    'move.remove': 'Убрать',
    'empty': 'В этой комнате пока нет печати. Нажми <strong>Добавить печать</strong> под фото.',

    'sum.h': 'Твой выбор',
    'sum.none': 'Пока ничего не выбрано.',
    'sum.copy': 'Скопировать список для расчёта',
    'sum.copied': 'Скопировано. Вставь в форму заказа или в письмо.',
    'sum.head': 'Моя печать:',
    'sum.tiles': ['{n} плитка {s}×{s} дюйм.', '{n} плитки {s}×{s} дюйм.', '{n} плиток {s}×{s} дюйм.'],
    'sum.doors': ['{n} дверца', '{n} дверцы', '{n} дверец'],
    'sum.gap': 'зазор {g}',
    'sum.handle.none': 'без ручек, открываются нажатием',
    'sum.handle.bar': 'ручки-планки',
    'sum.handle.knob': 'ручки-кнопки',
    'sum.metal.aluminium': 'шлифованный алюминий',
    'sum.metal.steel': 'шлифованная нержавеющая сталь',
    'sum.metal.brass': 'шлифованная латунь',
    'sum.underbase': 'с белой подложкой',
    'sum.noUnderbase': 'без белой подложки, металл просвечивает',
    'sum.led': 'LED-подсветка',
    'sum.standoff': 'на дистанционных держателях',
    'sum.blocks': ['{n} блок {s}×{s} дюйм.', '{n} блока {s}×{s} дюйм.', '{n} блоков {s}×{s} дюйм.'],
    'sum.glass.wave': 'стекло «волна»',
    'sum.glass.frosted': 'матовое стекло',

    'err.room': 'Фото комнаты не загрузилось. Попробуй ещё раз.',
    'err.photo': 'Этот формат фото здесь не открывается. Возьми JPG или PNG.',
    'err.art': 'Эту картинку не получилось открыть. Возьми JPG или PNG.',

    'ar.title': 'Примерка на стене',
    'ar.close': 'Закрыть',
    'ar.addFirst': 'Сначала добавь печать, потом примерь её на стене.',
    'ar.size': '{w} × {h} дюйм., в настоящем размере.',
    'ar.howDefault': 'На телефоне нажми <strong>AR</strong> в углу просмотра и наведи камеру на стену: печать появится в настоящем размере. Подойди ближе или отойди, чтобы оценить.',
    'ar.checking': 'Проверяю, есть ли на этом телефоне AR…',
    'ar.desktop': 'AR работает на телефоне: отсканируй код, нажми <strong>AR · на стену</strong> и наведи камеру на стену. Печать появится в настоящем размере.',
    'ar.can': 'Нажми <strong>AR · на стену</strong> и наведи камеру на стену: печать появится в настоящем размере. Подойди ближе или отойди, чтобы оценить.',
    'ar.cannot': 'В этом браузере AR не работает. Открой страницу в Chrome на Android или в Safari на iPhone. А 3D-модель можно покрутить пальцем и здесь.',
    'ar.preparing': 'Готовлю 3D-модель…',
    'ar.failed': '3D-модель не загрузилась. Проверь интернет и попробуй ещё раз.',
    'ar.button': 'AR · на стену',
    'ar.alt': 'Печать «{design}», {w} на {h} дюйм.',
    'ar.qrAlt': 'QR-код, который откроет визуализатор на телефоне',
    'ar.qr': 'Сидишь за компьютером? Отсканируй код телефоном, и эта же печать откроется в AR.',
    'ar.qrUpload': 'Сидишь за компьютером? Отсканируй код, и визуализатор откроется на телефоне. Твой рисунок остался на этом компьютере, загрузи его и там.',
  },
};

export const LANGS = ['en', 'ru'];
const KEY = 'pv-lang';
let lang = 'en';

export function getLang() { return lang; }

export function has(key) { return key in DICT[lang] || key in DICT.en; }

function fill(s, vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s;
}

export function t(key, vars) {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key;
  return fill(Array.isArray(s) ? s[s.length - 1] : s, vars);
}

// Plural form for n: English one/other, Russian one/few/many.
export function plural(key, n, vars = {}) {
  const forms = DICT[lang][key] ?? DICT.en[key];
  let i;
  if (lang === 'ru') {
    const m10 = n % 10, m100 = n % 100;
    i = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
  } else i = n === 1 ? 0 : 1;
  return fill(forms[Math.min(i, forms.length - 1)], { n, ...vars });
}

// A name that may be a plain string or { en, ru } (room scenes use this).
export function localName(name) {
  if (!name || typeof name === 'string') return name || '';
  return name[lang] || name.en || '';
}

// Start-up language: a link's #…&lang=ru wins, then the saved choice, then English.
export function initLang() {
  const fromLink = location.hash.match(/[#&]lang=(en|ru)\b/);
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
  lang = fromLink ? fromLink[1] : LANGS.includes(saved) ? saved : 'en';
  return lang;
}

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
}

// Fill every element marked in the HTML: data-i18n (text), data-i18n-html (trusted markup from this file),
// data-i18n-aria (aria-label), data-i18n-alt (alt).
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.setAttribute('alt', t(el.dataset.i18nAlt)); });
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
}
