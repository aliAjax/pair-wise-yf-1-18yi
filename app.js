/* 页面：标签切换、表单交互、三个视图的渲染 */
(() => {
  const $ = sel => document.querySelector(sel);

  const ITEM_STATUS = {
    custody: '保管中',
    transferred: '已移交总站',
    returned: '已交还关闭',
  };

  const CLAIM_STATUS = {
    pending: '待核验',
    waiting: '排队等待',
    rejected: '已退回',
    closed: '已关闭',
    returned: '已交还',
  };

  const fmtDate = ts => new Date(ts).toLocaleDateString('zh-CN');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  // ---------- 标签切换 ----------
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.page').forEach(p =>
        p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
      render();
    });
  });

  // ---------- 保管台 ----------
  function renderItems() {
    const list = $('#item-list');
    const items = ItemStore.all();
    if (!items.length) {
      list.innerHTML = '<p class="empty">暂无登记物品</p>';
      return;
    }
    list.innerHTML = items.map(item => {
      const expired = ItemStore.isExpired(item);
      const badge = expired ? '<span class="badge warn">已到期</span>'
                            : `<span class="badge">${ITEM_STATUS[item.status]}</span>`;
      const action = expired
        ? `<button data-transfer="${item.id}">移交总站</button>` : '';
      return `<div class="card item">
        <div class="item-head"><strong>${esc(item.name)}</strong>${badge}</div>
        <div class="meta">拾获地点：${esc(item.location)} ｜ 保管格：${esc(item.slot)} ｜ 到期日：${fmtDate(item.expiresAt)}</div>
        ${action}
      </div>`;
    }).join('');

    list.querySelectorAll('[data-transfer]').forEach(btn => {
      btn.addEventListener('click', () => {
        ItemStore.transfer(btn.dataset.transfer);
        render();
      });
    });
  }

  $('#register-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const expiresAt = new Date(f.expiresAt.value + 'T23:59:59').getTime();
    ItemStore.register({
      name: f.name.value.trim(),
      location: f.location.value.trim(),
      slot: f.slot.value.trim(),
      passphrase: f.passphrase.value.trim(),
      expiresAt,
    });
    f.reset();
    render();
  });

  // ---------- 我要认领 ----------
  function renderClaimForm() {
    const select = $('#claim-form select[name=itemId]');
    const claimable = ItemStore.all().filter(ItemStore.claimable);
    select.innerHTML = claimable.length
      ? claimable.map(i => `<option value="${i.id}">${esc(i.name)}（保管格 ${esc(i.slot)}）</option>`).join('')
      : '<option value="" disabled selected>暂无可认领物品</option>';
  }

  $('#claim-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const result = ClaimStore.submit(
      f.itemId.value,
      f.claimant.value.trim(),
      f.passphrase.value.trim(),
      f.features.value.trim(),
    );
    const box = $('#claim-result');
    if (!result.ok) {
      box.textContent = result.reason;
      box.className = 'result fail';
    } else {
      box.textContent = result.status === 'pending'
        ? '暗号正确，您已进入待核验，请等待管理员确认。'
        : '暗号正确，当前已有他人在核验，您已按提交顺序排队。';
      box.className = 'result ok';
      f.reset();
    }
    render();
  });

  function renderQueues() {
    const list = $('#queue-list');
    const items = ItemStore.all();
    const html = items.map(item => {
      const queue = ClaimStore.forItem(item.id);
      if (!queue.length) return '';
      const rows = queue.map((c, i) => {
        const note = c.rejectReason ? `（${esc(c.rejectReason)}）` : '';
        return `<li>
          <span class="badge ${c.status}">${CLAIM_STATUS[c.status]}</span>
          ${esc(c.claimant)} ｜ ${fmtDate(c.submittedAt)}${note}
        </li>`;
      }).join('');
      return `<div class="card">
        <div class="item-head"><strong>${esc(item.name)}</strong></div>
        <ol class="queue">${rows}</ol>
      </div>`;
    }).filter(Boolean).join('');
    list.innerHTML = html || '<p class="empty">暂无认领记录</p>';
  }

  // ---------- 管理核验 ----------
  function renderAdmin() {
    const list = $('#admin-list');
    const items = ItemStore.all();
    const html = items.map(item => {
      const cur = ClaimStore.currentPending(item.id);
      if (!cur) return '';
      const waiting = ClaimStore.forItem(item.id).filter(c => c.status === 'waiting');
      return `<div class="card">
        <div class="item-head"><strong>${esc(item.name)}</strong>
          <span class="badge">保管格 ${esc(item.slot)}</span></div>
        <p>认领人：${esc(cur.claimant)}</p>
        <p>特征描述：${esc(cur.features)}</p>
        <p class="meta">后面还有 ${waiting.length} 人排队</p>
        <button data-reject="${item.id}">拒绝（下一位接手）</button>
        <button data-handover="${item.id}" class="primary">确认交还</button>
      </div>`;
    }).filter(Boolean).join('');
    list.innerHTML = html || '<p class="empty">暂无待核验的认领</p>';

    list.querySelectorAll('[data-reject]').forEach(btn => {
      btn.addEventListener('click', () => {
        ClaimStore.rejectCurrent(btn.dataset.reject);
        render();
      });
    });
    list.querySelectorAll('[data-handover]').forEach(btn => {
      btn.addEventListener('click', () => {
        ClaimStore.confirmHandover(btn.dataset.handover);
        render();
      });
    });
  }

  // ---------- 重置 ----------
  $('#reset-btn').addEventListener('click', () => {
    ItemStore.reset();
    ClaimStore.reset();
    render();
  });

  function render() {
    renderItems();
    renderClaimForm();
    renderQueues();
    renderAdmin();
  }

  render();
})();
