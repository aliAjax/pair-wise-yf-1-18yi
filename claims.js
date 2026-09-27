/* 认领队列：暗号校验、按提交顺序排队、管理员核验。数据存 localStorage。 */
const ClaimStore = (() => {
  const KEY = 'lostfound.claims.v1';

  let claims = load();

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(claims));
  }

  // 同一物品的认领按提交时间排序
  function forItem(itemId) {
    return claims
      .filter(c => c.itemId === itemId)
      .sort((a, b) => a.submittedAt - b.submittedAt);
  }

  function currentPending(itemId) {
    return forItem(itemId).find(c => c.status === 'pending') || null;
  }

  return {
    forItem,
    currentPending,

    // 提交认领：暗号不对直接退回，不影响当前待核验的人
    submit(itemId, claimant, passphrase, features) {
      const item = ItemStore.get(itemId);
      if (!item) return { ok: false, reason: '物品不存在' };
      if (item.status === 'transferred') return { ok: false, reason: '该物品已移交总站，请前往总站认领' };
      if (item.status === 'returned') return { ok: false, reason: '该物品已交还失主，档案已关闭' };
      if (ItemStore.isExpired(item)) return { ok: false, reason: '已过保管到期日，只能移交总站，停止认领' };

      const record = {
        id: 'cl-' + Math.random().toString(36).slice(2, 8),
        itemId, claimant, features,
        submittedAt: Date.now(),
        status: null,
      };

      if (passphrase !== item.passphrase) {
        record.status = 'rejected';
        record.rejectReason = '暗号不对';
        claims.push(record);
        save();
        return { ok: false, reason: '暗号不对，认领已退回' };
      }

      // 暗号通过：无人核验则进入待核验，否则按提交顺序排队
      record.status = currentPending(itemId) ? 'waiting' : 'pending';
      claims.push(record);
      save();
      return { ok: true, status: record.status };
    },

    // 管理员拒绝当前待核验者，队列中下一位自动接手
    rejectCurrent(itemId) {
      const cur = currentPending(itemId);
      if (!cur) return false;
      cur.status = 'rejected';
      cur.rejectReason = '管理员核验不通过';
      const next = forItem(itemId).find(c => c.status === 'waiting');
      if (next) next.status = 'pending';
      save();
      return true;
    },

    // 确认交还：物品关闭，剩余等待者一并关闭
    confirmHandover(itemId) {
      const cur = currentPending(itemId);
      if (!cur) return false;
      cur.status = 'returned';
      forItem(itemId).forEach(c => {
        if (c.status === 'waiting') c.status = 'closed';
      });
      ItemStore.closeReturned(itemId);
      save();
      return true;
    },

    reset() {
      claims = [];
      save();
    },
  };
})();
