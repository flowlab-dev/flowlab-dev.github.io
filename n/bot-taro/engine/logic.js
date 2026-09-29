// Логика демо-бота таролога/астролога: «Карта дня» → запись → оплата → напоминания.
// Чистые функции без сети и без файлов: один и тот же код работает в Telegram (bot/run.js)
// и в демо-странице (demo/index.html). Данные вымышленные. Языки: ru, en (CONFIG / CONFIG_EN).

export const CONFIG = {
  lang: 'ru',
  title: 'Таро и астрология · демо',
  timezone: 'МСК',
  currency: 'RUB',
  services: [
    { id: 'taro', title: 'Расклад Таро на ситуацию', minutes: 60, price: 3000 },
    { id: 'natal', title: 'Разбор натальной карты', minutes: 90, price: 6000 },
    { id: 'year', title: 'Прогноз на год', minutes: 60, price: 5000 },
  ],
  slots: ['11:00', '13:00', '15:00', '18:00'],
  daysAhead: 5,
  dayOff: 0, // воскресенье
  reminders: [{ key: 'day', minutes: 24 * 60 }, { key: 'hour', minutes: 60 }],
};

export const CONFIG_EN = {
  ...CONFIG,
  lang: 'en',
  title: 'Tarot & Astrology · demo',
  timezone: 'ET',
  currency: 'USD',
  services: [
    { id: 'taro', title: 'Tarot reading', minutes: 60, price: 45 },
    { id: 'natal', title: 'Birth chart reading', minutes: 90, price: 90 },
    { id: 'year', title: 'Year-ahead forecast', minutes: 60, price: 75 },
  ],
  slots: ['10:00', '12:00', '15:00', '18:00'],
};

const CARD_RU = [
  ['0', 'Шут', 'День для нового начала. Не ждите идеального момента — сделайте первый шаг.'],
  ['I', 'Маг', 'У вас есть всё, чтобы начать. Скажите вслух, чего хотите, — так проще действовать.'],
  ['II', 'Жрица', 'Прислушайтесь к интуиции. Ответ уже есть, его просто не слышно в шуме.'],
  ['III', 'Императрица', 'Позаботьтесь о себе и о том, что растёт. Сегодня хорошо вкладываться в долгое.'],
  ['IV', 'Император', 'Порядок и границы. Решение, принятое сегодня спокойно, будет крепким.'],
  ['V', 'Иерофант', 'Совет опытного человека сэкономит вам время. Не стесняйтесь спросить.'],
  ['VI', 'Влюблённые', 'День выбора сердцем. Честный разговор сблизит больше, чем догадки.'],
  ['VII', 'Колесница', 'Движение вперёд. Держите курс, даже если по дороге шумно.'],
  ['VIII', 'Сила', 'Мягкость сильнее давления. Терпение сегодня даст больше, чем спор.'],
  ['IX', 'Отшельник', 'Побудьте в тишине хотя бы полчаса — важная мысль придёт сама.'],
  ['X', 'Колесо Фортуны', 'Перемены к лучшему. Будьте готовы сказать «да» неожиданному.'],
  ['XI', 'Справедливость', 'Всё возвращается. Хороший день, чтобы закрыть старые долги и обещания.'],
  ['XII', 'Повешенный', 'Посмотрите на ситуацию с другой стороны — пауза сейчас не потеря времени.'],
  ['XIII', 'Смерть', 'Отпустите то, что отжило. Освободится место для нового.'],
  ['XIV', 'Умеренность', 'Золотая середина. Не торопитесь и не тяните — всё в своё время.'],
  ['XV', 'Дьявол', 'Заметьте привычку, которая забирает силы. Осознать — уже половина дела.'],
  ['XVI', 'Башня', 'Неожиданность может оказаться освобождением. Не держитесь за шаткое.'],
  ['XVII', 'Звезда', 'Надежда и вдохновение. Хороший день для планов и мечты вслух.'],
  ['XVIII', 'Луна', 'Не всё ясно с первого взгляда. Отложите важное решение до утра.'],
  ['XIX', 'Солнце', 'Радость и ясность. Делитесь хорошим — оно умножится.'],
  ['XX', 'Суд', 'Время подвести итоги и услышать себя. Второй шанс рядом.'],
  ['XXI', 'Мир', 'Завершение цикла. Отметьте то, что уже получилось.'],
];
const CARD_EN = [
  ['0', 'The Fool', 'A day for a fresh start. Don\'t wait for the perfect moment — take the first step.'],
  ['I', 'The Magician', 'You already have what you need. Say out loud what you want; it makes acting on it easier.'],
  ['II', 'The High Priestess', 'Trust your intuition. The answer is there — it just gets lost in the noise.'],
  ['III', 'The Empress', 'Care for yourself and for what is growing. A good day to invest in the long term.'],
  ['IV', 'The Emperor', 'Order and boundaries. A decision made calmly today will hold.'],
  ['V', 'The Hierophant', 'Advice from someone experienced will save you time. Don\'t be shy to ask.'],
  ['VI', 'The Lovers', 'A day to choose with your heart. An honest talk brings you closer than guessing.'],
  ['VII', 'The Chariot', 'Forward motion. Hold your course, even if the road is noisy.'],
  ['VIII', 'Strength', 'Gentleness beats pressure. Patience gets you further today than arguing.'],
  ['IX', 'The Hermit', 'Take half an hour of quiet — the important thought will come on its own.'],
  ['X', 'Wheel of Fortune', 'Change for the better. Be ready to say yes to the unexpected.'],
  ['XI', 'Justice', 'What goes around comes around. A good day to close old promises.'],
  ['XII', 'The Hanged Man', 'Look at things from the other side — a pause now is not lost time.'],
  ['XIII', 'Death', 'Let go of what has run its course. It makes room for something new.'],
  ['XIV', 'Temperance', 'The middle way. Don\'t rush and don\'t stall — everything in its time.'],
  ['XV', 'The Devil', 'Notice a habit that drains you. Seeing it is half the work.'],
  ['XVI', 'The Tower', 'A surprise may turn out to be a release. Don\'t cling to what is shaky.'],
  ['XVII', 'The Star', 'Hope and inspiration. A good day for plans and dreaming out loud.'],
  ['XVIII', 'The Moon', 'Not everything is clear at first sight. Sleep on the big decision.'],
  ['XIX', 'The Sun', 'Joy and clarity. Share the good — it multiplies.'],
  ['XX', 'Judgement', 'Time to take stock and listen to yourself. A second chance is close.'],
  ['XXI', 'The World', 'A cycle completes. Celebrate what has already worked out.'],
];
export const CARDS = CARD_RU;
export const cards = (cfg = CONFIG) => (cfg.lang === 'en' ? CARD_EN : CARD_RU);

const T = {
  ru: {
    wd: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
    mon: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    humanDate: (wd, d, mon) => `${wd}, ${d} ${mon}`,
    menu: ['🔮 Карта дня', '📅 Записаться на консультацию', '🗓 Мои записи'],
    hello: (t) => `Здравствуйте! Я бот ${t}.\n\nКаждый день — бесплатная карта дня. Здесь же можно записаться на консультацию и оплатить её онлайн.`,
    card: (again, num, name, advice) => `${again ? 'Ваша карта на сегодня всё та же' : 'Ваша карта дня'} — ${num} · ${name}\n\n${advice}`,
    cardBook: '📅 Разобрать мою ситуацию с тарологом',
    dailyOn: '🔔 Присылать карту каждое утро', dailyOff: '🔕 Не присылать карту по утрам',
    dailyOnMsg: 'Готово: карта дня будет приходить в 9:00. Отключить — кнопкой под любой картой.',
    dailyOffMsg: 'Хорошо, утренние карты больше не присылаю.',
    choose: (tz) => `Выберите консультацию. Все встречи — онлайн, время по ${tz}.`,
    noDays: 'На ближайшие дни всё занято. Напишите вопрос — отвечу и предложу время.',
    svc: (s, min, price) => `${s} · ${min} мин · ${price}\n\nВыберите день:`,
    back: '← Назад', otherDay: '← Другой день', changeTime: '← Изменить время',
    dayTaken: 'Этот день уже заняли. Выберите другой:',
    times: (day, tz) => `${day} — свободное время (${tz}):`,
    timeTaken: 'Это время только что заняли. Выберите другое:',
    confirm: (s, day, time, tz, min, price) => `Проверьте запись:\n\n${s}\n${day}, ${time} (${tz})\nОнлайн, ${min} мин\nСтоимость: ${price}\n\nПосле оплаты время закрепится за вами.`,
    pay: (price) => `💳 Оплатить ${price}`,
    takenWhilePaying: 'Пока вы оплачивали, это время заняли. Деньги не списаны — выберите другое время:',
    online: 'онлайн',
    paid: (s, day, time, tz) => `✅ Оплата получена. Вы записаны!\n\n${s}\n${day}, ${time} (${tz})\n\nЗа день и за час пришлю напоминание и ссылку на встречу.\n\nЧтобы разбор был точнее, пришлите дату, время и город рождения одним сообщением.`,
    owner: (id, s, day, time, price) => `Новая запись №${id}: ${s}, ${day} ${time}, оплачено ${price}`,
    none: 'Записей пока нет.',
    my: (id, s, day, time, tz) => `№${id} · ${s}\n${day}, ${time} (${tz})`,
    askMove: 'Перенести или отменить — написать тарологу',
    thanks: 'Спасибо! Передал ваше сообщение — ответят здесь же.',
    ownerMsg: (id, text) => `Сообщение от ${id}: ${text}`,
    pick: 'Выберите действие:',
    remind: { day: 'завтра', hour: 'через час' },
    reminder: (when, s, day, time, tz) => `⏰ Напоминание: ${when} — ${s}, ${day} в ${time} (${tz}).\n\nСсылка на встречу: придёт в этот чат за 10 минут.\nВопросы к разбору можно прислать заранее сюда.`,
    startWords: /^\/?(start|меню|начать)$/i,
  },
  en: {
    wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    humanDate: (wd, d, mon) => `${wd}, ${mon} ${d}`,
    menu: ['🔮 Card of the day', '📅 Book a reading', '🗓 My bookings'],
    hello: (t) => `Hi! I'm the ${t} bot.\n\nA free card of the day, every day. You can also book a reading here and pay for it online.`,
    card: (again, num, name, advice) => `${again ? 'Your card for today is still' : 'Your card of the day'} — ${num} · ${name}\n\n${advice}`,
    cardBook: '📅 Get a reading on my situation',
    dailyOn: '🔔 Send me a card every morning', dailyOff: '🔕 Stop morning cards',
    dailyOnMsg: 'Done: your card of the day will arrive at 9:00. Turn it off with the button under any card.',
    dailyOffMsg: 'Okay, no more morning cards.',
    choose: (tz) => `Choose a reading. All sessions are online, times in ${tz}.`,
    noDays: 'The next few days are fully booked. Send your question and I\'ll suggest a time.',
    svc: (s, min, price) => `${s} · ${min} min · ${price}\n\nPick a day:`,
    back: '← Back', otherDay: '← Another day', changeTime: '← Change time',
    dayTaken: 'That day just filled up. Pick another:',
    times: (day, tz) => `${day} — open times (${tz}):`,
    timeTaken: 'That time was just taken. Pick another:',
    confirm: (s, day, time, tz, min, price) => `Check your booking:\n\n${s}\n${day}, ${time} (${tz})\nOnline, ${min} min\nPrice: ${price}\n\nThe time is yours once it's paid.`,
    pay: (price) => `💳 Pay ${price}`,
    takenWhilePaying: 'Someone booked this time while you were paying. You were not charged — pick another time:',
    online: 'online',
    paid: (s, day, time, tz) => `✅ Payment received. You're booked!\n\n${s}\n${day}, ${time} (${tz})\n\nI'll remind you a day before and an hour before, with the session link.\n\nFor a more accurate reading, send your birth date, time and city in one message.`,
    owner: (id, s, day, time, price) => `New booking #${id}: ${s}, ${day} ${time}, paid ${price}`,
    none: 'No bookings yet.',
    my: (id, s, day, time, tz) => `#${id} · ${s}\n${day}, ${time} (${tz})`,
    askMove: 'Reschedule or cancel — message the reader',
    thanks: 'Thank you! Your message is passed on — you\'ll get a reply right here.',
    ownerMsg: (id, text) => `Message from ${id}: ${text}`,
    pick: 'Choose an option:',
    remind: { day: 'tomorrow', hour: 'in one hour' },
    reminder: (when, s, day, time, tz) => `⏰ Reminder: ${when} — ${s}, ${day} at ${time} (${tz}).\n\nThe session link arrives in this chat 10 minutes before.\nYou can send your questions here in advance.`,
    startWords: /^\/?(start|menu)$/i,
  },
};
const tx = (cfg) => T[cfg.lang] || T.ru;

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const human = (key, cfg = CONFIG) => {
  const t = tx(cfg);
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return t.humanDate(t.wd[dt.getDay()], d, t.mon[m - 1]);
};
export const money = (n, cfg = CONFIG) => (cfg.currency === 'USD' ? `$${n}` : `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`);
export const rub = (n) => money(n, CONFIG);
// Время слота для людей: «15:00» или «3:00 PM» (английская версия).
export const clock = (t, cfg = CONFIG) => {
  if (cfg.lang !== 'en') return t;
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// Одна и та же карта весь день для одного человека.
export function cardFor(chatId, day) {
  let h = 2166136261;
  for (const ch of `${chatId}|${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % CARD_RU.length;
}

export function newShared() { return { taken: {}, bookings: [], seq: 0 }; }
export function newUser() { return { step: 'menu', draft: {}, lastCardDay: null, daily: false }; }

function slotDate(day, time) {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function freeDays(shared, now, cfg = CONFIG) {
  const out = [];
  for (let i = 1; out.length < cfg.daysAhead && i < 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === cfg.dayOff) continue;
    const key = dateKey(d);
    if (freeTimes(shared, key, now, cfg).length) out.push(key);
  }
  return out;
}

export function freeTimes(shared, day, now, cfg = CONFIG) {
  return cfg.slots.filter((t) => !shared.taken[`${day} ${t}`] && slotDate(day, t) > now);
}

const menu = (t) => [
  [{ text: t.menu[0], data: 'card' }],
  [{ text: t.menu[1], data: 'book' }],
  [{ text: t.menu[2], data: 'my' }],
];

function servicesMsg(cfg) {
  const t = tx(cfg);
  return { text: t.choose(cfg.timezone), buttons: cfg.services.map((s) => [{ text: `${s.title} · ${money(s.price, cfg)}`, data: `svc:${s.id}` }]) };
}

// Главная функция: событие → новое состояние и сообщения в ответ.
// event: {type:'start'} | {type:'button', data} | {type:'text', text} | {type:'paid'}
export function handle({ chatId, user, shared, event, now, cfg = CONFIG }) {
  const t = tx(cfg);
  const u = { ...user, draft: { ...(user.draft || {}) } };
  const out = [];
  const say = (text, buttons, extra) => out.push({ text, buttons, ...extra });
  const data = event.type === 'button' ? event.data : null;
  const H = (k) => human(k, cfg);
  const M = (n) => money(n, cfg);
  const C = (x) => clock(x, cfg);
  const dayButtons = () => freeDays(shared, now, cfg).map((d) => [{ text: H(d), data: `day:${d}` }]);

  if (event.type === 'start' || (event.type === 'text' && t.startWords.test(event.text.trim()))) {
    u.step = 'menu'; u.draft = {};
    say(t.hello(cfg.title), menu(t));
    return { user: u, out };
  }

  if (data === 'card') {
    const day = dateKey(now);
    const i = cardFor(chatId, day);
    const [num, name, advice] = cards(cfg)[i];
    const again = u.lastCardDay === day;
    u.lastCardDay = day;
    say(t.card(again, num, name, advice), [
      [{ text: t.cardBook, data: 'book' }],
      [{ text: u.daily ? t.dailyOff : t.dailyOn, data: u.daily ? 'daily:off' : 'daily:on' }],
    ], { card: i });
    return { user: u, out };
  }

  if (data === 'daily:on' || data === 'daily:off') {
    u.daily = data === 'daily:on';
    say(u.daily ? t.dailyOnMsg : t.dailyOffMsg, menu(t));
    return { user: u, out };
  }

  if (data === 'book') { u.step = 'service'; u.draft = {}; out.push(servicesMsg(cfg)); return { user: u, out }; }

  if (data && data.startsWith('svc:')) {
    const s = cfg.services.find((x) => x.id === data.slice(4));
    if (!s) { out.push(servicesMsg(cfg)); return { user: u, out }; }
    u.draft = { service: s.id }; u.step = 'day';
    const days = dayButtons();
    if (!days.length) { say(t.noDays, menu(t)); return { user: u, out }; }
    say(t.svc(s.title, s.minutes, M(s.price)), days.concat([[{ text: t.back, data: 'book' }]]));
    return { user: u, out };
  }

  if (data && data.startsWith('day:') && u.draft.service) {
    const day = data.slice(4);
    const times = freeTimes(shared, day, now, cfg);
    if (!times.length) { say(t.dayTaken, dayButtons()); return { user: u, out }; }
    u.draft.day = day; u.step = 'time';
    say(t.times(H(day), cfg.timezone), [times.map((x) => ({ text: C(x), data: `time:${x}` })), [{ text: t.otherDay, data: `svc:${u.draft.service}` }]]);
    return { user: u, out };
  }

  if (data && data.startsWith('time:') && u.draft.day) {
    const time = data.slice(5);
    if (shared.taken[`${u.draft.day} ${time}`]) { say(t.timeTaken, [freeTimes(shared, u.draft.day, now, cfg).map((x) => ({ text: C(x), data: `time:${x}` }))]); return { user: u, out }; }
    u.draft.time = time; u.step = 'confirm';
    const s = cfg.services.find((x) => x.id === u.draft.service);
    say(t.confirm(s.title, H(u.draft.day), C(time), cfg.timezone, s.minutes, M(s.price)), [
      [{ text: t.pay(M(s.price)), data: 'pay' }],
      [{ text: t.changeTime, data: `day:${u.draft.day}` }],
    ]);
    return { user: u, out };
  }

  if (data === 'pay' && u.step === 'confirm') {
    const key = `${u.draft.day} ${u.draft.time}`;
    if (shared.taken[key]) { u.step = 'day'; say(t.takenWhilePaying, dayButtons()); return { user: u, out }; }
    const s = cfg.services.find((x) => x.id === u.draft.service);
    // Держим слот 15 минут на время оплаты.
    shared.taken[key] = { chatId, hold: now.getTime() + 15 * 60 * 1000 };
    u.step = 'paying';
    say(null, null, { invoice: { title: s.title, description: `${H(u.draft.day)}, ${C(u.draft.time)} · ${t.online}`, amount: s.price, currency: cfg.currency, payload: key } });
    return { user: u, out };
  }

  if (event.type === 'paid' && u.step === 'paying') {
    const key = `${u.draft.day} ${u.draft.time}`;
    const s = cfg.services.find((x) => x.id === u.draft.service);
    shared.seq += 1;
    const b = { id: shared.seq, chatId, service: s.id, day: u.draft.day, time: u.draft.time, sent: {} };
    shared.bookings.push(b);
    shared.taken[key] = { chatId, bookingId: b.id };
    u.step = 'menu'; u.draft = {};
    say(t.paid(s.title, H(b.day), C(b.time), cfg.timezone), menu(t));
    return { user: u, out, notifyOwner: t.owner(b.id, s.title, H(b.day), C(b.time), M(s.price)) };
  }

  if (data === 'my') {
    const mine = shared.bookings.filter((b) => b.chatId === chatId && !b.cancelled);
    if (!mine.length) { say(t.none, menu(t)); return { user: u, out }; }
    for (const b of mine) {
      const s = cfg.services.find((x) => x.id === b.service);
      say(t.my(b.id, s.title, H(b.day), C(b.time), cfg.timezone), [[{ text: t.askMove, data: `ask:${b.id}` }]]);
    }
    return { user: u, out };
  }

  if (event.type === 'text' && u.step === 'menu') {
    say(t.thanks, menu(t));
    return { user: u, out, notifyOwner: t.ownerMsg(chatId, event.text.slice(0, 500)) };
  }

  say(t.pick, menu(t));
  return { user: u, out };
}

// Напоминания: что пора отправить к моменту now. Каждое — один раз.
export function dueReminders(shared, now, cfg = CONFIG) {
  const t = tx(cfg);
  const out = [];
  for (const b of shared.bookings) {
    if (b.cancelled) continue;
    const at = slotDate(b.day, b.time);
    for (const r of cfg.reminders) {
      const minutesLeft = (at - now) / 60000;
      if (!b.sent[r.key] && minutesLeft <= r.minutes && minutesLeft > 0) {
        b.sent[r.key] = true;
        const s = cfg.services.find((x) => x.id === b.service);
        out.push({ chatId: b.chatId, text: t.reminder(t.remind[r.key], s.title, human(b.day, cfg), clock(b.time, cfg), cfg.timezone) });
      }
    }
  }
  return out;
}

// Снять просроченные «держания» слотов (не оплатили за 15 минут).
export function releaseHolds(shared, now) {
  for (const [k, v] of Object.entries(shared.taken)) if (v.hold && v.hold < now.getTime()) delete shared.taken[k];
}
