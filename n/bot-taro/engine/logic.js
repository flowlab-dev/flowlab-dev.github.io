// Логика демо-бота таролога/астролога: «Карта дня» → запись → оплата → напоминания.
// Чистые функции без сети и без файлов: один и тот же код работает в Telegram (bot/run.js)
// и в демо-странице (demo/index.html). Данные вымышленные.

export const CONFIG = {
  title: 'Таро и астрология · демо',
  timezone: 'МСК',
  services: [
    { id: 'taro', title: 'Расклад Таро на ситуацию', minutes: 60, price: 3000 },
    { id: 'natal', title: 'Разбор натальной карты', minutes: 90, price: 6000 },
    { id: 'year', title: 'Прогноз на год', minutes: 60, price: 5000 },
  ],
  slots: ['11:00', '13:00', '15:00', '18:00'],
  daysAhead: 5,
  dayOff: 0, // воскресенье
  reminders: [{ key: 'day', minutes: 24 * 60, text: 'завтра' }, { key: 'hour', minutes: 60, text: 'через час' }],
};

export const CARDS = [
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

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const human = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WD[dt.getDay()]}, ${d} ${MON[m - 1]}`;
};
export const rub = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;

// Одна и та же карта весь день для одного человека.
export function cardFor(chatId, day) {
  let h = 2166136261;
  for (const ch of `${chatId}|${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % CARDS.length;
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

const menu = () => [
  [{ text: '🔮 Карта дня', data: 'card' }],
  [{ text: '📅 Записаться на консультацию', data: 'book' }],
  [{ text: '🗓 Мои записи', data: 'my' }],
];

function servicesMsg(cfg) {
  return {
    text: 'Выберите консультацию. Все встречи — онлайн, время по ' + cfg.timezone + '.',
    buttons: cfg.services.map((s) => [{ text: `${s.title} · ${rub(s.price)}`, data: `svc:${s.id}` }]),
  };
}

// Главная функция: событие → новое состояние и сообщения в ответ.
// event: {type:'start'} | {type:'button', data} | {type:'text', text} | {type:'paid', bookingId}
export function handle({ chatId, user, shared, event, now, cfg = CONFIG }) {
  const u = { ...user, draft: { ...(user.draft || {}) } };
  const out = [];
  const say = (text, buttons, extra) => out.push({ text, buttons, ...extra });
  const data = event.type === 'button' ? event.data : null;

  if (event.type === 'start' || (event.type === 'text' && /^\/?(start|меню|начать)$/i.test(event.text.trim()))) {
    u.step = 'menu'; u.draft = {};
    say(`Здравствуйте! Я бот ${cfg.title}.\n\nКаждый день — бесплатная карта дня. Здесь же можно записаться на консультацию и оплатить её онлайн.`, menu());
    return { user: u, out };
  }

  if (data === 'card') {
    const day = dateKey(now);
    const i = cardFor(chatId, day);
    const [num, name, advice] = CARDS[i];
    const again = u.lastCardDay === day;
    u.lastCardDay = day;
    say(`${again ? 'Ваша карта на сегодня всё та же' : 'Ваша карта дня'} — ${num} · ${name}\n\n${advice}`, [
      [{ text: '📅 Разобрать мою ситуацию с тарологом', data: 'book' }],
      [{ text: u.daily ? '🔕 Не присылать карту по утрам' : '🔔 Присылать карту каждое утро', data: u.daily ? 'daily:off' : 'daily:on' }],
    ], { card: i });
    return { user: u, out };
  }

  if (data === 'daily:on' || data === 'daily:off') {
    u.daily = data === 'daily:on';
    say(u.daily ? 'Готово: карта дня будет приходить в 9:00. Отключить — кнопкой под любой картой.' : 'Хорошо, утренние карты больше не присылаю.', menu());
    return { user: u, out };
  }

  if (data === 'book') { u.step = 'service'; u.draft = {}; out.push(servicesMsg(cfg)); return { user: u, out }; }

  if (data && data.startsWith('svc:')) {
    const s = cfg.services.find((x) => x.id === data.slice(4));
    if (!s) { out.push(servicesMsg(cfg)); return { user: u, out }; }
    u.draft = { service: s.id }; u.step = 'day';
    const days = freeDays(shared, now, cfg);
    if (!days.length) { say('На ближайшие дни всё занято. Напишите вопрос — отвечу и предложу время.', menu()); return { user: u, out }; }
    say(`${s.title} · ${s.minutes} мин · ${rub(s.price)}\n\nВыберите день:`, days.map((d) => [{ text: human(d), data: `day:${d}` }]).concat([[{ text: '← Назад', data: 'book' }]]));
    return { user: u, out };
  }

  if (data && data.startsWith('day:') && u.draft.service) {
    const day = data.slice(4);
    const times = freeTimes(shared, day, now, cfg);
    if (!times.length) { say('Этот день уже заняли. Выберите другой:', freeDays(shared, now, cfg).map((d) => [{ text: human(d), data: `day:${d}` }])); return { user: u, out }; }
    u.draft.day = day; u.step = 'time';
    say(`${human(day)} — свободное время (${cfg.timezone}):`, [times.map((t) => ({ text: t, data: `time:${t}` })), [{ text: '← Другой день', data: `svc:${u.draft.service}` }]]);
    return { user: u, out };
  }

  if (data && data.startsWith('time:') && u.draft.day) {
    const time = data.slice(5);
    if (shared.taken[`${u.draft.day} ${time}`]) { say('Это время только что заняли. Выберите другое:', [freeTimes(shared, u.draft.day, now, cfg).map((t) => ({ text: t, data: `time:${t}` }))]); return { user: u, out }; }
    u.draft.time = time; u.step = 'confirm';
    const s = cfg.services.find((x) => x.id === u.draft.service);
    say(`Проверьте запись:\n\n${s.title}\n${human(u.draft.day)}, ${time} (${cfg.timezone})\nОнлайн, ${s.minutes} мин\nСтоимость: ${rub(s.price)}\n\nПосле оплаты время закрепится за вами.`, [
      [{ text: `💳 Оплатить ${rub(s.price)}`, data: 'pay' }],
      [{ text: '← Изменить время', data: `day:${u.draft.day}` }],
    ]);
    return { user: u, out };
  }

  if (data === 'pay' && u.step === 'confirm') {
    const key = `${u.draft.day} ${u.draft.time}`;
    if (shared.taken[key]) { u.step = 'day'; say('Пока вы оплачивали, это время заняли. Деньги не списаны — выберите другое время:', freeDays(shared, now, cfg).map((d) => [{ text: human(d), data: `day:${d}` }])); return { user: u, out }; }
    const s = cfg.services.find((x) => x.id === u.draft.service);
    // Держим слот 15 минут на время оплаты.
    shared.taken[key] = { chatId, hold: now.getTime() + 15 * 60 * 1000 };
    u.step = 'paying';
    say(null, null, { invoice: { title: s.title, description: `${human(u.draft.day)}, ${u.draft.time} · онлайн`, amount: s.price, payload: key } });
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
    say(`✅ Оплата получена. Вы записаны!\n\n${s.title}\n${human(b.day)}, ${b.time} (${cfg.timezone})\n\nЗа день и за час пришлю напоминание и ссылку на встречу.\n\nЧтобы разбор был точнее, пришлите дату, время и город рождения одним сообщением.`, menu());
    return { user: u, out, notifyOwner: `Новая запись №${b.id}: ${s.title}, ${human(b.day)} ${b.time}, оплачено ${rub(s.price)}` };
  }

  if (data === 'my') {
    const mine = shared.bookings.filter((b) => b.chatId === chatId && !b.cancelled);
    if (!mine.length) { say('Записей пока нет.', menu()); return { user: u, out }; }
    for (const b of mine) {
      const s = cfg.services.find((x) => x.id === b.service);
      say(`№${b.id} · ${s.title}\n${human(b.day)}, ${b.time} (${cfg.timezone})`, [[{ text: 'Перенести или отменить — написать тарологу', data: `ask:${b.id}` }]]);
    }
    return { user: u, out };
  }

  if (event.type === 'text' && u.step === 'menu') {
    say('Спасибо! Передал ваше сообщение — ответят здесь же.', menu());
    return { user: u, out, notifyOwner: `Сообщение от ${chatId}: ${event.text.slice(0, 500)}` };
  }

  say('Выберите действие:', menu());
  return { user: u, out };
}

// Напоминания: что пора отправить к моменту now. Каждое — один раз.
export function dueReminders(shared, now, cfg = CONFIG) {
  const out = [];
  for (const b of shared.bookings) {
    if (b.cancelled) continue;
    const at = slotDate(b.day, b.time);
    for (const r of cfg.reminders) {
      const minutesLeft = (at - now) / 60000;
      if (!b.sent[r.key] && minutesLeft <= r.minutes && minutesLeft > 0) {
        b.sent[r.key] = true;
        const s = cfg.services.find((x) => x.id === b.service);
        out.push({ chatId: b.chatId, text: `⏰ Напоминание: ${r.text} — ${s.title}, ${human(b.day)} в ${b.time} (${cfg.timezone}).\n\nСсылка на встречу: придёт в этот чат за 10 минут.\nВопросы к разбору можно прислать заранее сюда.` });
      }
    }
  }
  return out;
}

// Снять просроченные «держания» слотов (не оплатили за 15 минут).
export function releaseHolds(shared, now) {
  for (const [k, v] of Object.entries(shared.taken)) if (v.hold && v.hold < now.getTime()) delete shared.taken[k];
}
