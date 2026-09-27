/* 页面：渲染物品档案与认领队列，处理认领表单与管理台操作 */
(() => {
  const STATUS_LABEL = {
    pending: '待核验',
    waiting: '排队中',
    rejected: '已退回',
    done: '已交还',
    closed: '已关闭',
  };

  const $ = sel => document.querySelector(sel);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function showMsg(text, ok) {
    const el = $('#claimMsg');
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'warn');
    el.hidden = false;
  }

  // 认领下拉框只列出可认领（保管中且未到期）的物品
  function renderItemOptions() {
    const items = ItemStore.list().filter(ItemStore.canClaim);
    $('#itemSelect').innerHTML = items.length
      ? items.map(i => `<option value="${i.id}">${escapeHtml(i.name)}（保管格 ${escapeHtml(i.slot)}）</option>`).join('')
      : '<option value="">暂无可认领物品</option>';
  }

  function claimRow(claim, position) {
    const pos = claim.status === 'waiting' ? `<span class="pos">第 ${position} 位</span>` : '';
    return `
      <li class="claim ${claim.status}">
        <span class="badge">${STATUS_LABEL[claim.status]}</span>
        <strong>${escapeHtml(claim.name)}</strong>${pos}
        <span class="features">特征：${escapeHtml(claim.features)}</span>
        <span class="note">${escapeHtml(claim.note || '')}</span>
      </li>`;
  }

  function itemCard(item) {
    const status = ItemStore.statusOf(item);
    const expired = ItemStore.isExpired(item);
    const claims = ClaimQueue.listByItem(item.id);
    const waiting = ClaimQueue.waitingOf(item.id);
    const pending = ClaimQueue.pendingOf(item.id);

    const claimsHtml = claims.length
      ? `<ol class="claims">${claims.map(c => claimRow(c, waiting.indexOf(c) + 1)).join('')}</ol>`
      : '<p class="empty">暂无认领记录</p>';

    let actions = '';
    if (expired) {
      actions = '<button class="btn warn" data-action="transfer">移交总站</button>';
    } else if (item.status === 'active' && pending) {
      actions = `
        <button class="btn primary" data-action="confirm">确认交还</button>
        <button class="btn danger" data-action="reject">退回当前认领</button>`;
    }

    return `
      <article class="card" data-id="${item.id}">
        <div class="card-head">
          <h3>${escapeHtml(item.name)}</h3>
          <span class="status ${item.status}${expired ? ' expired' : ''}">${status}</span>
        </div>
        <dl class="meta">
          <div><dt>拾获地点</dt><dd>${escapeHtml(item.location)}</dd></div>
          <div><dt>保管格</dt><dd>${escapeHtml(item.slot)}</dd></div>
          <div><dt>拾获日期</dt><dd>${item.foundDate}</dd></div>
          <div><dt>到期日</dt><dd>${item.expiryDate}</dd></div>
          <div class="full"><dt>留存特征（核验参考）</dt><dd>${escapeHtml(item.trueFeatures)}</dd></div>
        </dl>
        ${claimsHtml}
        <div class="actions">${actions}</div>
      </article>`;
  }

  function render() {
    renderItemOptions();
    $('#itemsList').innerHTML = ItemStore.list().map(itemCard).join('');
  }

  // 提交认领：暗号不符即退回，不挤掉当前认领
  $('#claimForm').addEventListener('submit', e => {
    e.preventDefault();
    const itemId = $('#itemSelect').value;
    const name = $('#claimantName').value.trim();
    const phrase = $('#passphrase').value;
    const features = $('#features').value.trim();
    if (!itemId || !name || !features) return;

    const ok = ItemStore.verifyPassphrase(itemId, phrase);
    const claim = ClaimQueue.submit(itemId, name, features, ok);

    if (claim.status === 'rejected') {
      showMsg('暗号不符，认领已退回（不影响当前核验中的认领）。', false);
    } else if (claim.status === 'pending') {
      showMsg('暗号通过，已进入待核验，请等待管理员确认。', true);
    } else {
      const pos = ClaimQueue.waitingOf(itemId).findIndex(c => c.id === claim.id) + 1;
      showMsg(`暗号通过，当前已有待核验认领，您排在第 ${pos} 位。`, true);
    }

    e.target.reset();
    render();
  });

  // 管理台操作：退回当前认领 / 确认交还 / 移交总站
  $('#itemsList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const itemId = btn.closest('.card').dataset.id;
    const action = btn.dataset.action;

    if (action === 'reject') {
      const next = ClaimQueue.rejectCurrent(itemId);
      showMsg(next ? `已退回当前认领，${next.name} 自动接手核验。` : '已退回当前认领，等待队列已空。', false);
    } else if (action === 'confirm') {
      const done = ClaimQueue.confirmReturn(itemId);
      ItemStore.markReturned(itemId);
      showMsg(done ? `已确认交还给 ${done.name}，物品与剩余等待队列一并关闭。` : '当前无待核验认领。', true);
    } else if (action === 'transfer') {
      if (ItemStore.transfer(itemId)) {
        ClaimQueue.closeAll(itemId, '物品已移交总站，队列关闭');
        showMsg('物品已移交总站，未决认领已关闭。', true);
      }
    }
    render();
  });

  $('#resetBtn').addEventListener('click', () => {
    ItemStore.reset();
    ClaimQueue.reset();
    render();
    showMsg('演示数据已重置。', true);
  });

  render();
})();
