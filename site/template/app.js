// superpowers-zh 官网交互 —— 零依赖原生 JS

(function () {
  'use strict';

  var TOOLS = window.__TOOLS__ || [];
  var I18N = window.__I18N__ || { copy: '复制', copied: '已复制 ✓' };

  // ---------- 主题切换（深 / 浅） ----------
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      if (light) {
        document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem('sp-theme', 'dark'); } catch (e) {}
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        try { localStorage.setItem('sp-theme', 'light'); } catch (e) {}
      }
    });
  }

  // ---------- 复制按钮（事件委托） ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    e.preventDefault();
    var box = btn.closest('[data-copy]');
    if (!box) return;
    navigator.clipboard.writeText(box.getAttribute('data-copy')).then(function () {
      var old = btn.textContent;
      btn.textContent = I18N.copied;
      btn.classList.add('done');
      setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1600);
    }).catch(function () { btn.textContent = '×'; });
  });

  // ---------- 赞助商卡片：简介展开 / 收起 ----------
  // 简介默认 CSS 截 4 行；只有真的被截断时才把「展开全部」按钮显示出来。
  Array.prototype.slice.call(document.querySelectorAll('.sponsor-card')).forEach(function (card) {
    var desc = card.querySelector('.sc-desc');
    var btn = card.querySelector('.sc-toggle');
    if (!desc || !btn) return;
    if (desc.scrollHeight <= desc.clientHeight + 2) return;   // 没截断就不用按钮
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var open = card.classList.toggle('expanded');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? (I18N.collapse || '收起') : (I18N.expand || '展开全部');
    });
  });

  // ---------- 安装命令生成器 ----------
  var sel = document.getElementById('toolSel');
  var cmdText = document.getElementById('cmdText');
  var cmdBox = cmdText ? cmdText.closest('[data-copy]') : null;
  var note = document.getElementById('installNote');

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function updateCmd() {
    var t = TOOLS[sel.value];
    if (!t) return;
    cmdText.textContent = t.cmd;
    cmdBox.setAttribute('data-copy', t.cmd);
    // mode: auto（自动识别）/ manual（必须 --tool）/ global（只有 --global 才生效）
    var tpl = I18N[t.mode] || I18N.manual;
    if (note && tpl) note.innerHTML = tpl.replace('{name}', escapeHtml(t.name));
  }
  if (sel && note) {
    sel.addEventListener('change', updateCmd);
    updateCmd();
  }

  // ---------- Skill 搜索 + 筛选 ----------
  var grid = document.getElementById('grid');
  var search = document.getElementById('search');
  var empty = document.getElementById('empty');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var cards = grid ? Array.prototype.slice.call(grid.querySelectorAll('.card')) : [];
  var activeFilter = 'all';

  function applyFilter() {
    var q = (search ? search.value : '').trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var group = card.getAttribute('data-group');
      var hay = (card.getAttribute('data-name') + ' ' + card.getAttribute('data-title') + ' ' + card.textContent).toLowerCase();
      var show = (activeFilter === 'all' || group === activeFilter) && (!q || hay.indexOf(q) !== -1);
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    if (empty) empty.hidden = visible !== 0;
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter');
      applyFilter();
    });
  });
  if (search) search.addEventListener('input', applyFilter);
})();
