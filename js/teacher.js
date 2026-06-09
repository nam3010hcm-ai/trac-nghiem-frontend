import {
  auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from './firebase.js';

import { initData, $ } from './common.js';
import { populateCategoryDropdowns, updateFltSubcat, updateQFormSubcat, updateEFormSubcat, addParentCategory, deleteParentCategory, addSubCategory, deleteSubCategory, editSubCategory, restoreDefaultCategories, renderCatManagementList } from './categories.js';
import { openQForm, closeQForm, saveQ, deleteQ, renderQuestions } from './questions.js';
import { openEForm, closeEForm, saveExam, deleteExam, toggleExamVisibility, renderExams, populateExamSelect } from './exams.js';
import { renderResults, clearResults, exportCSV } from './results.js';

async function doLogin() {
  const email = $('t-email').value.trim();
  const pass = $('t-pass').value.trim();

  if (!email || !pass) {
    $('t-err').style.display = 'block';
    $('t-err').innerText = '❌ Vui lòng nhập email và mật khẩu!';
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    $('t-err').style.display = 'none';
  } catch (error) {
    console.error(error);
    $('t-err').style.display = 'block';
    $('t-err').innerText = '❌ Email hoặc mật khẩu không đúng!';
  }
}

async function doLogout() {
  await signOut(auth);
  $('t-pass').value = '';
  $('t-err').style.display = 'none';
}

function switchTTab(t) {
  ['q', 'e', 'r', 'c'].forEach(x => {
    $('tc-' + x).classList.toggle('active', x === t);
    document.querySelector(`.tab-btn[data-tab="${x}"]`).classList.toggle('active', x === t);
  });

  if (t === 'r') renderResults();
  if (t === 'c') renderCatManagementList();
}

document.addEventListener('DOMContentLoaded', () => {
  $('btn-login').addEventListener('click', doLogin);

  $('t-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  $('t-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  $('btn-logout').addEventListener('click', doLogout);

  onAuthStateChanged(auth, async user => {
    if (user) {
      $('t-login').style.display = 'none';
      $('t-panel').style.display = 'block';

      await initData(true);

      populateCategoryDropdowns();
      updateFltSubcat();
      updateQFormSubcat();
      updateEFormSubcat();
      populateExamSelect();

      renderQuestions();
      renderExams();
      renderResults();
      renderCatManagementList();
    } else {
      $('t-login').style.display = 'block';
      $('t-panel').style.display = 'none';
    }
  });

  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTTab(btn.dataset.tab))
  );

  $('flt-cat').addEventListener('change', () => {
  updateFltSubcat();

  const cat = $('flt-cat').value;
  $('qf-cat').value = cat;
  updateQFormSubcat();

  const subcat = $('flt-subcat').value;
  if (subcat) $('qf-subcat').value = subcat;
  });
  $('qf-cat').addEventListener('change', updateQFormSubcat);
  $('ef-cat').addEventListener('change', updateEFormSubcat);
  $('btn-filter-q').addEventListener('click', () => {
  renderQuestions();

  const cat = $('flt-cat').value;
  const subcat = $('flt-subcat').value;

  if (cat) {
    $('qf-cat').value = cat;
    updateQFormSubcat();
  }

  if (subcat) {
    $('qf-subcat').value = subcat;
  }
  });

  $('btn-open-qform').addEventListener('click', () => {
  openQForm();

  const cat = $('flt-cat').value;
  const subcat = $('flt-subcat').value;

  if (cat) {
    $('qf-cat').value = cat;
    updateQFormSubcat();
  }

  if (subcat) {
    $('qf-subcat').value = subcat;
  }
  });
  $('btn-close-qform').addEventListener('click', closeQForm);
  $('btn-save-q').addEventListener('click', saveQ);

  $('q-list').addEventListener('click', e => {
    const btn = e.target.closest('.q-action');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    if (btn.dataset.action === 'edit') openQForm(id);
    if (btn.dataset.action === 'delete') deleteQ(id);
  });

  $('btn-open-eform').addEventListener('click', openEForm);
  $('btn-close-eform').addEventListener('click', closeEForm);
  $('btn-save-exam').addEventListener('click', saveExam);

  $('e-list').addEventListener('click', e => {
    const btn = e.target.closest('.e-action');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    if (btn.dataset.action === 'toggle') toggleExamVisibility(id);
    if (btn.dataset.action === 'delete') deleteExam(id);
  });

  $('btn-add-parent').addEventListener('click', addParentCategory);
  $('btn-add-sub').addEventListener('click', addSubCategory);
  $('btn-restore').addEventListener('click', restoreDefaultCategories);

  $('cat-management-list').addEventListener('click', e => {
    const btn = e.target.closest('.cat-action');
    if (!btn) return;
    const parent = btn.dataset.parent;
    const sub = btn.dataset.sub;
    if (btn.dataset.action === 'delete-parent') deleteParentCategory(parent);
    if (btn.dataset.action === 'edit-sub') editSubCategory(parent, sub);
    if (btn.dataset.action === 'delete-sub') deleteSubCategory(parent, sub);
  });

  $('btn-export').addEventListener('click', exportCSV);
  $('btn-clear-results').addEventListener('click', clearResults);
});
