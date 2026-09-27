/* 认领队列：认领提交、暗号退回、排队等待与核验流转 */
const ClaimQueue = (() => {
  const KEY = 'community-lostfound.claims.v1';
  // 状态：pending 待核验 / waiting 排队中 / rejected 已退回 / done 已交还 / closed 已关闭

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 数据损坏时按空队列处理 */ }
    return [];
  }

  function save(claims) {
    localStorage.setItem(KEY, JSON.stringify(claims));
  }

  const byTime = (a, b) => a.submittedAt.localeCompare(b.submittedAt);

  function listByItem(itemId) {
    return load().filter(c => c.itemId === itemId).sort(byTime);
  }

  function pendingOf(itemId) {
    return load().find(c => c.itemId === itemId && c.status === 'pending') || null;
  }

  function waitingOf(itemId) {
    return load().filter(c => c.itemId === itemId && c.status === 'waiting').sort(byTime);
  }

  let seq = 0;

  // 提交认领：暗号不对直接退回，不挤占当前核验；
  // 暗号通过时，无人核验则进入待核验，否则按提交顺序排队
  function submit(itemId, name, features, passphraseOk) {
    const claims = load();
    const claim = {
      id: 'C' + Date.now().toString(36) + (seq++),
      itemId,
      name,
      features,
      submittedAt: new Date().toISOString(),
      status: '',
      note: '',
    };
    if (!passphraseOk) {
      claim.status = 'rejected';
      claim.note = '暗号不符，已退回';
    } else if (claims.some(c => c.itemId === itemId && c.status === 'pending')) {
      claim.status = 'waiting';
    } else {
      claim.status = 'pending';
    }
    claims.push(claim);
    save(claims);
    return claim;
  }

  // 管理员拒绝当前待核验者，队列中下一位自动接手
  function rejectCurrent(itemId) {
    const claims = load();
    const cur = claims.find(c => c.itemId === itemId && c.status === 'pending');
    if (!cur) return null;
    cur.status = 'rejected';
    cur.note = '管理员核验不通过';
    const next = claims
      .filter(c => c.itemId === itemId && c.status === 'waiting')
      .sort(byTime)[0];
    if (next) next.status = 'pending';
    save(claims);
    return next || null;
  }

  // 确认交还：当前认领成交，其余等待一并关闭
  function confirmReturn(itemId) {
    const claims = load();
    const cur = claims.find(c => c.itemId === itemId && c.status === 'pending');
    if (!cur) return null;
    cur.status = 'done';
    cur.note = '核验通过，物品已交还';
    claims.forEach(c => {
      if (c.itemId === itemId && c.status === 'waiting') {
        c.status = 'closed';
        c.note = '物品已交还，队列关闭';
      }
    });
    save(claims);
    return cur;
  }

  // 物品移交总站时，关闭仍在等待的认领
  function closeAll(itemId, note) {
    const claims = load();
    claims.forEach(c => {
      if (c.itemId === itemId && (c.status === 'pending' || c.status === 'waiting')) {
        c.status = 'closed';
        c.note = note;
      }
    });
    save(claims);
  }

  function reset() { localStorage.removeItem(KEY); }

  return { listByItem, pendingOf, waitingOf, submit, rejectCurrent, confirmReturn, closeAll, reset };
})();
