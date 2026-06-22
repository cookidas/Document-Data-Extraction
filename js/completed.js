if (sessionStorage.getItem('isLoggedIn') !== 'true') {
  location.href = 'index.html';
}
document.getElementById('user-name').textContent = sessionStorage.getItem('userName') || '';

function logout() {
  sessionStorage.clear();
  location.href = 'index.html';
}

function maskResidentId(val) {
  if (!val) return '—';
  const clean = val.replace(/\s/g, '');
  const m = clean.match(/^(\d{6})-?(\d)(\d{6})$/);
  if (m) return `${m[1]}-${m[2]}******`;
  const dash = clean.indexOf('-');
  if (dash > 0) return clean.substring(0, dash + 2) + '******';
  return clean.substring(0, 7) + '******';
}

// 소농 조건 전체 통과 여부 (4개 조건 모두 pass)
function checkSoNongResult(fields) {
  const condKeys = ['appliedArea', 'ownedArea', 'farmingYears', 'residenceYears'];
  const results = condKeys.map(key => {
    const val = getFieldValue(fields, key);
    return evaluateCondition(key, val);
  });
  if (results.some(r => r === null || r.status === 'unknown')) return 'unknown';
  return results.every(r => r.status === 'pass') ? 'pass' : 'fail';
}

function renderTable() {
  const apps = loadApplications().filter(a => a.status === 'completed');
  const tbody = document.getElementById('completed-tbody');

  document.getElementById('stat-completed').textContent = apps.length;
  document.getElementById('count-label').textContent = apps.length;

  const passCount = apps.filter(a => checkSoNongResult(a.fields) === 'pass').length;
  const failCount = apps.filter(a => checkSoNongResult(a.fields) === 'fail').length;
  document.getElementById('stat-pass').textContent = passCount;
  document.getElementById('stat-fail').textContent = failCount;

  if (apps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400);">검수 완료된 신청서가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = apps.map(app => {
    const name       = getFieldValue(app.fields, 'name');
    const rid        = maskResidentId(getFieldValue(app.fields, 'residentId'));
    const phone      = getFieldValue(app.fields, 'phone');
    const acct       = getFieldValue(app.fields, 'accountNumber_bankName');
    const area       = getFieldValue(app.fields, 'appliedArea');
    const sonong     = checkSoNongResult(app.fields);
    const sonongBadge = sonong === 'pass'
      ? '<span class="badge badge-completed">소농 해당</span>'
      : sonong === 'fail'
        ? '<span class="badge badge-error">소농 미해당</span>'
        : '<span class="badge" style="background:var(--gray-100);color:var(--gray-400);">미확인</span>';

    return `
      <tr>
        <td><code style="font-size:11px;color:var(--gray-400);">${app.id}</code></td>
        <td class="fw-600">${name}</td>
        <td class="masked">${rid}</td>
        <td>${phone}</td>
        <td style="font-size:12px;">${acct}</td>
        <td>${area}</td>
        <td>${sonongBadge}</td>
        <td class="text-muted text-sm">${app.completedAt || '—'}</td>
      </tr>
    `;
  }).join('');
}

function getExportRows() {
  return loadApplications()
    .filter(a => a.status === 'completed')
    .map(app => {
      const sonong = checkSoNongResult(app.fields);
      return {
        '신청서ID':        app.id,
        '성명':            getFieldValue(app.fields, 'name'),
        '주민등록번호':    maskResidentId(getFieldValue(app.fields, 'residentId')),
        '전화번호':        getFieldValue(app.fields, 'phone'),
        '계좌번호(은행명)': getFieldValue(app.fields, 'accountNumber_bankName'),
        '주소':            getFieldValue(app.fields, 'address'),
        '신청경영면적(㎡)': getFieldValue(app.fields, 'appliedArea'),
        '소유면적(㎡)':    getFieldValue(app.fields, 'ownedArea'),
        '영농종사기간(년)': getFieldValue(app.fields, 'farmingYears'),
        '농촌거주기간(년)': getFieldValue(app.fields, 'residenceYears'),
        '소농직불금':      sonong === 'pass' ? '해당' : sonong === 'fail' ? '미해당' : '미확인',
        '검수완료시각':    app.completedAt || '',
      };
    });
}

function exportCSV() {
  const rows = getExportRows();
  if (rows.length === 0) { alert('내보낼 데이터가 없습니다.'); return; }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `직불금_검수완료_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel() {
  const rows = getExportRows();
  if (rows.length === 0) { alert('내보낼 데이터가 없습니다.'); return; }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '검수완료목록');
  ws['!cols'] = [
    { wch: 22 }, { wch: 8  }, { wch: 16 }, { wch: 14 }, { wch: 24 },
    { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 18 },
  ];
  XLSX.writeFile(wb, `직불금_검수완료_${todayStr()}.xlsx`);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

renderTable();
