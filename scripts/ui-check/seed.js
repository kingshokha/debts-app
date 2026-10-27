// Тестовые данные для веб-проверки (вымышленные имена). Запуск: playwright-cli run-code --filename=seed.js
async (page) => {
  const day = 86400000;
  const now = Date.now();
  const groups = [
    { id: 'g-shop', name: 'Магазин' },
    { id: 'g-market', name: 'Рынок' },
  ];
  const groupOf = { a: 'g-shop', b: 'g-shop', c: 'g-shop', d: 'g-market', e: 'g-market' };
  const mk = (id, name, ops) => ({
    id,
    name,
    groupId: groupOf[id] ?? null,
    createdAt: now - 30 * day,
    operations: ops.map(([amount, daysAgo, comment], i) => ({ id: `${id}-${i}`, amount, date: now - daysAgo * day, comment })),
  });
  const contacts = [
    mk('a', 'ШЗ Тестова Анна 900000001 Длинный адрес для проверки обрезки', [[1000, 5, 'Велосипед 20"'], [-100, 2, 'Велосипед 20" (1100)_1000-100=900, 3 мес']]),
    mk('b', 'ШМ Петров Иван 900000002', [[3000, 10, 'Стиральная машина 7,5 кг'], [-500, 1, 'Автомат_3000-500=2500, 5 мес']]),
    mk('c', 'ПЗ Сидорова Мария 900000003', [[4400, 3, 'Коляска']]),
    mk('d', 'ШЗ Ким Ольга 900000004', [[150, 4, '']]),
    mk('e', 'ШМ Вова 900000005', [[2380, 6, '']]),
    mk('f', 'ПМ Очень Длинное Имя Фамилия Отчество 900000006', [[1450, 7, '']]),
    mk('g', 'ОВД Должник Минусов 900000007', [[-116, 8, 'Переплата']]),
    mk('h', 'ШМ Нулевой Баланс 900000008', [[500, 20, 'Чайник'], [-500, 9, 'Погашение']]),
    mk('i', 'ПЗ Крупная Сумма 900000009', [[812448, 12, 'Холодильник + телевизор']]),
  ];
  await page.evaluate(
    ([c, g]) => {
      localStorage.setItem('debts/contacts/v1', JSON.stringify(c));
      localStorage.setItem('debts/groups/v1', JSON.stringify(g));
      localStorage.removeItem('debts/view/v1');
    },
    [contacts, groups],
  );
  await page.reload();
  return `seeded ${contacts.length} contacts, ${groups.length} groups`;
}
