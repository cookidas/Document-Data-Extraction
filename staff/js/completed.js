if (sessionStorage.getItem('isLoggedIn') !== 'true') {
  location.href = 'index.html';
}
document.getElementById('user-name').textContent = sessionStorage.getItem('userName') || '';

function logout() {
  sessionStorage.clear();
  location.href = 'index.html';
}

let completedApps = []; // renderTable이 서버에서 갱신

async function renderTable() {
  const tbody = document.getElementById('completed-tbody');
  try {
    const apps = await loadApplications();
    completedApps = apps.filter(a => a.status === 'completed');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--danger);">⚠️ 서버 연결 실패: ${err.message}</td></tr>`;
    return;
  }

  document.getElementById('stat-completed').textContent = completedApps.length;
  document.getElementById('count-label').textContent = completedApps.length;

  const passCount = completedApps.filter(a => getSonanongResult(a) === 'pass').length;
  const failCount = completedApps.filter(a => getSonanongResult(a) === 'fail').length;
  document.getElementById('stat-pass').textContent = passCount;
  document.getElementById('stat-fail').textContent = failCount;

  if (completedApps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--gray-400);">검수 완료된 신청서가 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = completedApps.map(app => {
    const fields = getAppFields(app);
    const name       = getFieldValue(fields, 'name');
    const rid        = maskResidentId(getFieldValue(fields, 'residentId')) || '—';
    const phone      = getFieldValue(fields, 'phone');
    const acct       = getFieldValue(fields, 'accountNumber_bankName');
    const area       = getFieldValue(fields, 'appliedArea');
    const sonong     = getSonanongResult(app);
    const areaEst    = estimateAreaPaymentForApp(app);
    const sonongBadge = sonong === 'pass'
      ? '<span class="badge badge-completed">소농 충족</span>'
      : sonong === 'fail'
        ? '<span class="badge badge-error">소농 미충족<br>면적만 가능</span>'
        : '<span class="badge" style="background:var(--gray-100);color:var(--gray-400);">판정 불가</span>';
    const recType = getReceptionType(app);

    // 예상 지급액: 소농 충족 시 둘 중 큰 금액, 아니면 면적직불금만
    const best = sonong === 'pass'
      ? Math.max(SONANONG_PAYMENT, areaEst.amount || 0)
      : areaEst.amount;
    const payCell = best != null
      ? `<b>${best.toLocaleString()}원</b>` +
        (sonong === 'pass' && areaEst.amount != null
          ? `<br><span style="font-size:11px;color:var(--gray-400);">소농 ${SONANONG_PAYMENT.toLocaleString()} / 면적 ${areaEst.amount.toLocaleString()}</span>`
          : '')
      : '<span style="color:var(--gray-400);">—</span>';

    return `
      <tr>
        <td><code style="font-size:11px;color:var(--gray-400);">${app.id}</code></td>
        <td style="font-size:12px;">${recType.icon} ${recType.label}</td>
        <td class="fw-600">${name}</td>
        <td class="masked">${rid}</td>
        <td>${phone}</td>
        <td style="font-size:12px;">${acct}</td>
        <td>${area}</td>
        <td>${sonongBadge}</td>
        <td style="font-size:12px;">${payCell}</td>
        <td class="text-muted text-sm">${app.completedAt || '—'}</td>
      </tr>
    `;
  }).join('');
}

function getExportRows() {
  return completedApps.map(app => {
    const fields = getAppFields(app);
    const sonong = getSonanongResult(app);
    const areaEst = estimateAreaPaymentForApp(app);
    return {
      '신청서ID':        app.id,
      '접수유형':        getReceptionType(app).label,
      '성명':            getFieldValue(fields, 'name'),
      '주민등록번호':    maskResidentId(getFieldValue(fields, 'residentId')),
      '전화번호':        getFieldValue(fields, 'phone'),
      '계좌번호(은행명)': getFieldValue(fields, 'accountNumber_bankName'),
      '주소':            getFieldValue(fields, 'address'),
      '신청경영면적(㎡)': getFieldValue(fields, 'appliedArea'),
      '소유면적(㎡)':    getFieldValue(fields, 'ownedArea'),
      '영농종사기간(년)': getFieldValue(fields, 'farmingYears'),
      '농촌거주기간(년)': getFieldValue(fields, 'residenceYears'),
      '소농직불금 판정': sonong === 'pass' ? '충족' : sonong === 'fail' ? '미충족' : '판정불가',
      '소농직불금(원)':  sonong === 'pass' ? SONANONG_PAYMENT : '',
      '면적직불금 예상(원)': areaEst.amount ?? '',
      '신청인 선택 직불금': app.meta?.selectedPayment === 'sonanong' ? '소농'
        : app.meta?.selectedPayment === 'area' ? '면적' : '',
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
    { wch: 22 }, { wch: 14 }, { wch: 8  }, { wch: 16 }, { wch: 14 },
    { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 18 },
  ];
  XLSX.writeFile(wb, `직불금_검수완료_${todayStr()}.xlsx`);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

renderTable();
