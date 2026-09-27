/* 物品档案：拾获物登记信息、状态流转与本地持久化 */
const ItemStore = (() => {
  const KEY = 'community-lostfound.items.v1';

  // 三件初始拾获物；登记要素：拾获地点、保管格、到期日
  const seedItems = [
    {
      id: 'WP-001', name: '黑色皮夹',
      location: '中心花园长椅', slot: 'A-01',
      foundDate: '2026-09-20', expiryDate: '2026-10-20',
      passphrase: '枫叶飘飘',
      trueFeatures: '内有蓝色地铁卡一张、张姓身份证',
      status: 'active',
    },
    {
      id: 'WP-002', name: '蓝色折叠伞',
      location: '东门岗亭旁', slot: 'B-03',
      foundDate: '2026-08-15', expiryDate: '2026-09-15',
      passphrase: '雨后晴天',
      trueFeatures: '伞柄贴卡通贴纸，一根伞骨略弯',
      status: 'active',
    },
    {
      id: 'WP-003', name: '银色钥匙串',
      location: '健身区跑步机旁', slot: 'C-02',
      foundDate: '2026-09-25', expiryDate: '2026-10-25',
      passphrase: '三把钥匙',
      trueFeatures: '三把钥匙，挂木质小猫挂件',
      status: 'active',
    },
  ];

  function todayStr() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 数据损坏时重新播种 */ }
    const items = seedItems.map(i => ({ ...i }));
    save(items);
    return items;
  }

  function list() { return load(); }

  function get(id) { return load().find(i => i.id === id) || null; }

  // 到期为派生状态：保管中且当前日期已过到期日
  function isExpired(item) {
    return item.status === 'active' && todayStr() > item.expiryDate;
  }

  function canClaim(item) {
    return item.status === 'active' && !isExpired(item);
  }

  function statusOf(item) {
    if (item.status === 'returned') return '已交还';
    if (item.status === 'transferred') return '已移交总站';
    if (isExpired(item)) return '已到期 · 待移交';
    return '保管中';
  }

  function verifyPassphrase(id, phrase) {
    const item = get(id);
    return !!item && item.passphrase === String(phrase).trim();
  }

  function update(id, patch) {
    const items = load();
    const item = items.find(i => i.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    save(items);
    return item;
  }

  // 到期后唯一去向：移交总站
  function transfer(id) {
    const item = get(id);
    if (!item || !isExpired(item)) return null;
    return update(id, { status: 'transferred' });
  }

  function markReturned(id) {
    const item = get(id);
    if (!item || item.status !== 'active') return null;
    return update(id, { status: 'returned' });
  }

  function reset() { localStorage.removeItem(KEY); }

  return { list, get, isExpired, canClaim, statusOf, verifyPassphrase, transfer, markReturned, reset };
})();
