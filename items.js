/* 物品档案：登记、到期、移交总站、交还关闭。数据存 localStorage。 */
const ItemStore = (() => {
  const KEY = 'lostfound.items.v1';
  const DAY = 24 * 60 * 60 * 1000;

  // 首次使用准备三件拾获物；其中一件已过期，用于演示"到期只能移交总站"
  function seed() {
    const now = Date.now();
    return [
      { id: 'it-wallet', name: '黑色皮质钱包', location: '社区东门长椅', slot: 'A-01',
        passphrase: '牛皮', foundAt: now - 2 * DAY, expiresAt: now + 14 * DAY, status: 'custody' },
      { id: 'it-bottle', name: '蓝色儿童水壶', location: '中心花园喷泉旁', slot: 'B-03',
        passphrase: '恐龙贴纸', foundAt: now - 1 * DAY, expiresAt: now + 7 * DAY, status: 'custody' },
      { id: 'it-keys', name: '银色钥匙串', location: '3号楼电梯口', slot: 'C-02',
        passphrase: '三把钥匙', foundAt: now - 30 * DAY, expiresAt: now - 1 * DAY, status: 'custody' },
    ];
  }

  let items = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 数据损坏则重新播种 */ }
    const seeded = seed();
    localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function isExpired(item) {
    return item.status === 'custody' && Date.now() > item.expiresAt;
  }

  return {
    all: () => items.slice(),
    get: id => items.find(i => i.id === id) || null,
    isExpired,
    // 只有在保管中且未到期才允许认领
    claimable(item) {
      return item.status === 'custody' && !isExpired(item);
    },
    register({ name, location, slot, passphrase, expiresAt }) {
      const item = {
        id: 'it-' + Math.random().toString(36).slice(2, 8),
        name, location, slot, passphrase,
        foundAt: Date.now(),
        expiresAt,
        status: 'custody',
      };
      items.push(item);
      save();
      return item;
    },
    // 到期后唯一的去向：移交总站
    transfer(id) {
      const item = items.find(i => i.id === id);
      if (!item || !isExpired(item)) return false;
      item.status = 'transferred';
      item.transferredAt = Date.now();
      save();
      return true;
    },
    // 确认交还后关闭档案
    closeReturned(id) {
      const item = items.find(i => i.id === id);
      if (!item) return;
      item.status = 'returned';
      item.returnedAt = Date.now();
      save();
    },
    reset() {
      items = seed();
      save();
    },
  };
})();
