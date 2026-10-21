/**
 * AION EV Charging Tracker & Consumption Calculator
 * Designed for Mobile & PWA with White Theme & Home Charging Support
 */

const STORAGE_KEY = 'aion_ev_charging_records';
const LEGACY_KEY = 'mg_s5_charging_records';
const BENCHMARK_GAS_CAR_PER_KM = 3.50; // Reference ICE gasoline car cost in THB/km

let records = [];
let chartInstance = null;
let currentChartView = 'monthly'; // 'monthly' | 'home_vs_public' | 'stations'
let currentTypeFilter = 'all';    // 'all' | 'home' | 'public'
let currentHomeMode = 'kwh';       // 'kwh' | 'direct'

// DOM Elements
const chargeForm = document.getElementById('chargeForm');
const formTitle = document.getElementById('formTitle');
const btnSubmitText = document.getElementById('btnSubmitText');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const editEntryId = document.getElementById('editEntryId');

// Form inputs
const inputChargingType = document.getElementById('inputChargingType');
const tabTypeHome = document.getElementById('tabTypeHome');
const tabTypePublic = document.getElementById('tabTypePublic');
const homeChargingBox = document.getElementById('homeChargingBox');
const publicChargingBox = document.getElementById('publicChargingBox');

const btnModeKwh = document.getElementById('btnModeKwh');
const btnModeDirect = document.getElementById('btnModeDirect');
const homeKwhSubBox = document.getElementById('homeKwhSubBox');
const inputKwh = document.getElementById('inputKwh');
const selectRatePreset = document.getElementById('selectRatePreset');
const customRateBox = document.getElementById('customRateBox');
const inputCustomRate = document.getElementById('inputCustomRate');
const homeCalcFormula = document.getElementById('homeCalcFormula');
const homeCalcAmount = document.getElementById('homeCalcAmount');

const inputStation = document.getElementById('inputStation');
const inputAmount = document.getElementById('inputAmount');
const inputDateTime = document.getElementById('inputDateTime');
const inputOdometer = document.getElementById('inputOdometer');
const btnSetNow = document.getElementById('btnSetNow');

// Stat DOMs
const statTotalCost = document.getElementById('statTotalCost');
const statHomeCostSummary = document.getElementById('statHomeCostSummary');
const statPublicCostSummary = document.getElementById('statPublicCostSummary');
const statMonthCost = document.getElementById('statMonthCost');
const statMonthSessions = document.getElementById('statMonthSessions');
const statCurrentMonthLabel = document.getElementById('statCurrentMonthLabel');
const statAvgPerKm = document.getElementById('statAvgPerKm');
const statTotalKm = document.getElementById('statTotalKm');
const statSavingsRate = document.getElementById('statSavingsRate');
const statSavingsSubtext = document.getElementById('statSavingsSubtext');
const statTotalSessions = document.getElementById('statTotalSessions');

// List & Filters
const historyListContainer = document.getElementById('historyListContainer');
const historyBadgeCount = document.getElementById('historyBadgeCount');
const emptyState = document.getElementById('emptyState');
const inputSearch = document.getElementById('inputSearch');
const selectMonthFilter = document.getElementById('selectMonthFilter');

// Modals
const settingsModal = document.getElementById('settingsModal');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnExportCSV = document.getElementById('btnExportCSV');
const modalBtnExportCSV = document.getElementById('modalBtnExportCSV');
const modalBtnExportJSON = document.getElementById('modalBtnExportJSON');
const modalBtnImportJSON = document.getElementById('modalBtnImportJSON');
const fileImportJSON = document.getElementById('fileImportJSON');
const btnAddSampleData = document.getElementById('btnAddSampleData');
const btnClearAll = document.getElementById('btnClearAll');

const howToModal = document.getElementById('howToModal');
const btnPwaHowTo = document.getElementById('btnPwaHowTo');
const btnCloseHowToModal = document.getElementById('btnCloseHowToModal');
const btnGotItHowTo = document.getElementById('btnGotItHowTo');

// Top banner quick buttons
const btnQuickHomeCharge = document.getElementById('btnQuickHomeCharge');
const btnQuickPublicCharge = document.getElementById('btnQuickPublicCharge');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  migrateAndLoadRecords();
  initDefaultDateTime();
  setupEventListeners();
  setupPwaInstallation();
  render();
  lucide.createIcons();
});

// PWA Service Worker & Install Prompt
let deferredPrompt = null;
function setupPwaInstallation() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('AION SW registered:', reg.scope))
      .catch((err) => console.log('SW registration error:', err));
  }

  const pwaBanner = document.getElementById('pwaInstallBanner');
  const btnInstall = document.getElementById('btnPwaInstall');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaBanner) {
      pwaBanner.classList.remove('hidden');
      lucide.createIcons();
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          if (pwaBanner) pwaBanner.classList.add('hidden');
        }
        deferredPrompt = null;
      }
    });
  }

  window.addEventListener('appinstalled', () => {
    if (pwaBanner) pwaBanner.classList.add('hidden');
    showToast('ติดตั้งแอป AION EV สำเร็จเรียบร้อย!', 'success');
  });
}

// Current date & time helper
function initDefaultDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  inputDateTime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Load and Migrate storage
function migrateAndLoadRecords() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy key
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        localStorage.setItem(STORAGE_KEY, legacyRaw);
      }
    }
    records = raw ? JSON.parse(raw) : [];

    // Ensure all items have chargingType
    records = records.map(r => {
      if (!r.chargingType) {
        const isHome = (r.station || '').toLowerCase().includes('บ้าน') || (r.station || '').toLowerCase().includes('home');
        return {
          ...r,
          chargingType: isHome ? 'home' : 'public',
          kwh: r.kwh ?? null,
          ratePerUnit: r.ratePerUnit ?? null
        };
      }
      return r;
    });
  } catch (e) {
    console.error('Failed to parse records', e);
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Switch Charging Type (Home vs Public)
function setChargingType(type) {
  inputChargingType.value = type;

  if (type === 'home') {
    tabTypeHome.className = 'py-3 px-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all tab-active';
    tabTypePublic.className = 'py-3 px-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all tab-inactive';
    homeChargingBox.classList.remove('hidden');
    publicChargingBox.classList.add('hidden');
    inputStation.removeAttribute('required');
    updateHomeCalculation();
  } else {
    tabTypePublic.className = 'py-3 px-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all tab-active';
    tabTypeHome.className = 'py-3 px-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all tab-inactive';
    publicChargingBox.classList.remove('hidden');
    homeChargingBox.classList.add('hidden');
    inputStation.setAttribute('required', 'required');
  }
  lucide.createIcons();
}

// Home Charging Mode (kWh calculation vs Direct amount)
function setHomeInputMode(mode) {
  currentHomeMode = mode;
  if (mode === 'kwh') {
    btnModeKwh.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-xs';
    btnModeDirect.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-700 border border-slate-200';
    homeKwhSubBox.classList.remove('hidden');
    updateHomeCalculation();
  } else {
    btnModeDirect.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-xs';
    btnModeKwh.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-700 border border-slate-200';
    homeKwhSubBox.classList.add('hidden');
  }
}

function getActiveHomeRate() {
  const selected = selectRatePreset.value;
  if (selected === 'custom') {
    return parseFloat(inputCustomRate.value) || 0;
  }
  return parseFloat(selected) || 0;
}

function updateHomeCalculation() {
  if (inputChargingType.value !== 'home' || currentHomeMode !== 'kwh') return;

  const kwh = parseFloat(inputKwh.value) || 0;
  const rate = getActiveHomeRate();

  if (kwh > 0 && rate > 0) {
    const total = kwh * rate;
    homeCalcFormula.textContent = `${kwh.toFixed(1)} kWh × ${rate.toFixed(2)} บาท/หน่วย`;
    homeCalcAmount.textContent = total.toFixed(2);
    // Auto-fill total amount
    inputAmount.value = total.toFixed(2);
  } else {
    homeCalcFormula.textContent = `ใส่จำนวนหน่วย kWh เพื่อคำนวณ`;
    homeCalcAmount.textContent = '0.00';
  }
}

// Event Listeners
function setupEventListeners() {
  chargeForm.addEventListener('submit', handleFormSubmit);
  btnCancelEdit.addEventListener('click', resetForm);
  btnSetNow.addEventListener('click', initDefaultDateTime);

  // Tab switcher Home vs Public
  tabTypeHome.addEventListener('click', () => setChargingType('home'));
  tabTypePublic.addEventListener('click', () => setChargingType('public'));

  // Quick buttons at banner
  if (btnQuickHomeCharge) {
    btnQuickHomeCharge.addEventListener('click', () => {
      setChargingType('home');
      window.scrollTo({ top: chargeForm.offsetTop - 80, behavior: 'smooth' });
      if (currentHomeMode === 'kwh') inputKwh.focus(); else inputAmount.focus();
    });
  }
  if (btnQuickPublicCharge) {
    btnQuickPublicCharge.addEventListener('click', () => {
      setChargingType('public');
      window.scrollTo({ top: chargeForm.offsetTop - 80, behavior: 'smooth' });
      inputStation.focus();
    });
  }

  // Home input modes
  btnModeKwh.addEventListener('click', () => setHomeInputMode('kwh'));
  btnModeDirect.addEventListener('click', () => setHomeInputMode('direct'));

  inputKwh.addEventListener('input', updateHomeCalculation);
  selectRatePreset.addEventListener('change', () => {
    if (selectRatePreset.value === 'custom') {
      customRateBox.classList.remove('hidden');
      inputCustomRate.focus();
    } else {
      customRateBox.classList.add('hidden');
    }
    updateHomeCalculation();
  });
  inputCustomRate.addEventListener('input', updateHomeCalculation);

  // Home presets buttons
  document.querySelectorAll('.btn-home-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      inputStation.value = btn.dataset.name;
      showToast(`เลือก: ${btn.dataset.name}`, 'info');
    });
  });

  // Quick Amount Buttons
  document.querySelectorAll('.btn-quick-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.dataset.val) || 0;
      const current = parseFloat(inputAmount.value) || 0;
      inputAmount.value = (current + val).toFixed(current % 1 !== 0 ? 2 : 0);
      inputAmount.focus();
    });
  });

  // Quick Station Buttons
  document.querySelectorAll('.btn-quick-station').forEach(btn => {
    btn.addEventListener('click', () => {
      inputStation.value = btn.dataset.station;
      inputAmount.focus();
    });
  });

  // Filter Type Pills
  document.querySelectorAll('.filter-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-type-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-cyan-700', 'shadow-xs');
        b.classList.add('text-slate-600');
      });
      btn.classList.add('bg-white', 'text-cyan-700', 'shadow-xs');
      btn.classList.remove('text-slate-600');
      currentTypeFilter = btn.dataset.filter;
      renderHistoryList();
    });
  });

  // Search & Month filter
  inputSearch.addEventListener('input', () => renderHistoryList());
  selectMonthFilter.addEventListener('change', () => renderHistoryList());

  // Chart Switch
  document.querySelectorAll('.tab-chart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-chart-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-cyan-700', 'shadow-xs', 'font-semibold');
        b.classList.add('text-slate-600');
      });
      btn.classList.add('bg-white', 'text-cyan-700', 'shadow-xs', 'font-semibold');
      btn.classList.remove('text-slate-600');
      currentChartView = btn.dataset.view;
      renderChart();
    });
  });

  // How-To Modal
  btnPwaHowTo.addEventListener('click', () => howToModal.classList.remove('hidden'));
  btnCloseHowToModal.addEventListener('click', () => howToModal.classList.add('hidden'));
  btnGotItHowTo.addEventListener('click', () => howToModal.classList.add('hidden'));
  howToModal.addEventListener('click', (e) => {
    if (e.target === howToModal) howToModal.classList.add('hidden');
  });

  // Settings Modal
  btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseModal.addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });

  // Exports
  btnExportCSV.addEventListener('click', exportCSV);
  modalBtnExportCSV.addEventListener('click', exportCSV);
  modalBtnExportJSON.addEventListener('click', exportJSON);

  // Import
  modalBtnImportJSON.addEventListener('click', () => fileImportJSON.click());
  fileImportJSON.addEventListener('change', handleImportJSON);

  // Sample data & Clear
  btnAddSampleData.addEventListener('click', loadSampleData);
  btnClearAll.addEventListener('click', handleClearAll);
}

// Form Submission
function handleFormSubmit(e) {
  e.preventDefault();

  const chargingType = inputChargingType.value;
  const amount = parseFloat(inputAmount.value);
  const dateTime = inputDateTime.value;
  const odometer = inputOdometer.value !== '' ? parseFloat(inputOdometer.value) : null;

  let station = inputStation.value.trim();
  let kwh = null;
  let ratePerUnit = null;

  if (chargingType === 'home') {
    if (currentHomeMode === 'kwh') {
      kwh = parseFloat(inputKwh.value) || null;
      ratePerUnit = getActiveHomeRate();
    }
    if (!station) {
      station = '🏠 ชาร์จไฟบ้าน';
      if (kwh) station += ` (${kwh.toFixed(1)} kWh)`;
    }
  } else {
    if (!station) {
      showToast('กรุณาระบุชื่อสถานีชาร์จสาธารณะ', 'error');
      inputStation.focus();
      return;
    }
  }

  if (isNaN(amount) || amount <= 0) {
    showToast('กรุณาระบุยอดเงินค่าชาร์จที่ถูกต้อง', 'error');
    inputAmount.focus();
    return;
  }

  const editId = editEntryId.value;

  if (editId) {
    const idx = records.findIndex(r => r.id === editId);
    if (idx !== -1) {
      records[idx] = {
        ...records[idx],
        chargingType,
        station,
        amount,
        kwh,
        ratePerUnit,
        dateTime,
        odometer,
        updatedAt: new Date().toISOString()
      };
      showToast('แก้ไขข้อมูลการชาร์จเรียบร้อยแล้ว', 'success');
    }
  } else {
    const newRecord = {
      id: 'aion_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      chargingType,
      station,
      amount,
      kwh,
      ratePerUnit,
      dateTime,
      odometer,
      createdAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    showToast('บันทึกค่าชาร์จ AION เรียบร้อยแล้ว ⚡', 'success');
  }

  records.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  saveRecords();
  resetForm();
  render();
}

function resetForm() {
  editEntryId.value = '';
  formTitle.textContent = 'บันทึกการชาร์จใหม่';
  btnSubmitText.textContent = 'บันทึกค่าชาร์จ';
  btnCancelEdit.classList.add('hidden');
  inputAmount.value = '';
  inputStation.value = '';
  inputOdometer.value = '';
  inputKwh.value = '';
  homeCalcFormula.textContent = '-';
  homeCalcAmount.textContent = '0.00';
  initDefaultDateTime();
  setChargingType('home');
  setHomeInputMode('kwh');
}

function startEditRecord(id) {
  const item = records.find(r => r.id === id);
  if (!item) return;

  editEntryId.value = item.id;
  setChargingType(item.chargingType || 'public');

  if (item.chargingType === 'home') {
    if (item.kwh) {
      setHomeInputMode('kwh');
      inputKwh.value = item.kwh;
      if (item.ratePerUnit) {
        if (['2.80', '2.63', '5.20', '4.20'].includes(item.ratePerUnit.toFixed(2))) {
          selectRatePreset.value = item.ratePerUnit.toFixed(2);
          customRateBox.classList.add('hidden');
        } else {
          selectRatePreset.value = 'custom';
          customRateBox.classList.remove('hidden');
          inputCustomRate.value = item.ratePerUnit;
        }
      }
      updateHomeCalculation();
    } else {
      setHomeInputMode('direct');
    }
  }

  inputAmount.value = item.amount;
  inputStation.value = item.station;
  inputDateTime.value = item.dateTime;
  inputOdometer.value = item.odometer ?? '';

  formTitle.textContent = 'แก้ไขรายการชาร์จ';
  btnSubmitText.textContent = 'บันทึกการแก้ไข';
  btnCancelEdit.classList.remove('hidden');

  window.scrollTo({ top: chargeForm.offsetTop - 80, behavior: 'smooth' });
  inputAmount.focus();
}

function deleteRecord(id) {
  const target = records.find(r => r.id === id);
  if (!target) return;

  const dateStr = formatDateTimeThai(target.dateTime);
  if (confirm(`คุณต้องการลบรายการชาร์จ\n"${target.station}" (${target.amount.toLocaleString()} บาท) วันที่ ${dateStr} หรือไม่?`)) {
    records = records.filter(r => r.id !== id);
    saveRecords();
    if (editEntryId.value === id) resetForm();
    render();
    showToast('ลบรายการเรียบร้อยแล้ว', 'success');
  }
}

// Compute metrics: THB/km
function computeConsumptionMetrics() {
  const chrono = [...records].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const metricsMap = new Map();
  let prevRecordWithOdo = null;

  for (const rec of chrono) {
    if (rec.odometer !== null && !isNaN(rec.odometer)) {
      if (prevRecordWithOdo !== null) {
        const deltaKm = rec.odometer - prevRecordWithOdo.odometer;
        if (deltaKm > 0) {
          const costPerKm = rec.amount / deltaKm;
          metricsMap.set(rec.id, {
            deltaKm,
            costPerKm,
            prevOdometer: prevRecordWithOdo.odometer
          });
        }
      }
      prevRecordWithOdo = rec;
    }
  }

  const odoRecords = chrono.filter(r => r.odometer !== null && !isNaN(r.odometer));
  let overall = {
    totalKm: 0,
    totalSpanCost: 0,
    avgPerKm: null,
    savingsPerKm: null
  };

  if (odoRecords.length >= 2) {
    const minOdo = odoRecords[0].odometer;
    const maxOdo = odoRecords[odoRecords.length - 1].odometer;
    const totalKm = maxOdo - minOdo;

    if (totalKm > 0) {
      let sumCost = 0;
      for (let i = 1; i < odoRecords.length; i++) {
        sumCost += Number(odoRecords[i].amount) || 0;
      }
      overall.totalKm = totalKm;
      overall.totalSpanCost = sumCost;
      overall.avgPerKm = sumCost / totalKm;
      overall.savingsPerKm = Math.max(0, BENCHMARK_GAS_CAR_PER_KM - overall.avgPerKm);
    }
  }

  return { metricsMap, overall };
}

// Render Master
function render() {
  const { metricsMap, overall } = computeConsumptionMetrics();
  renderStats(overall);
  renderMonthFilterOptions();
  renderHistoryList(metricsMap);
  renderChart();
  lucide.createIcons();
}

// Render Stats
function renderStats(overall) {
  const totalCost = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  statTotalCost.textContent = totalCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  // Home vs Public Breakdown
  const homeRecords = records.filter(r => r.chargingType === 'home');
  const publicRecords = records.filter(r => r.chargingType !== 'home');

  const homeSum = homeRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const publicSum = publicRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  statHomeCostSummary.textContent = `${homeSum.toLocaleString()} ฿ (${homeRecords.length} ครั้ง)`;
  statPublicCostSummary.textContent = `${publicSum.toLocaleString()} ฿ (${publicRecords.length} ครั้ง)`;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const monthNamesThai = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  statCurrentMonthLabel.textContent = `${monthNamesThai[curMonth]} ${curYear + 543}`;

  const monthRecords = records.filter(r => {
    const d = new Date(r.dateTime);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });

  const monthCost = monthRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  statMonthCost.textContent = monthCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  statMonthSessions.textContent = monthRecords.length.toLocaleString();

  statTotalSessions.textContent = records.length.toLocaleString();

  if (overall.avgPerKm !== null) {
    statAvgPerKm.textContent = overall.avgPerKm.toFixed(2);
    statTotalKm.textContent = overall.totalKm.toLocaleString();

    statSavingsRate.textContent = `~${overall.savingsPerKm.toFixed(2)} ฿/กม.`;
    const totalSavedEst = (overall.savingsPerKm * overall.totalKm);
    statSavingsSubtext.innerHTML = `รวมประหยัดได้ประมาณ <span class="text-emerald-700 font-bold">${totalSavedEst.toLocaleString(undefined, { maximumFractionDigits: 0 })} บาท</span>`;
  } else {
    statAvgPerKm.textContent = '-';
    statTotalKm.textContent = '-';
    statSavingsRate.textContent = '-';
    statSavingsSubtext.innerHTML = `ใส่เลขไมล์อย่างน้อย 2 ครั้งเพื่อคำนวณ`;
  }
}

// Month filter dropdown
function renderMonthFilterOptions() {
  const currentSelected = selectMonthFilter.value;
  const monthMap = new Map();

  records.forEach(r => {
    const d = new Date(r.dateTime);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const thaiYear = d.getFullYear() + 543;
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const label = `${monthNames[d.getMonth()]} ${thaiYear}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, label);
    }
  });

  let html = '<option value="all">ทุกเดือน</option>';
  Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([key, label]) => {
      html += `<option value="${key}">${label}</option>`;
    });

  selectMonthFilter.innerHTML = html;
  if (Array.from(selectMonthFilter.options).some(o => o.value === currentSelected)) {
    selectMonthFilter.value = currentSelected;
  }
}

// Render History List (Large Typography Card)
function renderHistoryList(metricsMap = null) {
  if (!metricsMap) {
    metricsMap = computeConsumptionMetrics().metricsMap;
  }

  const searchQuery = inputSearch.value.trim().toLowerCase();
  const monthFilter = selectMonthFilter.value;

  const filtered = records.filter(item => {
    // Type filter
    if (currentTypeFilter === 'home' && item.chargingType !== 'home') return false;
    if (currentTypeFilter === 'public' && item.chargingType === 'home') return false;

    // Search filter
    const matchSearch = !searchQuery ||
      (item.station || '').toLowerCase().includes(searchQuery) ||
      String(item.amount).includes(searchQuery);

    // Month filter
    let matchMonth = true;
    if (monthFilter !== 'all') {
      const d = new Date(item.dateTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      matchMonth = key === monthFilter;
    }

    return matchSearch && matchMonth;
  });

  historyBadgeCount.textContent = `${filtered.length} รายการ`;

  if (filtered.length === 0) {
    historyListContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  historyListContainer.innerHTML = filtered.map(item => {
    const formattedDate = formatDateTimeThai(item.dateTime);
    const metric = metricsMap.get(item.id);
    const isHome = item.chargingType === 'home';

    return `
      <div class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
        <div class="flex items-start gap-3.5">
          <div class="w-12 h-12 rounded-2xl ${isHome ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-cyan-50 border-cyan-200 text-cyan-700'} border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <i data-lucide="${isHome ? 'home' : 'zap'}" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-extrabold text-slate-900 text-lg leading-tight">${escapeHtml(item.station)}</span>
              ${isHome ? `
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                  🏠 ไฟบ้าน
                </span>
              ` : `
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-bold border border-cyan-200 flex items-center gap-1">
                  ⚡ สถานี
                </span>
              `}
              ${item.kwh ? `
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                  🔋 ${Number(item.kwh).toFixed(1)} kWh
                </span>
              ` : ''}
              ${item.odometer !== null && item.odometer !== undefined ? `
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold flex items-center gap-1">
                  <i data-lucide="gauge" class="w-3.5 h-3.5 text-amber-600"></i> ${Number(item.odometer).toLocaleString()} km
                </span>
              ` : ''}
            </div>

            <p class="text-sm font-medium text-slate-500 mt-1 flex items-center gap-1.5">
              <i data-lucide="clock" class="w-4 h-4 text-slate-400"></i> ${formattedDate}
            </p>

            ${metric ? `
              <div class="mt-2.5 flex items-center gap-2 flex-wrap">
                <span class="text-sm px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-extrabold flex items-center gap-1.5">
                  <i data-lucide="trending-down" class="w-4 h-4 text-emerald-600"></i>
                  ${metric.costPerKm.toFixed(2)} บาท/กม.
                  <span class="text-emerald-700 font-medium text-xs">(วิ่งไป ${metric.deltaKm.toLocaleString()} กม.)</span>
                </span>
              </div>
            ` : (item.odometer ? `
              <div class="mt-2 text-xs text-slate-500">
                📍 จุดบันทึกเลขไมล์เริ่มต้น (จะคำนวณอัตราสิ้นเปลืองในรอบถัดไป)
              </div>
            ` : '')}
          </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div class="text-left sm:text-right">
            <div class="text-2xl font-extrabold ${isHome ? 'text-emerald-700' : 'text-cyan-700'}">
              ${Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              <span class="text-sm font-bold text-slate-500">฿</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="startEditRecord('${item.id}')" title="แก้ไข"
              class="p-2.5 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 rounded-xl transition-colors border border-transparent hover:border-cyan-200">
              <i data-lucide="edit-3" class="w-5 h-5"></i>
            </button>
            <button onclick="deleteRecord('${item.id}')" title="ลบ"
              class="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200">
              <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// Render Charts
function renderChart() {
  const canvas = document.getElementById('expenseChart');
  if (!canvas) return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (records.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (currentChartView === 'monthly') {
    // Monthly Stacked or Combined Chart
    const monthlyMap = new Map();
    const sorted = [...records].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    sorted.forEach(r => {
      const d = new Date(r.dateTime);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const thaiYear = (d.getFullYear() + 543) % 100;
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const label = `${monthNames[d.getMonth()]} '${thaiYear}`;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { label, home: 0, public: 0 });
      }
      const isHome = r.chargingType === 'home';
      const cost = Number(r.amount) || 0;
      if (isHome) {
        monthlyMap.get(key).home += cost;
      } else {
        monthlyMap.get(key).public += cost;
      }
    });

    const entries = Array.from(monthlyMap.values()).slice(-6);
    const labels = entries.map(e => e.label);
    const homeData = entries.map(e => e.home);
    const publicData = entries.map(e => e.public);

    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '🏠 ชาร์จบ้าน (บาท)',
            data: homeData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 8,
            maxBarThickness: 38
          },
          {
            label: '⚡ สถานีสาธารณะ (บาท)',
            data: publicData,
            backgroundColor: 'rgba(8, 145, 178, 0.85)',
            borderRadius: 8,
            maxBarThickness: 38
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Prompt', size: 13, weight: 'bold' } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#38bdf8',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toLocaleString()} บาท`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#475569', font: { family: 'Prompt', size: 12, weight: 'bold' } }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: {
              color: '#475569',
              font: { family: 'Prompt', size: 12 },
              callback: (v) => `${v.toLocaleString()} ฿`
            }
          }
        }
      }
    });

  } else if (currentChartView === 'home_vs_public') {
    // Comparison: Home vs Public
    const homeRecords = records.filter(r => r.chargingType === 'home');
    const publicRecords = records.filter(r => r.chargingType !== 'home');

    const homeCost = homeRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const publicCost = publicRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [
          `🏠 ชาร์จไฟบ้าน (${homeCost.toLocaleString()} ฿)`,
          `⚡ สถานีสาธารณะ (${publicCost.toLocaleString()} ฿)`
        ],
        datasets: [{
          data: [homeCost, publicCost],
          backgroundColor: ['#10b981', '#0891b2'],
          borderWidth: 3,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#1e293b', padding: 20, font: { family: 'Prompt', size: 14, weight: 'bold' } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (context) => ` ค่าใช้จ่าย: ${context.parsed.toLocaleString()} บาท`
            }
          }
        },
        cutout: '62%'
      }
    });

  } else {
    // Top Stations
    const stationMap = new Map();
    records.forEach(r => {
      const st = r.station || 'อื่นๆ';
      stationMap.set(st, (stationMap.get(st) || 0) + (Number(r.amount) || 0));
    });

    const sortedStations = Array.from(stationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const labels = sortedStations.map(s => s[0]);
    const data = sortedStations.map(s => s[1]);
    const colors = [
      '#10b981', // Emerald
      '#0891b2', // Cyan
      '#d97706', // Amber
      '#7c3aed', // Purple
      '#ec4899'  // Pink
    ];

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 3,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#334155', padding: 15, font: { family: 'Prompt', size: 12, weight: 'bold' } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.parsed.toLocaleString()} บาท`
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

// Export CSV
function exportCSV() {
  if (records.length === 0) {
    showToast('ไม่มีข้อมูลสำหรับส่งออก', 'error');
    return;
  }

  const { metricsMap } = computeConsumptionMetrics();
  const headers = ['วันที่และเวลา', 'ประเภท', 'สถานที่/สถานี', 'จำนวนเงิน (บาท)', 'หน่วยไฟ (kWh)', 'เรท (บาท/หน่วย)', 'เลขไมล์ (km)', 'ระยะทางช่วงนี้ (km)', 'อัตราสิ้นเปลือง (บาท/กม.)'];

  const rows = records.map(r => {
    const metric = metricsMap.get(r.id);
    return [
      formatDateTimeThai(r.dateTime),
      r.chargingType === 'home' ? 'ชาร์จบ้าน' : 'สถานีสาธารณะ',
      `"${(r.station || '').replace(/"/g, '""')}"`,
      r.amount,
      r.kwh ?? '',
      r.ratePerUnit ?? '',
      r.odometer ?? '',
      metric ? metric.deltaKm : '',
      metric ? metric.costPerKm.toFixed(2) : ''
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `AION_EV_Charging_${new Date().toISOString().slice(0, 10)}.csv`);
  showToast('ส่งออกไฟล์ CSV สำเร็จ', 'success');
}

// Export JSON Backup
function exportJSON() {
  if (records.length === 0) {
    showToast('ไม่มีข้อมูลสำหรับสำรอง', 'error');
    return;
  }
  const data = JSON.stringify({
    carModel: 'AION EV (White Edition)',
    exportedAt: new Date().toISOString(),
    records
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  downloadBlob(blob, `AION_EV_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  showToast('สำรองข้อมูล JSON สำเร็จ', 'success');
}

// Import JSON
function handleImportJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      const importedRecords = Array.isArray(parsed) ? parsed : (parsed.records || []);
      if (!Array.isArray(importedRecords)) throw new Error('Invalid format');

      if (confirm(`พบข้อมูล ${importedRecords.length} รายการ คุณต้องการนำเข้าข้อมูลนี้หรือไม่?`)) {
        const existingIds = new Set(records.map(r => r.id));
        let addedCount = 0;
        importedRecords.forEach(item => {
          if (!existingIds.has(item.id)) {
            records.push({
              ...item,
              chargingType: item.chargingType || 'public'
            });
            addedCount++;
          }
        });

        records.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
        saveRecords();
        render();
        settingsModal.classList.add('hidden');
        showToast(`นำเข้าสำเร็จ เพิ่มข้อมูลใหม่ ${addedCount} รายการ`, 'success');
      }
    } catch (err) {
      alert('ไฟล์ JSON ไม่ถูกต้องหรือไม่ตรงรูปแบบ');
    }
    fileImportJSON.value = '';
  };
  reader.readAsText(file);
}

// Realistic Sample Data for AION EV (White Edition)
function loadSampleData() {
  if (records.length > 0) {
    if (!confirm('ต้องการโหลดข้อมูลตัวอย่าง AION EV เพิ่มเข้าสู่ระบบหรือไม่?')) return;
  }

  const now = new Date();
  const sample = [
    {
      id: 'aion_sample_1',
      chargingType: 'home',
      station: '🏠 Wallbox ที่บ้าน (TOU Off-Peak)',
      amount: 112.0,
      kwh: 40.0,
      ratePerUnit: 2.80,
      dateTime: new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 16),
      odometer: 11520
    },
    {
      id: 'aion_sample_2',
      chargingType: 'public',
      station: 'PEA Volta (ปั๊มบางจาก)',
      amount: 295.0,
      kwh: 38.5,
      ratePerUnit: 7.66,
      dateTime: new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 16),
      odometer: 11150
    },
    {
      id: 'aion_sample_3',
      chargingType: 'home',
      station: '🏠 Wallbox ที่บ้าน',
      amount: 126.0,
      kwh: 45.0,
      ratePerUnit: 2.80,
      dateTime: new Date(now.getTime() - 8 * 86400000).toISOString().slice(0, 16),
      odometer: 10780
    },
    {
      id: 'aion_sample_4',
      chargingType: 'public',
      station: 'PTT EV Station PluZ',
      amount: 340.0,
      kwh: 44.0,
      ratePerUnit: 7.72,
      dateTime: new Date(now.getTime() - 12 * 86400000).toISOString().slice(0, 16),
      odometer: 10390
    },
    {
      id: 'aion_sample_5',
      chargingType: 'home',
      station: '🏠 Wallbox ที่บ้าน',
      amount: 98.0,
      kwh: 35.0,
      ratePerUnit: 2.80,
      dateTime: new Date(now.getTime() - 16 * 86400000).toISOString().slice(0, 16),
      odometer: 10000
    }
  ];

  records = [...sample, ...records];
  records.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  saveRecords();
  render();
  settingsModal.classList.add('hidden');
  showToast('โหลดข้อมูลตัวอย่าง AION EV (บ้าน & สถานี) สำเร็จ!', 'success');
}

function handleClearAll() {
  if (records.length === 0) return;
  if (confirm('⚠️ ต้องการลบประวัติการชาร์จทั้งหมดใช่หรือไม่?')) {
    records = [];
    saveRecords();
    resetForm();
    render();
    settingsModal.classList.add('hidden');
    showToast('ล้างข้อมูลทั้งหมดแล้ว', 'info');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateTimeThai(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const thaiYear = d.getFullYear() + 543;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${thaiYear} ${hours}:${minutes} น.`;
}

let toastTimer = null;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;

  if (type === 'error') {
    toastIcon.setAttribute('data-lucide', 'alert-circle');
    toastIcon.className = 'w-6 h-6 text-rose-400';
    toast.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 border border-rose-500/50 text-white shadow-2xl transition-all duration-300';
  } else if (type === 'info') {
    toastIcon.setAttribute('data-lucide', 'info');
    toastIcon.className = 'w-6 h-6 text-cyan-400';
    toast.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 border border-cyan-500/50 text-white shadow-2xl transition-all duration-300';
  } else {
    toastIcon.setAttribute('data-lucide', 'check-circle');
    toastIcon.className = 'w-6 h-6 text-emerald-400';
    toast.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 border border-emerald-500/50 text-white shadow-2xl transition-all duration-300';
  }
  lucide.createIcons();

  toast.classList.remove('translate-y-28', 'opacity-0');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('translate-y-28', 'opacity-0');
  }, 2800);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
